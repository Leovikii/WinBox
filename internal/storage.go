package internal

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

// Storage manages data persistence with caching
type Storage struct {
	mu         sync.RWMutex
	metaPath   string
	cache      *MetaData
	cacheValid bool
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
	if meta.AutoConnectMode == "" {
		meta.AutoConnectMode = "full"
	}
	if meta.ThemeMode == "" {
		meta.ThemeMode = "dark"
	}
	if meta.AccentColor == "" {
		meta.AccentColor = "#2563eb"
	}

	s.cache = &meta
	s.cacheValid = true

	return &meta, nil
}

// SaveMeta saves metadata with atomic write
func (s *Storage) SaveMeta(meta *MetaData) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := json.MarshalIndent(meta, "", "  ")
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

	// Update cache
	s.cache = meta
	s.cacheValid = true

	return nil
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
		AutoConnect:     false,
		AutoConnectMode: "full",
		StartOnBoot:     false,
		ThemeMode:       "dark",
		AccentColor:     "#2563eb",
	}
}
