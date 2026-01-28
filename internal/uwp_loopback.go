//go:build windows

package internal

import (
	"fmt"
	"os/exec"
	"regexp"
	"strings"
	"sync"

	"golang.org/x/sys/windows/registry"
)

// UWPApp represents a UWP application
type UWPApp struct {
	SID         string `json:"sid"`
	DisplayName string `json:"displayName"`
	PackageName string `json:"packageName"`
	IsExempt    bool   `json:"isExempt"`
}

// UWPLoopbackManager manages UWP loopback exemptions
type UWPLoopbackManager struct {
	mu sync.RWMutex
}

// NewUWPLoopbackManager creates a new UWP loopback manager
func NewUWPLoopbackManager() *UWPLoopbackManager {
	return &UWPLoopbackManager{}
}

// GetUWPApps retrieves all UWP applications from registry
func (m *UWPLoopbackManager) GetUWPApps() ([]UWPApp, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Open registry key for AppContainer mappings
	key, err := registry.OpenKey(
		registry.CURRENT_USER,
		`Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Mappings`,
		registry.ENUMERATE_SUB_KEYS,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to open registry key: %w", err)
	}
	defer key.Close()

	// Get all SIDs (subkeys)
	sids, err := key.ReadSubKeyNames(0)
	if err != nil {
		return nil, fmt.Errorf("failed to read subkeys: %w", err)
	}

	// Get exempt list
	exemptSIDs, err := m.getExemptList()
	if err != nil {
		exemptSIDs = make(map[string]bool)
	}

	apps := make([]UWPApp, 0)
	var wg sync.WaitGroup
	var mu sync.Mutex
	semaphore := make(chan struct{}, 10) // Limit concurrent registry reads

	for _, sid := range sids {
		wg.Add(1)
		go func(sid string) {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			app, err := m.getAppInfo(sid)
			if err != nil || app == nil {
				return
			}

			app.IsExempt = exemptSIDs[sid]

			mu.Lock()
			apps = append(apps, *app)
			mu.Unlock()
		}(sid)
	}

	wg.Wait()

	return apps, nil
}

// getAppInfo retrieves app information from registry
func (m *UWPLoopbackManager) getAppInfo(sid string) (*UWPApp, error) {
	keyPath := fmt.Sprintf(
		`Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Mappings\%s`,
		sid,
	)

	key, err := registry.OpenKey(registry.CURRENT_USER, keyPath, registry.QUERY_VALUE)
	if err != nil {
		return nil, err
	}
	defer key.Close()

	// Read DisplayName
	displayName, _, err := key.GetStringValue("DisplayName")
	if err != nil {
		return nil, err
	}

	// Skip ms-resource entries
	if strings.Contains(displayName, "ms-resource") {
		return nil, fmt.Errorf("skip ms-resource")
	}

	// Read Moniker (package name)
	packageName, _, err := key.GetStringValue("Moniker")
	if err != nil {
		packageName = ""
	}

	return &UWPApp{
		SID:         sid,
		DisplayName: displayName,
		PackageName: packageName,
		IsExempt:    false,
	}, nil
}

// getExemptList retrieves the list of exempted SIDs
func (m *UWPLoopbackManager) getExemptList() (map[string]bool, error) {
	cmd := exec.Command("CheckNetIsolation", "LoopbackExempt", "-s")
	SetCmdWindowHidden(cmd)
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	exemptMap := make(map[string]bool)
	lines := strings.Split(string(output), "\n")

	// Pattern to match SID lines
	sidPattern := regexp.MustCompile(`S-1-15-2-[\d-]+`)

	for _, line := range lines {
		matches := sidPattern.FindAllString(line, -1)
		for _, sid := range matches {
			exemptMap[sid] = true
		}
	}

	return exemptMap, nil
}

// AddLoopbackExempt adds SIDs to loopback exemption list
func (m *UWPLoopbackManager) AddLoopbackExempt(sids []string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, sid := range sids {
		cmd := exec.Command("CheckNetIsolation", "LoopbackExempt", "-a", "-p="+sid)
		SetCmdWindowHidden(cmd)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to add exemption for %s: %w", sid, err)
		}
	}

	return nil
}

// RemoveLoopbackExempt removes SIDs from loopback exemption list
func (m *UWPLoopbackManager) RemoveLoopbackExempt(sids []string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, sid := range sids {
		cmd := exec.Command("CheckNetIsolation", "LoopbackExempt", "-d", "-p="+sid)
		SetCmdWindowHidden(cmd)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to remove exemption for %s: %w", sid, err)
		}
	}

	return nil
}

// ClearAllExemptions clears all loopback exemptions
func (m *UWPLoopbackManager) ClearAllExemptions() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	cmd := exec.Command("CheckNetIsolation", "LoopbackExempt", "-c")
	SetCmdWindowHidden(cmd)
	return cmd.Run()
}
