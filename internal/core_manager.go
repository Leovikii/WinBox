package internal

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
	"unsafe"

	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/sys/windows"
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

// LogBuffer stores recent log lines in memory using a ring buffer
type LogBuffer struct {
	mu     sync.RWMutex
	lines  []string
	max    int
	cursor int
	count  int
}

func NewLogBuffer(maxLines int) *LogBuffer {
	return &LogBuffer{
		lines: make([]string, maxLines), // Allocate full size array once
		max:   maxLines,
	}
}

func (lb *LogBuffer) Append(line string) {
	lb.mu.Lock()
	defer lb.mu.Unlock()

	lb.lines[lb.cursor] = line
	lb.cursor = (lb.cursor + 1) % lb.max
	if lb.count < lb.max {
		lb.count++
	}
}

func (lb *LogBuffer) GetAll() string {
	lb.mu.RLock()
	defer lb.mu.RUnlock()

	if lb.count == 0 {
		return ""
	}

	result := make([]string, 0, lb.count)
	if lb.count < lb.max {
		result = append(result, lb.lines[:lb.count]...)
	} else {
		// Ring buffer is full, read from cursor to end, then start to cursor
		result = append(result, lb.lines[lb.cursor:]...)
		result = append(result, lb.lines[:lb.cursor]...)
	}

	return strings.Join(result, "\n")
}

func (lb *LogBuffer) Clear() {
	lb.mu.Lock()
	defer lb.mu.Unlock()
	lb.cursor = 0
	lb.count = 0
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
	go cm.monitorProcess(cm.cmd)

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
		go func() {
			_, err := cm.cmd.Process.Wait()
			done <- err
		}()

		select {
		case <-done:
		case <-time.After(2000 * time.Millisecond):
			cm.cmd.Process.Kill()
		}
	}

	cm.running = false
	return nil
}

func (cm *CoreManager) KillZombieInstances() {
	corePath := filepath.Join(cm.appDir, "data", "core", "sing-box.exe")
	
	snapshot, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return
	}
	defer windows.CloseHandle(snapshot)

	var pe32 windows.ProcessEntry32
	pe32.Size = uint32(unsafe.Sizeof(pe32))

	if err := windows.Process32First(snapshot, &pe32); err != nil {
		return
	}

	for {
		exeName := windows.UTF16ToString(pe32.ExeFile[:])
		if strings.EqualFold(exeName, "sing-box.exe") {
			if cm.isTargetProcess(pe32.ProcessID, corePath) {
				if proc, err := os.FindProcess(int(pe32.ProcessID)); err == nil {
					if err := proc.Kill(); err == nil {
						cm.logBuffer.Append(fmt.Sprintf("[Info] Killed zombie sing-box.exe (PID: %d)", pe32.ProcessID))
					}
				}
			}
		}

		if err := windows.Process32Next(snapshot, &pe32); err != nil {
			break
		}
	}
}

func (cm *CoreManager) isTargetProcess(pid uint32, targetPath string) bool {
	h, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
	if err != nil {
		return false
	}
	defer windows.CloseHandle(h)

	var buf [windows.MAX_PATH]uint16
	size := uint32(len(buf))
	if err := windows.QueryFullProcessImageName(h, 0, &buf[0], &size); err != nil {
		return false
	}
	
	procPath := windows.UTF16ToString(buf[:size])
	return strings.EqualFold(procPath, targetPath)
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

// CheckConfig validates a configuration file using sing-box check
func (cm *CoreManager) CheckConfig(configPath string) error {
	coreExe := filepath.Join(cm.appDir, "data", "core", "sing-box.exe")
	
	if _, err := os.Stat(coreExe); os.IsNotExist(err) {
		return fmt.Errorf("kernel not installed")
	}

	cmd := exec.Command(coreExe, "check", "-c", configPath)
	SetCmdWindowHidden(cmd)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("config check failed: %s", string(output))
	}
	
	return nil
}

// processConfig processes the configuration file and returns API URL
func (cm *CoreManager) processConfig(srcPath, dstPath string, enableTun bool, enableProxy bool, tunConfig, mixedConfig string, ipv6Enabled bool, logLevel string, logToFile bool) (string, error) {
	content, err := os.ReadFile(srcPath)
	if err != nil {
		return "", err
	}

	// Extract API URL before modifying config
	apiURL := cm.extractAPIURL(content)

	// Process inbounds
	newInbounds := make([]interface{}, 0)

	if enableTun {
		var tunMap map[string]interface{}
		if json.Unmarshal([]byte(tunConfig), &tunMap) == nil {
			// Handle IPv6 support dynamically
			if addresses, ok := tunMap["address"].([]interface{}); ok {
				ipv6Addr := "fdfe:dcba:9876::1/126"
				
				if ipv6Enabled {
					hasIPv6 := false
					for _, addr := range addresses {
						if addrStr, ok := addr.(string); ok && addrStr == ipv6Addr {
							hasIPv6 = true
							break
						}
					}
					if !hasIPv6 {
						addresses = append(addresses, ipv6Addr)
					}
				} else {
					filtered := make([]interface{}, 0)
					for _, addr := range addresses {
						if addrStr, ok := addr.(string); ok && addrStr != ipv6Addr {
							filtered = append(filtered, addr)
						}
					}
					addresses = filtered
				}
				tunMap["address"] = addresses
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

	content, err = sjson.SetBytes(content, "inbounds", newInbounds)
	if err != nil {
		return "", err
	}

	// Process log configuration (skip if "Don't Modify" is selected)
	if logLevel != "" {
		logConfig := map[string]interface{}{
			"level":     logLevel,
			"timestamp": true,
		}
		if logToFile {
			logConfig["output"] = "box.log"
		}

		content, err = sjson.SetBytes(content, "log", logConfig)
		if err != nil {
			return "", err
		}
	}

	var prettyJSON bytes.Buffer
	if err := json.Indent(&prettyJSON, content, "", "  "); err == nil {
		content = prettyJSON.Bytes()
	}

	os.MkdirAll(filepath.Dir(dstPath), 0755)

	if err := os.WriteFile(dstPath, content, 0644); err != nil {
		return "", err
	}

	return apiURL, nil
}

// extractAPIURL extracts the Clash API URL from config
func (cm *CoreManager) extractAPIURL(content []byte) string {
	externalController := gjson.GetBytes(content, "experimental.clash_api.external_controller").String()
	if externalController != "" {
		if externalController[0] == ':' {
			return "http://127.0.0.1" + externalController
		}
		return "http://" + externalController
	}
	return "http://127.0.0.1:9090" // default fallback
}

// monitorProcess monitors the core process and emits events
func (cm *CoreManager) monitorProcess(cmd *exec.Cmd) {
	cmd.Wait()

	cm.mu.Lock()
	// Check if this is still the active command. If not, another core was already started or stopped.
	if cm.cmd != cmd {
		cm.mu.Unlock()
		return
	}
	wasRunning := cm.running
	cm.running = false
	cm.mu.Unlock()

	if wasRunning {
		cm.logBuffer.Append("[Warning] Core process stopped unexpectedly")
		wailsRuntime.EventsEmit(cm.ctx, "log", "Error: Core crashed unexpectedly")
	}

	wailsRuntime.EventsEmit(cm.ctx, "status", false)
}

// captureOutput captures output from stdout/stderr and stores in buffer
func (cm *CoreManager) captureOutput(pipe interface{}) {
	scanner := bufio.NewScanner(pipe.(interface{ Read([]byte) (int, error) }))
	for scanner.Scan() {
		line := scanner.Text()
		cm.logBuffer.Append(line)
	}
	if err := scanner.Err(); err != nil {
		cm.logBuffer.Append(fmt.Sprintf("[Log Error]: %v", err))
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

// WaitForReady polls the core to check if it has fully started.
// It checks the API URL if available, otherwise it falls back to scanning the logs.
func (cm *CoreManager) WaitForReady(timeout time.Duration) bool {
	api := cm.GetAPIURL()
	
	start := time.Now()
	
	if api != "" {
		client := &http.Client{Timeout: 200 * time.Millisecond}
		for time.Since(start) < timeout {
			if !cm.IsRunning() {
				return false
			}
			resp, err := client.Get(api)
			if err == nil {
				resp.Body.Close()
				return true
			}
			time.Sleep(100 * time.Millisecond)
		}
	} else {
		for time.Since(start) < timeout {
			if !cm.IsRunning() {
				return false
			}
			logs := cm.GetLogBuffer()
			if strings.Contains(logs, "sing-box started") || strings.Contains(logs, "started at") {
				return true
			}
			time.Sleep(100 * time.Millisecond)
		}
	}
	
	return false
}
