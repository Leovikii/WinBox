package main

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
)

// ProfileManager manages profile operations
type ProfileManager struct {
	storage    *Storage
	httpClient *HTTPClient
	appDir     string
}

// NewProfileManager creates a new profile manager
func NewProfileManager(storage *Storage, httpClient *HTTPClient, appDir string) *ProfileManager {
	return &ProfileManager{
		storage:    storage,
		httpClient: httpClient,
		appDir:     appDir,
	}
}

// Add adds a new profile
func (pm *ProfileManager) Add(name, url string) error {
	if name == "" || url == "" {
		return fmt.Errorf("name and url cannot be empty")
	}

	resp, err := pm.httpClient.Get(url)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	id := uuid.New().String()
	savePath := filepath.Join(pm.appDir, "data", "profiles", id+".json")

	out, err := os.Create(savePath)
	if err != nil {
		return fmt.Errorf("create file failed: %w", err)
	}
	defer out.Close()

	if _, err := io.Copy(out, resp.Body); err != nil {
		return fmt.Errorf("copy failed: %w", err)
	}

	meta, err := pm.storage.LoadMeta()
	if err != nil {
		return err
	}

	now := time.Now().Format("2006-01-02 15:04")
	meta.Profiles = append(meta.Profiles, Profile{
		ID:      id,
		Name:    name,
		Url:     url,
		Path:    savePath,
		Updated: now,
	})

	if len(meta.Profiles) == 1 {
		meta.ActiveID = id
	}

	return pm.storage.SaveMeta(meta)
}

// Delete deletes a profile
func (pm *ProfileManager) Delete(id string) error {
	meta, err := pm.storage.LoadMeta()
	if err != nil {
		return err
	}

	newProfiles := []Profile{}
	for _, p := range meta.Profiles {
		if p.ID == id {
			realPath := filepath.Join(pm.appDir, "data", "profiles", p.ID+".json")
			os.Remove(realPath)
			continue
		}
		newProfiles = append(newProfiles, p)
	}

	meta.Profiles = newProfiles
	if meta.ActiveID == id {
		meta.ActiveID = ""
	}

	return pm.storage.SaveMeta(meta)
}

// Select selects a profile as active
func (pm *ProfileManager) Select(id string) error {
	meta, err := pm.storage.LoadMeta()
	if err != nil {
		return err
	}

	found := false
	for _, p := range meta.Profiles {
		if p.ID == id {
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("profile not found")
	}

	meta.ActiveID = id
	return pm.storage.SaveMeta(meta)
}

// Update updates the active profile
func (pm *ProfileManager) Update() error {
	meta, err := pm.storage.LoadMeta()
	if err != nil {
		return err
	}

	var target *Profile
	for i := range meta.Profiles {
		if meta.Profiles[i].ID == meta.ActiveID {
			target = &meta.Profiles[i]
			break
		}
	}

	if target == nil {
		return fmt.Errorf("no active profile")
	}

	resp, err := pm.httpClient.Get(target.Url)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	realPath := filepath.Join(pm.appDir, "data", "profiles", target.ID+".json")

	out, err := os.Create(realPath)
	if err != nil {
		return fmt.Errorf("create file failed: %w", err)
	}
	defer out.Close()

	if _, err := io.Copy(out, resp.Body); err != nil {
		return fmt.Errorf("copy failed: %w", err)
	}

	target.Updated = time.Now().Format("2006-01-02 15:04")
	target.Path = realPath

	return pm.storage.SaveMeta(meta)
}
