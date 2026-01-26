package internal

import (
	"archive/zip"
	"context"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/energye/systray"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx             context.Context
	coreManager     *CoreManager
	profileManager  *ProfileManager
	settingsManager *SettingsManager
	storage         *Storage
	httpClient      *HTTPClient
	iconData        []byte
	startMinimized  bool
}

// NewApp creates a new App application struct
func NewApp(icon []byte, startMinimized bool) *App {
	return &App{
		iconData:       icon,
		startMinimized: startMinimized,
	}
}

func (a *App) getAppDir() string {
	exe, err := os.Executable()
	if err != nil {
		wd, _ := os.Getwd()
		return wd
	}
	return filepath.Dir(exe)
}

// Helper: Configure auto-start mode settings
func (a *App) configureAutoStartMode(meta *MetaData, mode string) {
	switch mode {
	case "tun":
		meta.TunMode = true
		meta.SysProxy = false
	case "proxy":
		meta.TunMode = false
		meta.SysProxy = true
	default:
		meta.TunMode = true
		meta.SysProxy = true
	}
}

// Helper: Clean system proxy by temporarily starting with old config
func (a *App) cleanSystemProxy(meta *MetaData, prevTunMode, prevSysProxy bool) {
	tempMeta := *meta
	tempMeta.TunMode = prevTunMode
	tempMeta.SysProxy = prevSysProxy
	a.storage.SaveMeta(&tempMeta)

	a.startCore()
	time.Sleep(500 * time.Millisecond)
	a.stopCore()
	time.Sleep(500 * time.Millisecond)

	a.storage.SaveMeta(meta)
}

// Helper: Handle auto-start process
func (a *App) handleAutoStart(meta *MetaData, modeChanged, prevSysProxy, prevTunMode bool) {
	go func() {
		if a.startMinimized {
			time.Sleep(3 * time.Second)
		}

		if modeChanged && prevSysProxy {
			a.cleanSystemProxy(meta, prevTunMode, prevSysProxy)
		}

		if res := a.startCore(); res == "Success" {
			meta, _ := a.storage.LoadMeta()
			wailsRuntime.EventsEmit(a.ctx, "status", true)
			a.emitStateSync(meta)
		} else {
			wailsRuntime.EventsEmit(a.ctx, "status", false)
			wailsRuntime.EventsEmit(a.ctx, "log", "AutoStart Failed: "+res)
		}
	}()
}

// Startup is called when the app starts
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	appDir := a.getAppDir()

	// Set window rounded corners for Windows 11
	if runtime.GOOS == "windows" {
		go func() {
			time.Sleep(100 * time.Millisecond)
			if hwnd, err := GetWindowHandle("WinBox"); err == nil && hwnd != 0 {
				SetWindowCorners(hwnd)
			}
		}()
	}

	// Initialize managers
	a.httpClient = NewHTTPClient()
	a.storage = NewStorage(filepath.Join(appDir, "data", "meta.json"))
	a.coreManager = NewCoreManager(appDir, ctx)
	a.profileManager = NewProfileManager(a.storage, a.httpClient, appDir)
	a.settingsManager = NewSettingsManager(a.storage)

	// Clean up any residual processes/network configs from previous session
	a.stopCore()

	// Create directories
	coreDir := filepath.Join(appDir, "data", "core")
	profilesDir := filepath.Join(appDir, "data", "profiles")
	os.MkdirAll(coreDir, 0755)
	os.MkdirAll(profilesDir, 0755)

	meta, _ := a.storage.LoadMeta()
	prevTunMode := meta.TunMode
	prevSysProxy := meta.SysProxy

	// Check if can auto start
	coreExe := filepath.Join(coreDir, "sing-box.exe")
	kernelExists := true
	if _, err := os.Stat(coreExe); os.IsNotExist(err) {
		kernelExists = false
	}

	profileExists := false
	if meta.ActiveID != "" {
		if _, err := a.findActiveProfilePath(meta); err == nil {
			profileExists = true
		}
	}

	canAutoStart := kernelExists && profileExists && meta.AutoConnect

	if canAutoStart {
		a.configureAutoStartMode(meta, meta.AutoConnectMode)
	} else {
		meta.TunMode = false
		meta.SysProxy = false
	}

	modeChanged := (prevSysProxy && !meta.SysProxy) || (prevTunMode && !meta.TunMode)
	a.storage.SaveMeta(meta)

	a.StartTray()

	if a.startMinimized {
		go func() {
			time.Sleep(500 * time.Millisecond)
			wailsRuntime.WindowHide(a.ctx)
		}()
	}

	if canAutoStart {
		a.handleAutoStart(meta, modeChanged, prevSysProxy, prevTunMode)
	} else {
		if modeChanged && prevSysProxy {
			go func() {
				time.Sleep(1 * time.Second)
				tempMeta := *meta
				tempMeta.SysProxy = true
				a.storage.SaveMeta(&tempMeta)
				a.startCore()
				time.Sleep(500 * time.Millisecond)
				a.stopCore()
				a.storage.SaveMeta(meta)
			}()
		}
		wailsRuntime.EventsEmit(a.ctx, "status", false)
	}
}

func (a *App) OnShutdown(ctx context.Context) {
	a.stopCore()
}

// StartTray starts the system tray
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

func (a *App) Quit() {
	a.stopCore()
	wailsRuntime.Quit(a.ctx)
}

// Helper: Find active profile path
func (a *App) findActiveProfilePath(meta *MetaData) (string, error) {
	for _, p := range meta.Profiles {
		if p.ID == meta.ActiveID {
			profilePath := filepath.Join(a.getAppDir(), "data", "profiles", p.ID+".json")
			if _, err := os.Stat(profilePath); os.IsNotExist(err) {
				return "", os.ErrNotExist
			}
			return profilePath, nil
		}
	}
	return "", os.ErrNotExist
}

// Helper: Emit state sync event
func (a *App) emitStateSync(meta *MetaData) {
	wailsRuntime.EventsEmit(a.ctx, "state-sync", map[string]interface{}{
		"tunMode":  meta.TunMode,
		"sysProxy": meta.SysProxy,
	})
}

// Core management methods
func (a *App) startCore() string {
	meta, _ := a.storage.LoadMeta()

	activeProfilePath, err := a.findActiveProfilePath(meta)
	if err != nil {
		if err == os.ErrNotExist {
			return "Error: No active profile selected"
		}
		return "Error: Profile file missing"
	}

	err = a.coreManager.Start(activeProfilePath, meta.TunMode, meta.SysProxy, meta.TunConfig, meta.MixedConfig)
	if err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

func (a *App) stopCore() string {
	if err := a.coreManager.Stop(); err != nil {
		return "Error: " + err.Error()
	}
	return "Stopped"
}

// Frontend interface methods - Profile management
func (a *App) AddProfile(name, url string) string {
	if err := a.profileManager.Add(name, url); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

func (a *App) DeleteProfile(id string) {
	a.profileManager.Delete(id)
}

func (a *App) SelectProfile(id string) string {
	if a.coreManager.IsRunning() {
		return "Stop service first"
	}
	if err := a.profileManager.Select(id); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

func (a *App) UpdateActiveProfile() string {
	if err := a.profileManager.Update(); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

func (a *App) EditProfile(id, name, url string) string {
	if err := a.profileManager.Edit(id, name, url); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

// Frontend interface methods - Settings
func (a *App) GetOverride(name string) string {
	result, _ := a.settingsManager.GetOverride(name)
	return result
}

func (a *App) SaveOverride(name, content string) string {
	if err := a.settingsManager.SaveOverride(name, content); err != nil {
		return "Error: " + err.Error()
	}
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

func (a *App) SaveSettings(mirror string, enabled bool) string {
	if err := a.settingsManager.SaveMirror(mirror, enabled); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

func (a *App) SetStartOnBoot(enabled bool) string {
	if err := a.settingsManager.SetStartOnBoot(enabled); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

func (a *App) SetAutoConnect(enabled bool, mode string) string {
	if err := a.settingsManager.SetAutoConnect(enabled, mode); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

func (a *App) SaveTheme(mode, accentColor string) string {
	if err := a.settingsManager.SaveTheme(mode, accentColor); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

// Frontend interface methods - State management
func (a *App) ApplyState(targetTun bool, targetProxy bool) string {
	meta, _ := a.storage.LoadMeta()

	// Check if active profile exists before attempting to start
	if targetTun || targetProxy {
		if _, err := a.findActiveProfilePath(meta); err != nil {
			return "config-missing"
		}
	}

	needsRestart := (meta.TunMode != targetTun) || (meta.SysProxy != targetProxy)
	if !a.coreManager.IsRunning() {
		needsRestart = true
	}

	meta.TunMode = targetTun
	meta.SysProxy = targetProxy
	a.storage.SaveMeta(meta)

	if !targetTun && !targetProxy {
		return a.stopCore()
	}

	if needsRestart {
		if a.coreManager.IsRunning() {
			a.stopCore()
			time.Sleep(500 * time.Millisecond)
		}
		return a.startCore()
	}

	return "Success"
}

func (a *App) ToggleService() string {
	if a.coreManager.IsRunning() {
		return a.stopCore()
	}
	return a.startCore()
}

func (a *App) GetInitData() map[string]interface{} {
	meta, _ := a.storage.LoadMeta()
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
		"running":         a.coreManager.IsRunning(),
		"activeProfile":   active,
		"profiles":        meta.Profiles,
		"coreExists":      core,
		"localVersion":    local,
		"mirror":          meta.Mirror,
		"mirrorEnabled":   meta.MirrorEnabled,
		"tunMode":         meta.TunMode,
		"sysProxy":        meta.SysProxy,
		"startOnBoot":     meta.StartOnBoot,
		"autoConnect":     meta.AutoConnect,
		"autoConnectMode": meta.AutoConnectMode,
		"theme_mode":      meta.ThemeMode,
		"accent_color":    meta.AccentColor,
	}
}

func (a *App) GetLocalVersion() string {
	return a.coreManager.GetLocalVersion()
}

func (a *App) CheckUpdate() string {
	version, err := a.httpClient.CheckUpdate()
	if err != nil {
		return "Error: " + err.Error()
	}
	return version
}

func (a *App) OpenDashboard() {
	wailsRuntime.BrowserOpenURL(a.ctx, "http://127.0.0.1:9090/ui")
}

// Helper: Download kernel release from GitHub
func (a *App) downloadKernelRelease(mirrorUrl string) (string, error) {
	appDir := a.getAppDir()
	coreDir := filepath.Join(appDir, "data", "core")
	tmpFile := filepath.Join(coreDir, "update.zip")

	wailsRuntime.EventsEmit(a.ctx, "log", "Fetching release info...")
	resp, err := a.httpClient.Get("https://api.github.com/repos/SagerNet/sing-box/releases/latest")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var res ReleaseInfo
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}

	targetArch := runtime.GOARCH
	switch targetArch {
	case "amd64":
		targetArch = "windows-amd64"
	case "arm64":
		targetArch = "windows-arm64"
	default:
		return "", os.ErrInvalid
	}

	var downloadUrl string
	for _, asset := range res.Assets {
		if strings.Contains(asset.Name, targetArch) && strings.HasSuffix(asset.Name, ".zip") {
			downloadUrl = asset.BrowserDownloadUrl
			break
		}
	}

	if downloadUrl == "" {
		return "", os.ErrNotExist
	}

	if mirrorUrl != "" {
		if !strings.HasSuffix(mirrorUrl, "/") {
			mirrorUrl += "/"
		}
		downloadUrl = mirrorUrl + downloadUrl
	}

	wailsRuntime.EventsEmit(a.ctx, "log", "Downloading...")
	wailsRuntime.EventsEmit(a.ctx, "download-progress", 0)

	if err := a.httpClient.Download(downloadUrl, tmpFile, a.ctx); err != nil {
		return "", err
	}

	return tmpFile, nil
}

// Helper: Extract kernel executable from zip file
func (a *App) extractKernelFromZip(zipPath, targetDir string) error {
	wailsRuntime.EventsEmit(a.ctx, "log", "Extracting...")

	zipReader, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer zipReader.Close()

	for _, f := range zipReader.File {
		if strings.HasSuffix(f.Name, ".exe") && strings.Contains(filepath.Base(f.Name), "sing-box") {
			src, err := f.Open()
			if err != nil {
				continue
			}
			dstPath := filepath.Join(targetDir, "sing-box.exe")
			dst, err := os.Create(dstPath)
			if err != nil {
				src.Close()
				continue
			}
			io.Copy(dst, src)
			src.Close()
			dst.Close()
			return nil
		}
	}

	return os.ErrNotExist
}

func (a *App) UpdateKernel(mirrorUrl string) string {
	wasRunning := a.coreManager.IsRunning()
	if wasRunning {
		a.stopCore()
		time.Sleep(1 * time.Second)
	}

	appDir := a.getAppDir()
	coreDir := filepath.Join(appDir, "data", "core")

	tmpFile, err := a.downloadKernelRelease(mirrorUrl)
	if err != nil {
		if err == os.ErrInvalid {
			return "Unsupported Arch: " + runtime.GOARCH
		}
		if err == os.ErrNotExist {
			return "No matching asset found"
		}
		return "Download Fail"
	}
	defer os.Remove(tmpFile)

	if err := a.extractKernelFromZip(tmpFile, coreDir); err != nil {
		return "exe not found in zip"
	}

	if wasRunning {
		a.startCore()
		meta, _ := a.storage.LoadMeta()
		wailsRuntime.EventsEmit(a.ctx, "status", true)
		a.emitStateSync(meta)
	}

	return "Success"
}
