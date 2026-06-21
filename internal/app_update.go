package internal

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/energye/systray"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

var (
	// Version will be set at build time via ldflags
	Version = "dev"
)

func (a *App) GetLocalVersion() string {
	return a.coreManager.GetLocalVersion()
}

func (a *App) CheckUpdate() string {
	meta, err := a.storage.LoadMeta()
	preRelease := false
	if err == nil {
		preRelease = meta.PreRelease
	}

	version, err := a.httpClient.CheckUpdate(preRelease)
	if err != nil {
		return "Error: " + err.Error()
	}
	return version
}

func (a *App) UpdateKernel(mirrorUrl string) string {
	// 1. Download first (core still running, proxy network available)
	appDir := a.getAppDir()
	coreDir := filepath.Join(appDir, "data", "core")

	tmpFile, err := a.downloadKernelRelease(mirrorUrl)
	if err != nil {
		if err == os.ErrNotExist {
			return "No matching asset found"
		}
		return "Download Fail"
	}
	defer os.Remove(tmpFile)

	// 2. Stop core after download succeeds
	wasRunning := a.coreManager.IsRunning()
	if wasRunning {
		wailsRuntime.EventsEmit(a.ctx, "log", "Stopping core for update...")
		a.stopCore()
		time.Sleep(1 * time.Second)
	}

	// 3. Extract and replace
	if err := a.extractKernelFromZip(tmpFile, coreDir); err != nil {
		if wasRunning {
			a.startCore()
			meta, _ := a.storage.LoadMeta()
			wailsRuntime.EventsEmit(a.ctx, "status", true)
			a.emitStateSync(meta)
		}
		return "exe not found in zip"
	}

	wailsRuntime.EventsEmit(a.ctx, "log", "Update Complete")

	// 4. Restart core and sync UI state
	if wasRunning {
		time.Sleep(500 * time.Millisecond)
		if res := a.startCore(); res == "Success" {
			meta, _ := a.storage.LoadMeta()
			wailsRuntime.EventsEmit(a.ctx, "status", true)
			a.emitStateSync(meta)
		}
	}

	return "Success"
}

func (a *App) downloadKernelRelease(mirrorUrl string) (string, error) {
	appDir := a.getAppDir()
	coreDir := filepath.Join(appDir, "data", "core")
	tmpFile := filepath.Join(coreDir, "update.zip")

	wailsRuntime.EventsEmit(a.ctx, "log", "Fetching release info...")

	meta, err := a.storage.LoadMeta()
	preRelease := false
	if err == nil {
		preRelease = meta.PreRelease
	}

	res, err := a.httpClient.GetLatestRelease("https://api.github.com/repos/SagerNet/sing-box", preRelease)
	if err != nil {
		return "", err
	}

	targetArch := "windows-" + runtime.GOARCH

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

func (a *App) GetProgramVersion() string {
	return Version
}

func (a *App) CheckProgramUpdate() string {
	meta, err := a.storage.LoadMeta()
	preRelease := false
	if err == nil {
		preRelease = meta.PreRelease
	}

	res, err := a.httpClient.GetLatestRelease("https://api.github.com/repos/Leovikii/WinBox", preRelease)
	if err != nil {
		return "Error: " + err.Error()
	}

	if res.TagName == "" {
		return "Error: No tag found"
	}

	return res.TagName
}

func (a *App) UpdateProgram(mirrorUrl string) string {
	exe, err := os.Executable()
	if err != nil {
		return "Error: Cannot get executable path"
	}
	exeDir := filepath.Dir(exe)

	wailsRuntime.EventsEmit(a.ctx, "log", "Fetching WinBox release info...")
	
	meta, err := a.storage.LoadMeta()
	preRelease := false
	if err == nil {
		preRelease = meta.PreRelease
	}

	res, err := a.httpClient.GetLatestRelease("https://api.github.com/repos/Leovikii/WinBox", preRelease)
	if err != nil {
		return "Error: " + err.Error()
	}

	targetArch := runtime.GOOS + "-" + runtime.GOARCH

	var downloadUrl string
	for _, asset := range res.Assets {
		if strings.Contains(asset.Name, targetArch) && strings.HasSuffix(asset.Name, ".zip") {
			downloadUrl = asset.BrowserDownloadUrl
			break
		}
	}

	if downloadUrl == "" {
		return "Error: No matching asset found"
	}

	if mirrorUrl != "" {
		if !strings.HasSuffix(mirrorUrl, "/") {
			mirrorUrl += "/"
		}
		downloadUrl = mirrorUrl + downloadUrl
	}

	zipPath := filepath.Join(exeDir, "WinBox-update.zip")
	newExePath := filepath.Join(exeDir, "WinBox.exe.new")

	wailsRuntime.EventsEmit(a.ctx, "log", "Downloading WinBox update...")
	wailsRuntime.EventsEmit(a.ctx, "download-progress", 0)

	if err := a.httpClient.Download(downloadUrl, zipPath, a.ctx); err != nil {
		return "Error: Download failed"
	}
	defer os.Remove(zipPath)

	if err := a.extractProgramFromZip(zipPath, newExePath); err != nil {
		return "Error: Extraction failed"
	}

	wailsRuntime.EventsEmit(a.ctx, "log", "Update ready. Restarting...")

	go func() {
		time.Sleep(500 * time.Millisecond)
		a.launchUpdaterAndRestart(newExePath)
	}()

	return "Success"
}

func (a *App) extractProgramFromZip(zipPath, targetPath string) error {
	wailsRuntime.EventsEmit(a.ctx, "log", "Extracting WinBox update...")

	zipReader, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer zipReader.Close()

	expectedExe := "WinBox.exe"
	if runtime.GOOS != "windows" {
		expectedExe = "WinBox"
	}

	for _, f := range zipReader.File {
		if strings.HasSuffix(f.Name, expectedExe) {
			src, err := f.Open()
			if err != nil {
				return err
			}
			dst, err := os.Create(targetPath)
			if err != nil {
				src.Close()
				return err
			}
			_, err = io.Copy(dst, src)
			src.Close()
			dst.Close()
			if err != nil {
				return err
			}
			return nil
		}
	}

	return os.ErrNotExist
}

func (a *App) launchUpdaterAndRestart(newExePath string) {
	exe, _ := os.Executable()

	if runtime.GOOS == "windows" {
		psCommand := fmt.Sprintf(
			"Start-Sleep -Seconds 2; "+
				"Remove-Item '%s' -Force; "+
				"Rename-Item '%s' 'WinBox.exe'; "+
				"Start-Process '%s'",
			exe, newExePath, exe,
		)
		cmd := exec.Command("powershell", "-WindowStyle", "Hidden", "-Command", psCommand)
		cmd.Start()
	} else {
		shCommand := fmt.Sprintf(
			"sleep 2; rm -f '%s'; mv '%s' '%s'; chmod +x '%s'; '%s' &",
			exe, newExePath, exe, exe, exe,
		)
		cmd := exec.Command("sh", "-c", shCommand)
		cmd.Start()
	}

	time.Sleep(300 * time.Millisecond)
	systray.Quit()
	wailsRuntime.Quit(a.ctx)
}
