package internal

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// SettingsManager manages application settings
type SettingsManager struct {
	storage *Storage
}

// NewSettingsManager creates a new settings manager
func NewSettingsManager(storage *Storage) *SettingsManager {
	return &SettingsManager{
		storage: storage,
	}
}

// SaveMirror saves mirror settings
func (sm *SettingsManager) SaveMirror(mirror string, enabled bool) error {
	meta, err := sm.storage.LoadMeta()
	if err != nil {
		return err
	}

	meta.Mirror = mirror
	meta.MirrorEnabled = enabled

	return sm.storage.SaveMeta(meta)
}

// SetStartOnBoot sets start on boot
func (sm *SettingsManager) SetStartOnBoot(enabled bool) error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	taskName := "WinBoxAutostart"

	if enabled {
		taskXML := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <Delay>PT30S</Delay>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>%s</Command>
      <Arguments>-minimized</Arguments>
    </Exec>
  </Actions>
</Task>`, exePath)

		// Write XML to temp file
		tmpDir := filepath.Dir(exePath)
		xmlPath := filepath.Join(tmpDir, "task.xml")
		if err := os.WriteFile(xmlPath, []byte(taskXML), 0644); err != nil {
			return fmt.Errorf("failed to write task XML: %w", err)
		}
		defer os.Remove(xmlPath)

		cmd := exec.Command("schtasks", "/Create", "/TN", taskName, "/XML", xmlPath, "/F")
		SetCmdWindowHidden(cmd)
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("task schedule failed: %s", string(output))
		}
	} else {
		cmd := exec.Command("schtasks", "/Delete", "/TN", taskName, "/F")
		SetCmdWindowHidden(cmd)
		cmd.Run()
	}

	meta, err := sm.storage.LoadMeta()
	if err != nil {
		return err
	}

	meta.StartOnBoot = enabled
	return sm.storage.SaveMeta(meta)
}

// SetAutoConnect sets auto connect settings
func (sm *SettingsManager) SetAutoConnect(state string) error {
	meta, err := sm.storage.LoadMeta()
	if err != nil {
		return err
	}

	meta.AutoConnectState = state

	return sm.storage.SaveMeta(meta)
}

// GetOverride gets override configuration
func (sm *SettingsManager) GetOverride(name string) (string, error) {
	meta, err := sm.storage.LoadMeta()
	if err != nil {
		return "", err
	}

	switch name {
	case "tun":
		return meta.TunConfig, nil
	case "mixed":
		return meta.MixedConfig, nil
	default:
		return "{}", nil
	}
}

// SaveOverride saves override configuration
func (sm *SettingsManager) SaveOverride(name, content string) error {
	if !json.Valid([]byte(content)) {
		return fmt.Errorf("invalid JSON")
	}

	meta, err := sm.storage.LoadMeta()
	if err != nil {
		return err
	}

	switch name {
	case "tun":
		meta.TunConfig = content
	case "mixed":
		meta.MixedConfig = content
	default:
		return fmt.Errorf("unknown type")
	}

	return sm.storage.SaveMeta(meta)
}

// SaveMode saves the run mode configuration
func (sm *SettingsManager) SaveMode(tunMode, sysProxy bool) error {
	meta, err := sm.storage.LoadMeta()
	if err != nil {
		return err
	}

	meta.TunMode = tunMode
	meta.SysProxy = sysProxy

	return sm.storage.SaveMeta(meta)
}

// SaveTheme saves theme settings
func (sm *SettingsManager) SaveTheme(mode, accentColor string) error {
	meta, err := sm.storage.LoadMeta()
	if err != nil {
		return err
	}

	meta.ThemeMode = mode
	meta.AccentColor = accentColor

	return sm.storage.SaveMeta(meta)
}

// SetIPv6Enabled sets IPv6 support (dynamic injection happens in processConfig)
func (sm *SettingsManager) SetIPv6Enabled(enabled bool) error {
	meta, err := sm.storage.LoadMeta()
	if err != nil {
		return err
	}

	meta.IPv6Enabled = enabled

	return sm.storage.SaveMeta(meta)
}

// SetLogConfig sets log configuration
func (sm *SettingsManager) SetLogConfig(level string, toFile bool) error {
	meta, err := sm.storage.LoadMeta()
	if err != nil {
		return err
	}

	meta.LogLevel = level
	meta.LogToFile = toFile

	return sm.storage.SaveMeta(meta)
}

// SetPreRelease sets pre-release update channel
func (sm *SettingsManager) SetPreRelease(enabled bool) error {
	meta, err := sm.storage.LoadMeta()
	if err != nil {
		return err
	}
	meta.PreRelease = enabled
	return sm.storage.SaveMeta(meta)
}

// SetCloseBehavior sets the close window behavior (ask, tray, quit)
func (sm *SettingsManager) SetCloseBehavior(behavior string) error {
	meta, err := sm.storage.LoadMeta()
	if err != nil {
		return err
	}

	meta.CloseBehavior = behavior
	return sm.storage.SaveMeta(meta)
}