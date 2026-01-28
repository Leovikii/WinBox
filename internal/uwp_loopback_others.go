//go:build !windows

package internal

import "fmt"

// UWPApp represents a UWP application
type UWPApp struct {
	SID         string `json:"sid"`
	DisplayName string `json:"displayName"`
	PackageName string `json:"packageName"`
	IsExempt    bool   `json:"isExempt"`
}

// UWPLoopbackManager manages UWP loopback exemptions
type UWPLoopbackManager struct{}

// NewUWPLoopbackManager creates a new UWP loopback manager
func NewUWPLoopbackManager() *UWPLoopbackManager {
	return &UWPLoopbackManager{}
}

// GetUWPApps returns empty list on non-Windows platforms
func (m *UWPLoopbackManager) GetUWPApps() ([]UWPApp, error) {
	return []UWPApp{}, fmt.Errorf("UWP loopback is only supported on Windows")
}

// AddLoopbackExempt is a no-op on non-Windows platforms
func (m *UWPLoopbackManager) AddLoopbackExempt(sids []string) error {
	return fmt.Errorf("UWP loopback is only supported on Windows")
}

// RemoveLoopbackExempt is a no-op on non-Windows platforms
func (m *UWPLoopbackManager) RemoveLoopbackExempt(sids []string) error {
	return fmt.Errorf("UWP loopback is only supported on Windows")
}

// ClearAllExemptions is a no-op on non-Windows platforms
func (m *UWPLoopbackManager) ClearAllExemptions() error {
	return fmt.Errorf("UWP loopback is only supported on Windows")
}
