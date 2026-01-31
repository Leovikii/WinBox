package internal

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// CoreManager manages the sing-box core process with thread safety
type CoreManager struct {
	mu         sync.RWMutex
	cmd        *exec.Cmd
	running    bool
	ctx        context.Context
	appDir     string
	logBuffer  *LogBuffer // Buffer for real-time logs
	apiURL     string     // Clash API URL if available
}

// LogBuffer stores recent log lines in memory
type LogBuffer struct {
	mu    sync.RWMutex
	lines []string
	max   int
}

func NewLogBuffer(maxLines int) *LogBuffer {
	return &LogBuffer{
		lines: make([]string, 0, maxLines),
		max:   maxLines,
	}
}

func (lb *LogBuffer) Append(line string) {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	lb.lines = append(lb.lines, line)
	if len(lb.lines) > lb.max {
		lb.lines = lb.lines[len(lb.lines)-lb.max:]
	}
}

func (lb *LogBuffer) GetAll() string {
	lb.mu.RLock()
	defer lb.mu.RUnlock()

	if len(lb.lines) == 0 {
		return ""
	}
	return strings.Join(lb.lines, "\n")
}

func (lb *LogBuffer) Clear() {
	lb.mu.Lock()
	defer lb.mu.Unlock()
	lb.lines = make([]string, 0, lb.max)
}

// NewCoreManager creates a new core manager
func NewCoreManager(appDir string, ctx context.Context) *CoreManager {
	return &CoreManager{
		appDir:    appDir,
		ctx:       ctx,
		logBuffer: NewLogBuffer(5000), // Store last 5000 lines
	}
}

// Start starts the core process with thread safety
func (cm *CoreManager) Start(profilePath string, tunMode, sysProxy bool, tunConfig, mixedConfig string, ipv6Enabled bool, logLevel string, logToFile bool) error {
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

	// Process config and extract API URL
	apiURL, err := cm.processConfig(profilePath, runtimeConfig, tunMode, sysProxy, tunConfig, mixedConfig, ipv6Enabled, logLevel, logToFile)
	if err != nil {
		return fmt.Errorf("config gen error: %w", err)
	}
	cm.apiURL = apiURL

	cm.cmd = exec.Command(coreExe, "run", "-c", "config.json")
	cm.cmd.Dir = coreDir

	SetCmdWindowHidden(cm.cmd)

	// Capture both stdout and stderr
	stdoutPipe, err := cm.cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("stdout pipe error: %w", err)
	}

	stderrPipe, err := cm.cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("stderr pipe error: %w", err)
	}

	if err := cm.cmd.Start(); err != nil {
		return fmt.Errorf("start error: %w", err)
	}

	cm.running = true

	// Monitor stdout in background
	go cm.captureOutput(stdoutPipe)
	// Monitor stderr in background
	go cm.captureOutput(stderrPipe)
	// Monitor process in background
	go cm.monitorProcess()

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

// processConfig processes the configuration file and returns API URL
func (cm *CoreManager) processConfig(srcPath, dstPath string, enableTun bool, enableProxy bool, tunConfig, mixedConfig string, ipv6Enabled bool, logLevel string, logToFile bool) (string, error) {
	content, err := os.ReadFile(srcPath)
	if err != nil {
		return "", err
	}

	var config map[string]interface{}
	if err := json.Unmarshal(content, &config); err != nil {
		return "", err
	}

	// Extract API URL before modifying config
	apiURL := cm.extractAPIURL(config)

	// Process inbounds
	newInbounds := make([]interface{}, 0)

	if enableTun {
		var tunMap map[string]interface{}
		if json.Unmarshal([]byte(tunConfig), &tunMap) == nil {
			// Handle IPv6 support
			if !ipv6Enabled {
				if addresses, ok := tunMap["address"].([]interface{}); ok {
					filtered := make([]interface{}, 0)
					for _, addr := range addresses {
						if addrStr, ok := addr.(string); ok {
							// Remove IPv6 address (fdfe:dcba:9876::1/126)
							if addrStr != "fdfe:dcba:9876::1/126" {
								filtered = append(filtered, addr)
							}
						}
					}
					tunMap["address"] = filtered
				}
			}
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

	// Process log configuration
	logConfig := map[string]interface{}{
		"level":     logLevel,
		"timestamp": true,
	}
	if logToFile {
		logConfig["output"] = "box.log"
	}
	config["log"] = logConfig

	newContent, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return "", err
	}

	os.MkdirAll(filepath.Dir(dstPath), 0755)

	if err := os.WriteFile(dstPath, newContent, 0644); err != nil {
		return "", err
	}

	return apiURL, nil
}

// monitorProcess monitors the core process and emits events
func (cm *CoreManager) monitorProcess() {
	cm.cmd.Wait()

	cm.mu.Lock()
	cm.running = false
	cm.mu.Unlock()

	wailsRuntime.EventsEmit(cm.ctx, "status", false)
}

// captureOutput captures output from stdout/stderr and stores in buffer
func (cm *CoreManager) captureOutput(pipe interface{}) {
	scanner := bufio.NewScanner(pipe.(interface{ Read([]byte) (int, error) }))
	for scanner.Scan() {
		line := scanner.Text()
		cm.logBuffer.Append(line)
	}
}

// GetLogBuffer returns the current log buffer content
func (cm *CoreManager) GetLogBuffer() string {
	return cm.logBuffer.GetAll()
}

// ClearLogBuffer clears the log buffer
func (cm *CoreManager) ClearLogBuffer() {
	cm.logBuffer.Clear()
}

// GetAPIURL returns the Clash API URL if available
func (cm *CoreManager) GetAPIURL() string {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.apiURL
}

// extractAPIURL extracts the Clash API URL from config
func (cm *CoreManager) extractAPIURL(config map[string]interface{}) string {
	// Check for experimental.clash_api configuration
	if experimental, ok := config["experimental"].(map[string]interface{}); ok {
		if clashAPI, ok := experimental["clash_api"].(map[string]interface{}); ok {
			if externalController, ok := clashAPI["external_controller"].(string); ok && externalController != "" {
				// Format: "127.0.0.1:9090" or ":9090"
				if externalController[0] == ':' {
					return "http://127.0.0.1" + externalController
				}
				return "http://" + externalController
			}
		}
	}
	return ""
}
