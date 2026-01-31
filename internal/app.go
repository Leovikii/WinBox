package internal

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

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

	// Start new instance
	cmd := exec.Command(exe)
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
