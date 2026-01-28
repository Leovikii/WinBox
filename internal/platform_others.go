//go:build !windows && !darwin

package internal

import (
	"os"
	"os/exec"
)

// SetCmdWindowHidden is a no-op on other platforms
func SetCmdWindowHidden(cmd *exec.Cmd) {
	// No-op on other platforms
}

// SendExitSignal sends a termination signal on other platforms
func SendExitSignal(p *os.Process) error {
	return p.Signal(os.Interrupt)
}

// SetWindowCorners is a no-op on other platforms
func SetWindowCorners(hwnd uintptr) error {
	return nil
}

// GetWindowHandle is a no-op on other platforms
func GetWindowHandle(title string) (uintptr, error) {
	return 0, nil
}
