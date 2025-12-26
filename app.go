package main

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/energye/systray"
	"github.com/google/uuid"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const DefaultTunConfig = `{"type":"tun","tag":"tun-in","address":["172.19.0.1/30","fdfe:dcba:9876::1/126"],"mtu":9000,"auto_route":true,"strict_route":true}`
const DefaultMixedConfig = `{"type":"mixed","tag":"mixed-in","listen":"0.0.0.0","listen_port":7893,"set_system_proxy":true}`

type Profile struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Url     string `json:"url"`
	Path    string `json:"path"`
	Updated string `json:"updated"`
}

type MetaData struct {
	ActiveID      string    `json:"active_id"`
	Mirror        string    `json:"mirror"`
	MirrorEnabled bool      `json:"mirror_enabled"`
	TunMode       bool      `json:"tun_mode"`
	SysProxy      bool      `json:"sys_proxy"`
	TunConfig     string    `json:"tun_config"`
	MixedConfig   string    `json:"mixed_config"`
	AutoConnect   bool      `json:"auto_connect"`
	StartOnBoot   bool      `json:"start_on_boot"`
	Profiles      []Profile `json:"profiles"`
}

type ReleaseAsset struct {
	Name               string `json:"name"`
	BrowserDownloadUrl string `json:"browser_download_url"`
}

type ReleaseInfo struct {
	TagName string         `json:"tag_name"`
	Assets  []ReleaseAsset `json:"assets"`
}

type WriteCounter struct {
	Total    uint64
	Current  uint64
	Ctx      context.Context
	LastTime time.Time
}

func (wc *WriteCounter) Write(p []byte) (int, error) {
	n := len(p)
	wc.Current += uint64(n)

	if wc.Total > 0 {
		if time.Since(wc.LastTime) > 100*time.Millisecond || wc.Current == wc.Total {
			percentage := float64(wc.Current) / float64(wc.Total) * 100
			wailsRuntime.EventsEmit(wc.Ctx, "download-progress", int(percentage))
			wc.LastTime = time.Now()
		}
	}
	return n, nil
}

type App struct {
	ctx            context.Context
	cmd            *exec.Cmd
	Running        bool
	iconData       []byte
	startMinimized bool
}

func NewApp(icon []byte, startMinimized bool) *App {
	return &App{
		iconData:       icon,
		startMinimized: startMinimized,
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	cwd, _ := os.Getwd()
	coreDir := filepath.Join(cwd, "data", "core")
	os.MkdirAll(coreDir, 0755)
	os.MkdirAll(filepath.Join(cwd, "data", "profiles"), 0755)

	meta := a.loadMeta()

	coreExe := filepath.Join(coreDir, "sing-box.exe")
	_, errCore := os.Stat(coreExe)
	kernelExists := errCore == nil

	profileExists := false
	if meta.ActiveID != "" {
		for _, p := range meta.Profiles {
			if p.ID == meta.ActiveID {
				if _, err := os.Stat(p.Path); err == nil {
					profileExists = true
				}
				break
			}
		}
	}

	canAutoStart := kernelExists && profileExists && meta.AutoConnect

	if canAutoStart {
		meta.TunMode = true
		meta.SysProxy = true
	} else {
		meta.TunMode = false
		meta.SysProxy = false
	}
	a.saveMeta(meta)

	a.StartTray()

	if a.startMinimized {
		wailsRuntime.WindowHide(a.ctx)
	}

	if canAutoStart {
		go func() {
			time.Sleep(500 * time.Millisecond)
			if res := a.startCore(); res == "Success" {
				wailsRuntime.EventsEmit(a.ctx, "status", true)
			} else {
				wailsRuntime.EventsEmit(a.ctx, "status", false)
			}
		}()
	}
}

func (a *App) onShutdown(ctx context.Context) {
	a.stopCore()
}

func (a *App) StartTray() {
	go func() {
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()

		systray.Run(func() {
			if len(a.iconData) > 0 {
				systray.SetIcon(a.iconData)
			} else {
				systray.SetTitle("WinBox")
			}

			systray.SetTitle("WinBox")
			systray.SetTooltip("WinBox Client")

			systray.SetOnClick(func(menu systray.IMenu) {
				go a.Show()
			})

			systray.SetOnRClick(func(menu systray.IMenu) {
				menu.ShowMenu()
			})

			mOpen := systray.AddMenuItem("Open APP", "Open main window")
			mOpen.Click(func() {
				go a.Show()
			})

			systray.AddSeparator()

			mQuit := systray.AddMenuItem("Quit", "Quit Application")
			mQuit.Click(func() {
				systray.Quit()
				go a.Quit()
			})

		}, func() {
		})
	}()
}

func (a *App) MinimizeToTray() {
	wailsRuntime.WindowHide(a.ctx)
}

func (a *App) Minimize() {
	wailsRuntime.WindowMinimise(a.ctx)
}

func (a *App) Show() {
	wailsRuntime.WindowShow(a.ctx)
	wailsRuntime.WindowUnminimise(a.ctx)
	wailsRuntime.WindowSetAlwaysOnTop(a.ctx, true)
	wailsRuntime.WindowSetAlwaysOnTop(a.ctx, false)
}

func (a *App) GetOverride(name string) string {
	meta := a.loadMeta()
	switch name {
	case "tun":
		return meta.TunConfig
	case "mixed":
		return meta.MixedConfig
	default:
		return "{}"
	}
}

func (a *App) SaveOverride(name, content string) string {
	if !json.Valid([]byte(content)) {
		return "Invalid JSON"
	}
	meta := a.loadMeta()
	switch name {
	case "tun":
		meta.TunConfig = content
	case "mixed":
		meta.MixedConfig = content
	default:
		return "Unknown type"
	}
	a.saveMeta(meta)
	return "Success"
}

func (a *App) ResetOverride(name string) string {
	var content string
	switch name {
	case "tun":
		content = DefaultTunConfig
	case "mixed":
		content = DefaultMixedConfig
	default:
		return "Unknown type"
	}
	return a.SaveOverride(name, content)
}

func (a *App) processConfig(srcPath, dstPath string, enableTun bool, enableProxy bool) error {
	content, err := os.ReadFile(srcPath)
	if err != nil {
		return err
	}

	var config map[string]interface{}
	if err := json.Unmarshal(content, &config); err != nil {
		return err
	}

	newInbounds := make([]interface{}, 0)
	meta := a.loadMeta()

	if enableTun {
		var tunMap map[string]interface{}
		if json.Unmarshal([]byte(meta.TunConfig), &tunMap) == nil {
			newInbounds = append(newInbounds, tunMap)
		}
	}

	if enableProxy {
		var mixedMap map[string]interface{}
		if json.Unmarshal([]byte(meta.MixedConfig), &mixedMap) == nil {
			newInbounds = append(newInbounds, mixedMap)
		}
	}

	config["inbounds"] = newInbounds

	newContent, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(dstPath, newContent, 0644)
}

func (a *App) ApplyState(targetTun bool, targetProxy bool) string {
	meta := a.loadMeta()

	needsRestart := (meta.TunMode != targetTun) || (meta.SysProxy != targetProxy)
	if !a.Running {
		needsRestart = true
	}

	if !targetTun && !targetProxy {
		return a.stopCore()
	}

	meta.TunMode = targetTun
	meta.SysProxy = targetProxy
	a.saveMeta(meta)

	if needsRestart {
		if a.Running {
			a.stopCore()
			time.Sleep(500 * time.Millisecond)
		}
		return a.startCore()
	}

	return "Success"
}

func (a *App) startCore() string {
	meta := a.loadMeta()

	var activeProfilePath string
	for _, p := range meta.Profiles {
		if p.ID == meta.ActiveID {
			activeProfilePath = p.Path
			break
		}
	}

	if activeProfilePath == "" {
		return "Error: No active profile"
	}
	if _, err := os.Stat(activeProfilePath); os.IsNotExist(err) {
		return "Error: Profile file missing"
	}

	cwd, _ := os.Getwd()
	coreDir := filepath.Join(cwd, "data", "core")
	runtimeConfig := filepath.Join(coreDir, "config.json")
	coreExe := filepath.Join(coreDir, "sing-box.exe")

	if _, err := os.Stat(coreExe); os.IsNotExist(err) {
		return "Error: Kernel missing"
	}

	err := a.processConfig(activeProfilePath, runtimeConfig, meta.TunMode, meta.SysProxy)
	if err != nil {
		return "Config Gen Error: " + err.Error()
	}

	a.cmd = exec.Command(coreExe, "run", "-c", "config.json")
	a.cmd.Dir = coreDir

	SetCmdWindowHidden(a.cmd)

	var stderr bytes.Buffer
	a.cmd.Stderr = &stderr

	if err := a.cmd.Start(); err != nil {
		return "Start Error: " + err.Error()
	}
	a.Running = true

	go func() {
		a.cmd.Wait()
		a.Running = false
		wailsRuntime.EventsEmit(a.ctx, "status", false)
		if stderr.Len() > 0 {
			wailsRuntime.EventsEmit(a.ctx, "log", "CORE STOPPED: "+stderr.String())
		}
	}()
	return "Success"
}

func (a *App) stopCore() string {
	if a.cmd != nil && a.cmd.Process != nil {
		if err := SendExitSignal(a.cmd.Process); err != nil {
			a.cmd.Process.Kill()
		}

		done := make(chan error, 1)
		go func() { done <- a.cmd.Wait() }()

		select {
		case <-done:
		case <-time.After(2000 * time.Millisecond):
			a.cmd.Process.Kill()
		}
	}
	a.Running = false
	return "Stopped"
}

func (a *App) AddProfile(name, url string) string {
	if name == "" || url == "" {
		return "Empty Input"
	}
	resp, err := http.Get(url)
	if err != nil {
		return "Download Failed"
	}
	defer resp.Body.Close()
	id := uuid.New().String()
	cwd, _ := os.Getwd()
	savePath := filepath.Join(cwd, "data", "profiles", id+".json")
	out, _ := os.Create(savePath)
	io.Copy(out, resp.Body)
	out.Close()
	meta := a.loadMeta()
	now := time.Now().Format("2006-01-02 15:04")
	meta.Profiles = append(meta.Profiles, Profile{ID: id, Name: name, Url: url, Path: savePath, Updated: now})
	if len(meta.Profiles) == 1 {
		meta.ActiveID = id
	}
	a.saveMeta(meta)
	return "Success"
}

func (a *App) SelectProfile(id string) string {
	if a.Running {
		return "Stop service first"
	}
	meta := a.loadMeta()
	found := false
	for _, p := range meta.Profiles {
		if p.ID == id {
			found = true
			break
		}
	}
	if !found {
		return "Profile not found"
	}
	meta.ActiveID = id
	a.saveMeta(meta)
	return "Success"
}

func (a *App) UpdateActiveProfile() string {
	meta := a.loadMeta()
	var target *Profile
	for i := range meta.Profiles {
		if meta.Profiles[i].ID == meta.ActiveID {
			target = &meta.Profiles[i]
			break
		}
	}
	if target == nil {
		return "No active profile"
	}
	resp, err := http.Get(target.Url)
	if err != nil {
		return "Download Failed"
	}
	defer resp.Body.Close()
	out, _ := os.Create(target.Path)
	io.Copy(out, resp.Body)
	out.Close()
	target.Updated = time.Now().Format("2006-01-02 15:04")
	a.saveMeta(meta)
	return "Success"
}

func (a *App) DeleteProfile(id string) {
	meta := a.loadMeta()
	newProfiles := []Profile{}
	for _, p := range meta.Profiles {
		if p.ID == id {
			os.Remove(p.Path)
			continue
		}
		newProfiles = append(newProfiles, p)
	}
	meta.Profiles = newProfiles
	if meta.ActiveID == id {
		meta.ActiveID = ""
	}
	a.saveMeta(meta)
}

func (a *App) loadMeta() MetaData {
	cwd, _ := os.Getwd()
	f, err := os.ReadFile(filepath.Join(cwd, "data", "meta.json"))
	if err != nil {
		return MetaData{
			Profiles:      []Profile{},
			MirrorEnabled: true,
			Mirror:        "https://gh-proxy.com/",
			TunConfig:     DefaultTunConfig,
			MixedConfig:   DefaultMixedConfig,
			AutoConnect:   false,
			StartOnBoot:   false,
		}
	}
	var m MetaData
	json.Unmarshal(f, &m)

	if m.Mirror == "" {
		m.Mirror = "https://gh-proxy.com/"
		m.MirrorEnabled = true
	}
	if m.TunConfig == "" {
		m.TunConfig = DefaultTunConfig
	}
	if m.MixedConfig == "" {
		m.MixedConfig = DefaultMixedConfig
	}

	return m
}

func (a *App) saveMeta(m MetaData) {
	d, _ := json.MarshalIndent(m, "", "  ")
	cwd, _ := os.Getwd()
	os.WriteFile(filepath.Join(cwd, "data", "meta.json"), d, 0644)
}

func (a *App) GetInitData() map[string]interface{} {
	meta := a.loadMeta()
	var active Profile
	for _, p := range meta.Profiles {
		if p.ID == meta.ActiveID {
			active = p
			break
		}
	}
	local := a.GetLocalVersion()
	core := local != "Not Installed"
	return map[string]interface{}{
		"running":       a.Running,
		"activeProfile": active,
		"profiles":      meta.Profiles,
		"coreExists":    core,
		"localVersion":  local,
		"mirror":        meta.Mirror,
		"mirrorEnabled": meta.MirrorEnabled,
		"tunMode":       meta.TunMode,
		"sysProxy":      meta.SysProxy,
		"startOnBoot":   meta.StartOnBoot,
		"autoConnect":   meta.AutoConnect,
	}
}

func (a *App) SaveSettings(mirror string, enabled bool) string {
	m := a.loadMeta()
	m.Mirror = mirror
	m.MirrorEnabled = enabled
	a.saveMeta(m)
	return "Success"
}

func (a *App) SetStartOnBoot(enabled bool) string {
	exePath, err := os.Executable()
	if err != nil {
		return "Failed to get executable path"
	}

	taskName := "WinBoxAutostart"

	if enabled {
		cmdStr := fmt.Sprintf(`"%s" -minimized`, exePath)
		cmd := exec.Command("schtasks", "/Create", "/TN", taskName, "/TR", cmdStr, "/SC", "ONLOGON", "/RL", "HIGHEST", "/F")
		SetCmdWindowHidden(cmd)
		if output, err := cmd.CombinedOutput(); err != nil {
			return "Task Schedule Failed: " + string(output)
		}
	} else {
		cmd := exec.Command("schtasks", "/Delete", "/TN", taskName, "/F")
		SetCmdWindowHidden(cmd)
		cmd.Run()
	}

	meta := a.loadMeta()
	meta.StartOnBoot = enabled
	a.saveMeta(meta)

	return "Success"
}

func (a *App) SetAutoConnect(enabled bool) string {
	meta := a.loadMeta()
	meta.AutoConnect = enabled
	a.saveMeta(meta)
	return "Success"
}

func (a *App) Quit() {
	a.stopCore()
	wailsRuntime.Quit(a.ctx)
}

func (a *App) GetLocalVersion() string {
	cwd, _ := os.Getwd()
	exe := filepath.Join(cwd, "data", "core", "sing-box.exe")
	if _, err := os.Stat(exe); os.IsNotExist(err) {
		return "Not Installed"
	}
	cmd := exec.Command(exe, "version")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	out, _ := cmd.Output()
	re := regexp.MustCompile(`version\s+([0-9a-zA-Z\.\-]+)`)
	matches := re.FindStringSubmatch(string(out))
	if len(matches) > 1 {
		return matches[1]
	}
	return "Unknown"
}

func (a *App) CheckUpdate() string {
	resp, err := http.Get("https://api.github.com/repos/SagerNet/sing-box/releases/latest")
	if err != nil {
		return "Network Error"
	}
	defer resp.Body.Close()
	var res ReleaseInfo
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "Parse Error"
	}
	if res.TagName == "" {
		return "No tag found"
	}
	return res.TagName
}

func (a *App) UpdateKernel(mirrorUrl string) string {
	wasRunning := a.Running
	if wasRunning {
		a.stopCore()
		time.Sleep(1 * time.Second)
	}

	cwd, _ := os.Getwd()
	tmpFile := filepath.Join(cwd, "data", "core", "update.zip")
	defer func() {
		os.Remove(tmpFile)
	}()

	wailsRuntime.EventsEmit(a.ctx, "log", "Fetching release info...")
	resp, err := http.Get("https://api.github.com/repos/SagerNet/sing-box/releases/latest")
	if err != nil {
		return "Network Error"
	}
	defer resp.Body.Close()

	var res ReleaseInfo
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "Parse Error"
	}

	targetArch := runtime.GOARCH
	switch targetArch {
	case "amd64":
		targetArch = "windows-amd64"
	case "arm64":
		targetArch = "windows-arm64"
	default:
		return "Unsupported Arch: " + targetArch
	}

	var downloadUrl string
	for _, asset := range res.Assets {
		if strings.Contains(asset.Name, targetArch) && strings.HasSuffix(asset.Name, ".zip") {
			downloadUrl = asset.BrowserDownloadUrl
			break
		}
	}

	if downloadUrl == "" {
		return "No matching asset found"
	}

	if mirrorUrl != "" {
		if !strings.HasSuffix(mirrorUrl, "/") {
			mirrorUrl += "/"
		}
		downloadUrl = mirrorUrl + downloadUrl
	}

	wailsRuntime.EventsEmit(a.ctx, "log", "Downloading...")
	wailsRuntime.EventsEmit(a.ctx, "download-progress", 0)

	outResp, err := http.Get(downloadUrl)
	if err != nil {
		return "Download Fail"
	}
	defer outResp.Body.Close()

	os.MkdirAll(filepath.Join(cwd, "data", "core"), 0755)

	out, err := os.Create(tmpFile)
	if err != nil {
		return "Create File Fail"
	}

	counter := &WriteCounter{
		Total:   uint64(outResp.ContentLength),
		Current: 0,
		Ctx:     a.ctx,
	}

	if _, err = io.Copy(out, io.TeeReader(outResp.Body, counter)); err != nil {
		out.Close()
		return "Download Interrupted"
	}
	out.Close()

	wailsRuntime.EventsEmit(a.ctx, "log", "Extracting...")

	zipReader, err := zip.OpenReader(tmpFile)
	if err != nil {
		return "Zip Error"
	}
	defer zipReader.Close()

	foundExe := false
	for _, f := range zipReader.File {
		if strings.HasSuffix(f.Name, ".exe") && strings.Contains(filepath.Base(f.Name), "sing-box") {
			src, err := f.Open()
			if err != nil {
				continue
			}
			dstPath := filepath.Join(cwd, "data", "core", "sing-box.exe")
			dst, err := os.Create(dstPath)
			if err != nil {
				src.Close()
				continue
			}
			io.Copy(dst, src)
			src.Close()
			dst.Close()
			foundExe = true
			break
		}
	}

	if !foundExe {
		return "exe not found in zip"
	}

	if wasRunning {
		a.startCore()
		wailsRuntime.EventsEmit(a.ctx, "status", true)
	}

	return "Success"
}

func (a *App) OpenDashboard() {
	wailsRuntime.BrowserOpenURL(a.ctx, "http://127.0.0.1:9090/ui")
}

func (a *App) ToggleService() string {
	if a.Running {
		return a.stopCore()
	}
	return a.startCore()
}
