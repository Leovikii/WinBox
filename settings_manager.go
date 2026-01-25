package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
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
		cmdStr := fmt.Sprintf(`"%s" -minimized`, exePath)
		cmd := exec.Command("schtasks", "/Create", "/TN", taskName, "/TR", cmdStr, "/SC", "ONLOGON", "/RL", "HIGHEST", "/F")
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
func (sm *SettingsManager) SetAutoConnect(enabled bool, mode string) error {
	meta, err := sm.storage.LoadMeta()
	if err != nil {
		return err
	}

	meta.AutoConnect = enabled
	meta.AutoConnectMode = mode

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
