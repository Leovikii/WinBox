package internal

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

// SetIPv6Enabled sets IPv6 support and updates TunConfig accordingly
func (sm *SettingsManager) SetIPv6Enabled(enabled bool) error {
	meta, err := sm.storage.LoadMeta()
	if err != nil {
		return err
	}

	meta.IPv6Enabled = enabled

	// Update TunConfig to add/remove IPv6 address
	var tunMap map[string]interface{}
	if err := json.Unmarshal([]byte(meta.TunConfig), &tunMap); err == nil {
		if addresses, ok := tunMap["address"].([]interface{}); ok {
			ipv6Addr := "fdfe:dcba:9876::1/126"

			if enabled {
				// Add IPv6 address if not present
				hasIPv6 := false
				for _, addr := range addresses {
					if addrStr, ok := addr.(string); ok && addrStr == ipv6Addr {
						hasIPv6 = true
						break
					}
				}
				if !hasIPv6 {
					addresses = append(addresses, ipv6Addr)
					tunMap["address"] = addresses
				}
			} else {
				// Remove IPv6 address
				filtered := make([]interface{}, 0)
				for _, addr := range addresses {
					if addrStr, ok := addr.(string); ok && addrStr != ipv6Addr {
						filtered = append(filtered, addr)
					}
				}
				tunMap["address"] = filtered
			}

			// Save updated TunConfig back to meta
			if updatedConfig, err := json.MarshalIndent(tunMap, "", "  "); err == nil {
				meta.TunConfig = string(updatedConfig)
			}
		}
	}

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
