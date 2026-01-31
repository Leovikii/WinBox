package internal

import (
	"archive/zip"
	"encoding/json"
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

// ============================================================================
// Kernel Update
// ============================================================================

// GetLocalVersion returns the local sing-box kernel version
func (a *App) GetLocalVersion() string {
	return a.coreManager.GetLocalVersion()
}

// CheckUpdate checks for kernel updates from GitHub
func (a *App) CheckUpdate() string {
	version, err := a.httpClient.CheckUpdate()
	if err != nil {
		return "Error: " + err.Error()
	}
	return version
}

// UpdateKernel updates the sing-box kernel
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

	wailsRuntime.EventsEmit(a.ctx, "log", "Update Complete")

	if wasRunning {
		time.Sleep(500 * time.Millisecond)
		a.startCore()
	}

	return "Success"
}

// downloadKernelRelease downloads kernel release from GitHub
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

// extractKernelFromZip extracts kernel executable from zip file
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

// ============================================================================
// Program Update
// ============================================================================

// GetProgramVersion returns the current program version
func (a *App) GetProgramVersion() string {
	return "2.5.1"
}

// CheckProgramUpdate checks for program updates from GitHub
func (a *App) CheckProgramUpdate() string {
	resp, err := a.httpClient.Get("https://api.github.com/repos/Leovikii/WinBox/releases/latest")
	if err != nil {
		return "Error: " + err.Error()
	}
	defer resp.Body.Close()

	var res ReleaseInfo
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "Error: Parse failed"
	}

	if res.TagName == "" {
		return "Error: No tag found"
	}

	return res.TagName
}

// UpdateProgram updates the WinBox program
func (a *App) UpdateProgram(mirrorUrl string) string {
	exe, err := os.Executable()
	if err != nil {
		return "Error: Cannot get executable path"
	}
	exeDir := filepath.Dir(exe)

	wailsRuntime.EventsEmit(a.ctx, "log", "Fetching WinBox release info...")
	resp, err := a.httpClient.Get("https://api.github.com/repos/Leovikii/WinBox/releases/latest")
	if err != nil {
		return "Error: " + err.Error()
	}
	defer resp.Body.Close()

	var res ReleaseInfo
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "Error: Parse failed"
	}

	version := strings.TrimPrefix(res.TagName, "v")
	version = strings.TrimPrefix(version, "V")
	downloadUrl := fmt.Sprintf("https://github.com/Leovikii/WinBox/releases/download/V%s/WinBox.exe", version)

	if mirrorUrl != "" {
		if !strings.HasSuffix(mirrorUrl, "/") {
			mirrorUrl += "/"
		}
		downloadUrl = mirrorUrl + downloadUrl
	}

	newExePath := filepath.Join(exeDir, "WinBox.exe.new")
	wailsRuntime.EventsEmit(a.ctx, "log", "Downloading WinBox update...")
	wailsRuntime.EventsEmit(a.ctx, "download-progress", 0)

	if err := a.httpClient.Download(downloadUrl, newExePath, a.ctx); err != nil {
		return "Error: Download failed"
	}

	wailsRuntime.EventsEmit(a.ctx, "log", "Update ready. Restarting...")

	go func() {
		time.Sleep(500 * time.Millisecond)
		a.launchUpdaterAndRestart(newExePath)
	}()

	return "Success"
}

// launchUpdaterAndRestart launches PowerShell updater and restarts the app
func (a *App) launchUpdaterAndRestart(newExePath string) {
	exe, _ := os.Executable()

	psCommand := fmt.Sprintf(
		"Start-Sleep -Seconds 2; "+
			"Remove-Item '%s' -Force; "+
			"Rename-Item '%s' 'WinBox.exe'; "+
			"Start-Process '%s'",
		exe, newExePath, exe,
	)

	cmd := exec.Command("powershell", "-WindowStyle", "Hidden", "-Command", psCommand)
	cmd.Start()

	// OnShutdown will handle stopCore when Quit is called
	time.Sleep(300 * time.Millisecond)
	systray.Quit()
	wailsRuntime.Quit(a.ctx)
}
