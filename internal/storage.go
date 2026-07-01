package internal

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Storage manages data persistence with caching
type Storage struct {
	mu         sync.RWMutex
	configDir  string
	cache      *MetaData
	cacheValid bool

	// Fingerprints for smart dirty-checking
	lastSettings []byte
	lastState    []byte
	lastProfiles []byte
	lastTun      []byte
	lastMixed    []byte

	saveTimer *time.Timer
	saveMu    sync.Mutex
}

// NewStorage creates a new storage instance
func NewStorage(configDir string) *Storage {
	return &Storage{
		configDir: configDir,
	}
}

// atomicWrite writes data to a temporary file then renames it
func atomicWrite(path string, data []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return fmt.Errorf("write temp file failed: %w", err)
	}
	if err := os.Rename(tmpPath, path); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("rename failed: %w", err)
	}
	return nil
}

// LoadMeta loads metadata with caching
func (s *Storage) LoadMeta() (*MetaData, error) {
	s.mu.RLock()
	if s.cacheValid {
		meta := *s.cache
		s.mu.RUnlock()
		return &meta, nil
	}
	s.mu.RUnlock()

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.cacheValid {
		meta := *s.cache
		return &meta, nil
	}

	meta := s.getDefaultMeta()

	// Load Settings
	if data, err := os.ReadFile(filepath.Join(s.configDir, "settings.json")); err == nil {
		s.lastSettings = data
		var gs GlobalSettings
		if json.Unmarshal(data, &gs) == nil {
			meta.Mirror = gs.Mirror
			meta.MirrorEnabled = gs.MirrorEnabled
			meta.AutoConnectState = gs.AutoConnectState
			meta.StartOnBoot = gs.StartOnBoot
			meta.CloseBehavior = gs.CloseBehavior
			meta.ThemeMode = gs.ThemeMode
			meta.AccentColor = gs.AccentColor
			meta.IPv6Enabled = gs.IPv6Enabled
			meta.LogLevel = gs.LogLevel
			meta.LogToFile = gs.LogToFile
			meta.PreRelease = gs.PreRelease
		}
	}

	// Load State
	if data, err := os.ReadFile(filepath.Join(s.configDir, "state.json")); err == nil {
		s.lastState = data
		var as AppState
		if json.Unmarshal(data, &as) == nil {
			meta.ActiveID = as.ActiveID
			meta.TunMode = as.TunMode
			meta.SysProxy = as.SysProxy
		}
	}

	// Load Profiles
	if data, err := os.ReadFile(filepath.Join(s.configDir, "profiles.json")); err == nil {
		s.lastProfiles = data
		var profiles []Profile
		if json.Unmarshal(data, &profiles) == nil {
			meta.Profiles = profiles
		}
	}

	// Load Tun Override
	if data, err := os.ReadFile(filepath.Join(s.configDir, "overrides", "tun.json")); err == nil {
		s.lastTun = data
		meta.TunConfig = string(data)
	}

	// Load Mixed Override
	if data, err := os.ReadFile(filepath.Join(s.configDir, "overrides", "mixed.json")); err == nil {
		s.lastMixed = data
		meta.MixedConfig = string(data)
	}

	// Apply defaults for fields that might be missing
	if meta.Mirror == "" {
		meta.Mirror = "https://gh-proxy.com/"
		meta.MirrorEnabled = true
	}
	if meta.TunConfig == "" {
		meta.TunConfig = DefaultTunConfig
	}
	if meta.MixedConfig == "" {
		meta.MixedConfig = DefaultMixedConfig
	}
	if meta.AutoConnectState == "" {
		meta.AutoConnectState = "smart"
	}
	if meta.ThemeMode == "" {
		meta.ThemeMode = "system"
	}
	if meta.AccentColor == "" {
		meta.AccentColor = "#2563eb"
	}
	if meta.LogLevel == "" {
		meta.LogLevel = "warning"
	}

	s.cache = meta
	s.cacheValid = true

	return meta, nil
}

// SaveMeta saves metadata to cache and debounces disk write
func (s *Storage) SaveMeta(meta *MetaData) error {
	s.mu.Lock()
	s.cache = meta
	s.cacheValid = true
	s.mu.Unlock()

	s.saveMu.Lock()
	if s.saveTimer != nil {
		s.saveTimer.Stop()
	}
	s.saveTimer = time.AfterFunc(1*time.Second, func() {
		s.flushToDisk()
	})
	s.saveMu.Unlock()

	return nil
}

func (s *Storage) flushToDisk() error {
	s.mu.RLock()
	if !s.cacheValid || s.cache == nil {
		s.mu.RUnlock()
		return nil
	}
	metaCopy := *s.cache
	s.mu.RUnlock()

	// 1. Save Settings
	gs := GlobalSettings{
		Mirror:           metaCopy.Mirror,
		MirrorEnabled:    metaCopy.MirrorEnabled,
		AutoConnectState: metaCopy.AutoConnectState,
		StartOnBoot:      metaCopy.StartOnBoot,
		CloseBehavior:    metaCopy.CloseBehavior,
		ThemeMode:        metaCopy.ThemeMode,
		AccentColor:      metaCopy.AccentColor,
		IPv6Enabled:      metaCopy.IPv6Enabled,
		LogLevel:         metaCopy.LogLevel,
		LogToFile:        metaCopy.LogToFile,
		PreRelease:       metaCopy.PreRelease,
	}
	if settingsBytes, err := json.MarshalIndent(gs, "", "  "); err == nil {
		if !bytes.Equal(settingsBytes, s.lastSettings) {
			atomicWrite(filepath.Join(s.configDir, "settings.json"), settingsBytes)
			s.lastSettings = settingsBytes
		}
	}

	// 2. Save State
	as := AppState{
		ActiveID: metaCopy.ActiveID,
		TunMode:  metaCopy.TunMode,
		SysProxy: metaCopy.SysProxy,
	}
	if stateBytes, err := json.MarshalIndent(as, "", "  "); err == nil {
		if !bytes.Equal(stateBytes, s.lastState) {
			atomicWrite(filepath.Join(s.configDir, "state.json"), stateBytes)
			s.lastState = stateBytes
		}
	}

	// 3. Save Profiles
	if metaCopy.Profiles == nil {
		metaCopy.Profiles = []Profile{} // ensure not nil
	}
	if profilesBytes, err := json.MarshalIndent(metaCopy.Profiles, "", "  "); err == nil {
		if !bytes.Equal(profilesBytes, s.lastProfiles) {
			atomicWrite(filepath.Join(s.configDir, "profiles.json"), profilesBytes)
			s.lastProfiles = profilesBytes
		}
	}

	// 4. Save Tun Override
	tunBytes := []byte(metaCopy.TunConfig)
	if !bytes.Equal(tunBytes, s.lastTun) {
		atomicWrite(filepath.Join(s.configDir, "overrides", "tun.json"), tunBytes)
		s.lastTun = tunBytes
	}

	// 5. Save Mixed Override
	mixedBytes := []byte(metaCopy.MixedConfig)
	if !bytes.Equal(mixedBytes, s.lastMixed) {
		atomicWrite(filepath.Join(s.configDir, "overrides", "mixed.json"), mixedBytes)
		s.lastMixed = mixedBytes
	}

	return nil
}

// Flush immediately writes any pending changes to disk
func (s *Storage) Flush() {
	s.saveMu.Lock()
	if s.saveTimer != nil {
		if s.saveTimer.Stop() {
			s.flushToDisk()
		}
		s.saveTimer = nil
	}
	s.saveMu.Unlock()
}

// InvalidateCache invalidates the cache
func (s *Storage) InvalidateCache() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cacheValid = false
}

// getDefaultMeta returns default metadata
func (s *Storage) getDefaultMeta() *MetaData {
	return &MetaData{
		Profiles:         []Profile{},
		MirrorEnabled:    true,
		Mirror:           "https://gh-proxy.com/",
		TunConfig:        DefaultTunConfig,
		MixedConfig:      DefaultMixedConfig,
		AutoConnectState: "smart",
		StartOnBoot:      false,
		ThemeMode:        "system",
		AccentColor:      "#2563eb",
		IPv6Enabled:      true,
		LogLevel:         "warning",
		LogToFile:        true,
	}
}
