package internal

import (
	"os"
	"path/filepath"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

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

	apiURL := a.coreManager.GetAPIURL()
	if apiURL != "" {
		a.appLogger.Info("Starting traffic monitor with API: " + apiURL)
		if a.trafficMonitor == nil {
			a.trafficMonitor = NewTrafficMonitor(a.ctx, apiURL)
		}
		a.trafficMonitor.Start()
	} else {
		a.appLogger.Info("Clash API not configured, traffic monitoring disabled")
	}

	go a.UpdateTrayIcon()
	return "Success"
}

func (a *App) stopCore() string {
	if !a.coreManager.IsRunning() {
		return "Already stopped"
	}

	a.appLogger.Info("Stopping core...")

	if a.trafficMonitor != nil && a.trafficMonitor.IsRunning() {
		a.appLogger.Info("Stopping traffic monitor...")
		a.trafficMonitor.Stop()
	}

	if err := a.coreManager.Stop(); err != nil {
		a.appLogger.Error("Core stop failed: " + err.Error())
		return "Error: " + err.Error()
	}
	a.appLogger.Info("Core stopped")
	go a.UpdateTrayIcon()
	return "Stopped"
}

func (a *App) ApplyState(targetTun bool, targetProxy bool) string {
	meta, _ := a.storage.LoadMeta()

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

	go a.UpdateTrayIcon()
	return "Success"
}

func (a *App) ToggleService() string {
	if a.coreManager.IsRunning() {
		return a.stopCore()
	}
	return a.startCore()
}

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

func (a *App) emitStateSync(meta *MetaData) {
	wailsRuntime.EventsEmit(a.ctx, "state-sync", map[string]interface{}{
		"tunMode":  meta.TunMode,
		"sysProxy": meta.SysProxy,
	})
}
