package internal

import (
	"os"
	"path/filepath"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ============================================================================
// Auto-Start Configuration
// ============================================================================

// configureAutoStartMode configures the mode for auto-start
func (a *App) configureAutoStartMode(meta *MetaData, mode string) {
	switch mode {
	case "tun":
		meta.TunMode = true
		meta.SysProxy = false
	case "proxy":
		meta.TunMode = false
		meta.SysProxy = true
	default: // "full"
		meta.TunMode = true
		meta.SysProxy = true
	}
}

// cleanSystemProxy cleans system proxy by temporarily starting with old config
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

// handleAutoStart handles the auto-start process
func (a *App) handleAutoStart(meta *MetaData, modeChanged, prevSysProxy, prevTunMode bool) {
	go func() {
		// Wait for window to be ready if starting minimized
		if a.startMinimized {
			time.Sleep(3 * time.Second)
		}

		// Clean system proxy if mode changed and proxy was enabled
		if modeChanged && prevSysProxy {
			a.cleanSystemProxy(meta, prevTunMode, prevSysProxy)
		}

		// Start core
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

// ============================================================================
// Core Service Control
// ============================================================================

// startCore starts the sing-box core process
func (a *App) startCore() string {
	meta, _ := a.storage.LoadMeta()

	activeProfilePath, err := a.findActiveProfilePath(meta)
	if err != nil {
		if err == os.ErrNotExist {
			a.appLogger.Error("No active profile selected")
			return "Error: No active profile selected"
		}
		a.appLogger.Error("Profile file missing")
		return "Error: Profile file missing"
	}

	a.appLogger.Info("Starting core...")
	err = a.coreManager.Start(
		activeProfilePath,
		meta.TunMode,
		meta.SysProxy,
		meta.TunConfig,
		meta.MixedConfig,
		meta.IPv6Enabled,
		meta.LogLevel,
		meta.LogToFile,
	)
	if err != nil {
		a.appLogger.Error("Core start failed: " + err.Error())
		return "Error: " + err.Error()
	}
	a.appLogger.Info("Core started successfully")
	go a.UpdateTrayIcon()
	return "Success"
}

// stopCore stops the sing-box core process
func (a *App) stopCore() string {
	a.appLogger.Info("Stopping core...")
	if err := a.coreManager.Stop(); err != nil {
		a.appLogger.Error("Core stop failed: " + err.Error())
		return "Error: " + err.Error()
	}
	a.appLogger.Info("Core stopped")
	go a.UpdateTrayIcon()
	return "Stopped"
}

// ============================================================================
// Frontend API - Service Control
// ============================================================================

// ApplyState applies the target TUN and proxy state
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

	// Stop if both disabled
	if !targetTun && !targetProxy {
		return a.stopCore()
	}

	// Restart if needed
	if needsRestart {
		if a.coreManager.IsRunning() {
			a.stopCore()
			time.Sleep(500 * time.Millisecond)
		}
		return a.startCore()
	}

	go a.UpdateTrayIcon()
	return "Success"
}

// ToggleService toggles the core service on/off
func (a *App) ToggleService() string {
	if a.coreManager.IsRunning() {
		return a.stopCore()
	}
	return a.startCore()
}

// ============================================================================
// Helper Methods
// ============================================================================

// findActiveProfilePath finds the path to the active profile
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

// emitStateSync emits state sync event to frontend
func (a *App) emitStateSync(meta *MetaData) {
	wailsRuntime.EventsEmit(a.ctx, "state-sync", map[string]interface{}{
		"tunMode":  meta.TunMode,
		"sysProxy": meta.SysProxy,
	})
}
