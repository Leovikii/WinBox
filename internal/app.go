package internal

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"
	"net/http"

	"github.com/energye/systray"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ============================================================================
// App Structure
// ============================================================================

// TrayIcons holds all tray icon data
type TrayIcons struct {
	Default []byte
	Tun     []byte
	Proxy   []byte
	Full    []byte
}

// TrayMenu holds references to the tray menu items
type TrayMenu struct {
	ModeFull  *systray.MenuItem
	ModeTun   *systray.MenuItem
	ModeProxy *systray.MenuItem
	Stop      *systray.MenuItem
}

// App struct represents the main application
type App struct {
	ctx                context.Context
	coreManager        *CoreManager
	trafficMonitor     *TrafficMonitor
	profileManager     *ProfileManager
	settingsManager    *SettingsManager
	uwpLoopbackManager *UWPLoopbackManager
	storage            *Storage
	httpClient         *HTTPClient
	appLogger          *AppLogger
	iconData           []byte
	trayIcons          *TrayIcons
	trayMenu           *TrayMenu
	startMinimized     bool
}

// NewApp creates a new App application struct
func NewApp(icon []byte, trayDefault, trayTun, trayProxy, trayFull []byte, startMinimized bool) *App {
	return &App{
		iconData: icon,
		trayIcons: &TrayIcons{
			Default: trayDefault,
			Tun:     trayTun,
			Proxy:   trayProxy,
			Full:    trayFull,
		},
		startMinimized: startMinimized,
	}
}

// ============================================================================
// Lifecycle Methods
// ============================================================================

// Startup is called when the app starts
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	appDir := a.getAppDir()

	// Set window rounded corners for Windows 11
	go func() {
		time.Sleep(100 * time.Millisecond)
		if hwnd, err := GetWindowHandle("WinBox"); err == nil && hwnd != 0 {
			SetWindowCorners(hwnd)
		}
	}()

	// Initialize managers
	a.httpClient = NewHTTPClient()
	a.storage = NewStorage(filepath.Join(appDir, "data", "meta.json"))
	a.coreManager = NewCoreManager(appDir, ctx)
	a.profileManager = NewProfileManager(a.storage, a.httpClient, appDir)
	a.settingsManager = NewSettingsManager(a.storage)
	a.uwpLoopbackManager = NewUWPLoopbackManager()
	a.appLogger = NewAppLogger(appDir)

	// Clear previous session's logs
	a.appLogger.Clear()
	kernelLogPath := filepath.Join(appDir, "data", "core", "box.log")
	os.WriteFile(kernelLogPath, []byte(""), 0644)

	a.appLogger.Info("Application started")
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

	canAutoStart := false
	if kernelExists && profileExists && meta.AutoConnectState != "off" {
		canAutoStart = true
	}

	if canAutoStart {
		a.configureAutoStartMode(meta, meta.AutoConnectMode)
	} else {
		meta.TunMode = false
		meta.SysProxy = false
	}

	modeChanged := (prevSysProxy && !meta.SysProxy) || (prevTunMode && !meta.TunMode)
	a.storage.SaveMeta(meta)

	a.StartTray()

	go func() {
		time.Sleep(200 * time.Millisecond)
		a.UpdateTrayIcon()
	}()

	if a.startMinimized {
		go func() {
			time.Sleep(500 * time.Millisecond)
			wailsRuntime.WindowHide(a.ctx)
		}()
	}

	if canAutoStart {
		if meta.AutoConnectState == "smart" {
			go a.smartAutoStart(meta, modeChanged, prevSysProxy, prevTunMode)
		} else {
			a.handleAutoStart(meta, modeChanged, prevSysProxy, prevTunMode)
		}
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

// OnShutdown is called when the app is shutting down
func (a *App) OnShutdown(ctx context.Context) {
	a.stopCore()
	a.appLogger.Info("Application shutdown")
}

// Quit quits the application
func (a *App) Quit() {
	// OnShutdown will be called automatically by Wails, which handles stopCore()
	wailsRuntime.Quit(a.ctx)
}

// Restart restarts the application
func (a *App) Restart() {
	exe, err := os.Executable()
	if err != nil {
		a.Quit()
		return
	}

	// Use PowerShell to wait for current process to exit, then launch new instance
	psCommand := fmt.Sprintf(
		"$p = Get-Process -Id %d -ErrorAction SilentlyContinue; "+
			"if ($p) { $p.WaitForExit(5000) }; "+
			"Start-Process '%s'",
		os.Getpid(), exe,
	)
	cmd := exec.Command("powershell", "-WindowStyle", "Hidden", "-Command", psCommand)
	cmd.Start()

	// Quit current instance (OnShutdown will handle stopCore)
	systray.Quit()
	wailsRuntime.Quit(a.ctx)
}

// ============================================================================
// Helper Methods
// ============================================================================

// getAppDir returns the application directory
func (a *App) getAppDir() string {
	exe, err := os.Executable()
	if err != nil {
		wd, _ := os.Getwd()
		return wd
	}
	return filepath.Dir(exe)
}

// ============================================================================
// Smart Auto Start Logic
// ============================================================================

func (a *App) smartAutoStart(meta *MetaData, modeChanged, prevSysProxy, prevTunMode bool) {
	// Give the system some time to prepare before starting the checks
	time.Sleep(3 * time.Second)
	
	a.appLogger.Info("Smart Detect: Waiting for network connection...")
	wailsRuntime.EventsEmit(a.ctx, "log", "DETECTING")
	
	maxRetries := 15 // 15 retries * 2 seconds wait = ~30 seconds max
	networkReady := false
	
	client := &http.Client{Timeout: 2 * time.Second}
	
	for i := 0; i < maxRetries; i++ {
		if a.checkBasicNetwork(client) {
			networkReady = true
			break
		}
		time.Sleep(2 * time.Second)
	}

	if !networkReady {
		a.appLogger.Warn("Smart Detect: Network not ready after 30 seconds. Fallback: Aborting auto-start.")
		wailsRuntime.EventsEmit(a.ctx, "log", "NET TIMEOUT")
		wailsRuntime.EventsEmit(a.ctx, "status", false)
		return
	}

	a.appLogger.Info("Smart Detect: Network is ready. Checking proxy environment...")
	
	// Step 2: Check Google 204 to determine if we are already in a proxy environment
	isProxyEnv := false
	resp, err := client.Get("http://clients3.google.com/generate_204")
	if err == nil && resp.StatusCode == 204 {
		isProxyEnv = true
		a.appLogger.Info("Smart Detect: Google 204 returned successfully. Proxy environment confirmed.")
	} else {
		a.appLogger.Info("Smart Detect: Google 204 failed. Proceeding with normal connection.")
	}
	
	if isProxyEnv {
		a.appLogger.Info("Smart Detect: Transparent proxy environment detected. Skipping auto-start.")
		wailsRuntime.EventsEmit(a.ctx, "log", "STANDBY")
		wailsRuntime.EventsEmit(a.ctx, "status", false)
	} else {
		a.appLogger.Info("Smart Detect: No proxy environment detected. Starting core...")
		wailsRuntime.EventsEmit(a.ctx, "log", "STARTING...")
		a.handleAutoStart(meta, modeChanged, prevSysProxy, prevTunMode)
	}
}

func (a *App) checkBasicNetwork(client *http.Client) bool {
	// Request Microsoft Captive Portal 204 endpoint as the reliable basic network test
	resp, err := client.Get("http://edge.microsoft.com/captiveportal/generate_204")
	if err == nil {
		defer resp.Body.Close()
		// Captive portals may return 200 instead of 204. Any successful response means basic network is up.
		if resp.StatusCode == 204 || resp.StatusCode == 200 {
			return true
		}
	}
	return false
}
