package internal

import (
	"os"
	"path/filepath"
	"strings"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ============================================================================
// Profile Management API
// ============================================================================

// AddProfile adds a new profile
func (a *App) AddProfile(name, url string) string {
	if err := a.profileManager.Add(name, url); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

// DeleteProfile deletes a profile by ID
func (a *App) DeleteProfile(id string) {
	a.profileManager.Delete(id)
}

// SelectProfile selects a profile as active
func (a *App) SelectProfile(id string) string {
	if a.coreManager.IsRunning() {
		return "Stop service first"
	}
	if err := a.profileManager.Select(id); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

// UpdateActiveProfile updates the active profile from remote
func (a *App) UpdateActiveProfile() string {
	if err := a.profileManager.Update(); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

// EditProfile edits a profile's name and URL
func (a *App) EditProfile(id, name, url string) string {
	if err := a.profileManager.Edit(id, name, url); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

// ============================================================================
// Configuration Override API
// ============================================================================

// GetOverride gets the override configuration content
func (a *App) GetOverride(name string) string {
	result, _ := a.settingsManager.GetOverride(name)
	return result
}

// SaveOverride saves the override configuration
func (a *App) SaveOverride(name, content string) string {
	if err := a.settingsManager.SaveOverride(name, content); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

// ResetOverride resets the override configuration to default
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

// ============================================================================
// Settings API
// ============================================================================

// SaveSettings saves mirror settings
func (a *App) SaveSettings(mirror string, enabled bool) string {
	if err := a.settingsManager.SaveMirror(mirror, enabled); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

// SetStartOnBoot sets whether to start on boot
func (a *App) SetStartOnBoot(enabled bool) string {
	if err := a.settingsManager.SetStartOnBoot(enabled); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

// SetAutoConnect sets auto-connect on startup
func (a *App) SetAutoConnect(enabled bool, mode string) string {
	if err := a.settingsManager.SetAutoConnect(enabled, mode); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

// SaveTheme saves theme settings
func (a *App) SaveTheme(mode, accentColor string) string {
	if err := a.settingsManager.SaveTheme(mode, accentColor); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

// ToggleIPv6 toggles IPv6 support
func (a *App) ToggleIPv6(enabled bool) string {
	if err := a.settingsManager.SetIPv6Enabled(enabled); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

// SetLogConfig sets log configuration
func (a *App) SetLogConfig(level string, toFile bool) string {
	if err := a.settingsManager.SetLogConfig(level, toFile); err != nil {
		return "Error: " + err.Error()
	}
	return "Success"
}

// ============================================================================
// Log Management API
// ============================================================================

// GetLogFile gets the kernel log file content (deprecated, use GetKernelLog)
func (a *App) GetLogFile() string {
	coreDir := filepath.Join(a.getAppDir(), "data", "core")
	logPath := filepath.Join(coreDir, "box.log")

	content, err := os.ReadFile(logPath)
	if err != nil {
		return "No log file available"
	}

	return string(content)
}

// GetAppLog gets the application log content
func (a *App) GetAppLog() string {
	content := a.appLogger.GetLogs()
	// Limit to last 5000 lines to avoid performance issues
	return limitLogLines(content, 5000)
}

// GetKernelLog gets the kernel log content from real-time buffer
func (a *App) GetKernelLog() string {
	// Always use real-time buffer for immediate output
	if a.coreManager != nil {
		bufferContent := a.coreManager.GetLogBuffer()
		if bufferContent != "" {
			return bufferContent
		}
	}

	// If no logs available at all
	return "> No kernel logs available. Kernel may not be running."
}

// ClearAppLog clears the application log
func (a *App) ClearAppLog() string {
	if err := a.appLogger.Clear(); err != nil {
		return "Error: " + err.Error()
	}
	a.appLogger.Info("App log cleared")
	return "Success"
}

// ClearKernelLog clears the kernel log buffer and optionally the log file
func (a *App) ClearKernelLog() string {
	coreDir := filepath.Join(a.getAppDir(), "data", "core")
	logPath := filepath.Join(coreDir, "box.log")

	// Clear log file if it exists
	if _, err := os.Stat(logPath); err == nil {
		if err := os.WriteFile(logPath, []byte(""), 0644); err != nil {
			// Log the error but don't fail - buffer clearing is more important
			a.appLogger.Warn("Failed to clear kernel log file: " + err.Error())
		}
	}

	// Clear real-time buffer
	if a.coreManager != nil {
		a.coreManager.ClearLogBuffer()
	}

	a.appLogger.Info("Kernel log cleared")
	return "Success"
}

// ============================================================================
// Utility API
// ============================================================================

// OpenDashboard opens the sing-box dashboard in browser
func (a *App) OpenDashboard() {
	wailsRuntime.BrowserOpenURL(a.ctx, "http://127.0.0.1:9090/ui")
}

// RestartCore restarts the sing-box core process
func (a *App) RestartCore() string {
	if !a.coreManager.IsRunning() {
		return "Error: Core is not running"
	}

	a.appLogger.Info("Restarting core...")

	// Get current metadata to preserve state
	meta, err := a.storage.LoadMeta()
	if err != nil {
		return "Error: " + err.Error()
	}

	// Stop current core
	if err := a.coreManager.Stop(); err != nil {
		a.appLogger.Error("Core stop failed during restart: " + err.Error())
		return "Error: " + err.Error()
	}

	// Wait a moment for clean shutdown
	time.Sleep(500 * time.Millisecond)

	// Start core with previous settings
	result := a.startCore()
	if result != "Success" {
		a.appLogger.Error("Core start failed during restart: " + result)
		return result
	}

	// Emit status and state sync events to update frontend
	wailsRuntime.EventsEmit(a.ctx, "status", true)
	a.emitStateSync(meta)

	a.appLogger.Info("Core restarted successfully")
	go a.UpdateTrayIcon()
	return "Success"
}

// GetInitData returns initial data for frontend
func (a *App) GetInitData() map[string]interface{} {
	meta, _ := a.storage.LoadMeta()
	var active Profile
	for _, p := range meta.Profiles {
		if p.ID == meta.ActiveID {
			active = p
			break
		}
	}

	return map[string]interface{}{
		"running":           a.coreManager.IsRunning(),
		"coreExists":        a.coreManager.GetLocalVersion() != "Not Installed",
		"localVersion":      a.coreManager.GetLocalVersion(),
		"tunMode":           meta.TunMode,
		"sysProxy":          meta.SysProxy,
		"profiles":          meta.Profiles,
		"activeProfile":     active,
		"mirror":            meta.Mirror,
		"mirrorEnabled":     meta.MirrorEnabled,
		"startOnBoot":       meta.StartOnBoot,
		"autoConnect":       meta.AutoConnect,
		"autoConnectMode":   meta.AutoConnectMode,
		"themeMode":         meta.ThemeMode,
		"accentColor":       meta.AccentColor,
		"ipv6_enabled":      meta.IPv6Enabled,
		"log_level":         meta.LogLevel,
		"log_to_file":       meta.LogToFile,
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

// limitLogLines limits log content to the last N lines
func limitLogLines(content string, maxLines int) string {
	if content == "" {
		return content
	}

	lineCount := 0

	for i := len(content) - 1; i >= 0; i-- {
		if content[i] == '\n' {
			lineCount++
			if lineCount == maxLines {
				return content[i+1:]
			}
		}
	}

	return content
}

// ============================================================================
// UWP Loopback API
// ============================================================================

// GetUWPApps returns all UWP applications
func (a *App) GetUWPApps() []UWPApp {
	apps, err := a.uwpLoopbackManager.GetUWPApps()
	if err != nil {
		a.appLogger.Error("Failed to get UWP apps: " + err.Error())
		return []UWPApp{}
	}
	return apps
}

// SetUWPLoopbackExemptions sets UWP loopback exemptions
func (a *App) SetUWPLoopbackExemptions(selectedSIDs []string) string {
	apps, err := a.uwpLoopbackManager.GetUWPApps()
	if err != nil {
		return "Error: " + err.Error()
	}

	currentExemptMap := make(map[string]bool)
	for _, app := range apps {
		if app.IsExempt {
			currentExemptMap[app.SID] = true
		}
	}

	selectedMap := make(map[string]bool)
	for _, sid := range selectedSIDs {
		selectedMap[sid] = true
	}

	toAdd := make([]string, 0)
	for _, sid := range selectedSIDs {
		if !currentExemptMap[sid] {
			toAdd = append(toAdd, sid)
		}
	}

	toRemove := make([]string, 0)
	for sid := range currentExemptMap {
		if !selectedMap[sid] {
			toRemove = append(toRemove, sid)
		}
	}

	if len(toAdd) > 0 {
		if err := a.uwpLoopbackManager.AddLoopbackExempt(toAdd); err != nil {
			return "Error: " + err.Error()
		}
		a.appLogger.Info("Added UWP loopback exemptions: " + strings.Join(toAdd, ", "))
	}

	if len(toRemove) > 0 {
		if err := a.uwpLoopbackManager.RemoveLoopbackExempt(toRemove); err != nil {
			return "Error: " + err.Error()
		}
		a.appLogger.Info("Removed UWP loopback exemptions: " + strings.Join(toRemove, ", "))
	}

	return "Success"
}
