package internal

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"
)

// Storage manages data persistence with caching
type Storage struct {
	mu         sync.RWMutex
	metaPath   string
	cache      *MetaData
	cacheValid bool

	saveTimer *time.Timer
	saveMu    sync.Mutex
}

// NewStorage creates a new storage instance
func NewStorage(metaPath string) *Storage {
	return &Storage{
		metaPath: metaPath,
	}
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

	// Load from disk
	data, err := os.ReadFile(s.metaPath)
	if err != nil {
		meta := s.getDefaultMeta()
		s.cache = meta
		s.cacheValid = true
		return meta, nil
	}

	var meta MetaData
	if err := json.Unmarshal(data, &meta); err != nil {
		return nil, err
	}

	// Apply defaults
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
		if meta.AutoConnect != nil {
			if *meta.AutoConnect {
				meta.AutoConnectState = "on"
			} else {
				meta.AutoConnectState = "off"
			}
		} else {
			meta.AutoConnectState = "smart"
		}
	}
	meta.AutoConnect = nil

	if meta.ThemeMode == "" {
		meta.ThemeMode = "dark"
	}
	if meta.AccentColor == "" {
		meta.AccentColor = "#2563eb"
	}
	if meta.LogLevel == "" {
		meta.LogLevel = "warning"
	}

	s.cache = &meta
	s.cacheValid = true

	return &meta, nil
}

// SaveMeta saves metadata to cache and debounces disk write
func (s *Storage) SaveMeta(meta *MetaData) error {
	s.mu.Lock()
	// Update cache immediately
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
	// Make a copy to avoid holding the lock during I/O
	metaCopy := *s.cache
	s.mu.RUnlock()

	data, err := json.MarshalIndent(&metaCopy, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal failed: %w", err)
	}

	// Atomic write: temp file + rename
	tmpPath := s.metaPath + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return fmt.Errorf("write temp file failed: %w", err)
	}

	if err := os.Rename(tmpPath, s.metaPath); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("rename failed: %w", err)
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
		Profiles:        []Profile{},
		MirrorEnabled:   true,
		Mirror:          "https://gh-proxy.com/",
		TunConfig:       DefaultTunConfig,
		MixedConfig:     DefaultMixedConfig,
		AutoConnectState: "smart",
		StartOnBoot:     false,
		ThemeMode:       "dark",
		AccentColor:     "#2563eb",
		IPv6Enabled:     true,
		LogLevel:        "warning",
		LogToFile:       true,
	}
}
