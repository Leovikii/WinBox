package internal

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sync"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// CoreManager manages the sing-box core process with thread safety
type CoreManager struct {
	mu      sync.RWMutex
	cmd     *exec.Cmd
	running bool
	ctx     context.Context
	appDir  string
}

// NewCoreManager creates a new core manager
func NewCoreManager(appDir string, ctx context.Context) *CoreManager {
	return &CoreManager{
		appDir: appDir,
		ctx:    ctx,
	}
}

// Start starts the core process with thread safety
func (cm *CoreManager) Start(profilePath string, tunMode, sysProxy bool, tunConfig, mixedConfig string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if cm.running {
		return fmt.Errorf("core already running")
	}

	coreDir := filepath.Join(cm.appDir, "data", "core")
	runtimeConfig := filepath.Join(coreDir, "config.json")
	coreExe := filepath.Join(coreDir, "sing-box.exe")

	if _, err := os.Stat(coreExe); os.IsNotExist(err) {
		return fmt.Errorf("kernel missing")
	}

	// Process config
	if err := cm.processConfig(profilePath, runtimeConfig, tunMode, sysProxy, tunConfig, mixedConfig); err != nil {
		return fmt.Errorf("config gen error: %w", err)
	}

	cm.cmd = exec.Command(coreExe, "run", "-c", "config.json")
	cm.cmd.Dir = coreDir

	SetCmdWindowHidden(cm.cmd)

	var stderr bytes.Buffer
	cm.cmd.Stderr = &stderr

	if err := cm.cmd.Start(); err != nil {
		return fmt.Errorf("start error: %w", err)
	}

	cm.running = true

	// Monitor process in background
	go cm.monitorProcess(&stderr)

	return nil
}

// Stop stops the core process with thread safety
func (cm *CoreManager) Stop() error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if !cm.running {
		return nil
	}

	if cm.cmd != nil && cm.cmd.Process != nil {
		if err := SendExitSignal(cm.cmd.Process); err != nil {
			cm.cmd.Process.Kill()
		}

		done := make(chan error, 1)
		go func() { done <- cm.cmd.Wait() }()

		select {
		case <-done:
		case <-time.After(2000 * time.Millisecond):
			cm.cmd.Process.Kill()
		}
	}

	cm.running = false
	return nil
}

// IsRunning returns the running status with thread safety
func (cm *CoreManager) IsRunning() bool {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.running
}

// GetLocalVersion gets the local sing-box version
func (cm *CoreManager) GetLocalVersion() string {
	exe := filepath.Join(cm.appDir, "data", "core", "sing-box.exe")

	if _, err := os.Stat(exe); os.IsNotExist(err) {
		return "Not Installed"
	}

	cmd := exec.Command(exe, "version")
	SetCmdWindowHidden(cmd)
	out, _ := cmd.Output()
	re := regexp.MustCompile(`version\s+([0-9a-zA-Z\.\-]+)`)
	matches := re.FindStringSubmatch(string(out))
	if len(matches) > 1 {
		return matches[1]
	}
	return "Unknown"
}

// processConfig processes the configuration file
func (cm *CoreManager) processConfig(srcPath, dstPath string, enableTun bool, enableProxy bool, tunConfig, mixedConfig string) error {
	content, err := os.ReadFile(srcPath)
	if err != nil {
		return err
	}

	var config map[string]interface{}
	if err := json.Unmarshal(content, &config); err != nil {
		return err
	}

	newInbounds := make([]interface{}, 0)

	if enableTun {
		var tunMap map[string]interface{}
		if json.Unmarshal([]byte(tunConfig), &tunMap) == nil {
			newInbounds = append(newInbounds, tunMap)
		}
	}

	if enableProxy {
		var mixedMap map[string]interface{}
		if json.Unmarshal([]byte(mixedConfig), &mixedMap) == nil {
			newInbounds = append(newInbounds, mixedMap)
		}
	}

	config["inbounds"] = newInbounds

	newContent, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	os.MkdirAll(filepath.Dir(dstPath), 0755)

	return os.WriteFile(dstPath, newContent, 0644)
}

// monitorProcess monitors the core process and emits events
func (cm *CoreManager) monitorProcess(stderr *bytes.Buffer) {
	cm.cmd.Wait()

	cm.mu.Lock()
	cm.running = false
	cm.mu.Unlock()

	wailsRuntime.EventsEmit(cm.ctx, "status", false)
	if stderr.Len() > 0 {
		wailsRuntime.EventsEmit(cm.ctx, "log", "CORE STOPPED: "+stderr.String())
	}
}
