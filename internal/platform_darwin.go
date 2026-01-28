//go:build darwin

package internal

import "os/exec"

// SetCmdWindowHidden is a no-op on macOS
func SetCmdWindowHidden(cmd *exec.Cmd) {
	// No-op on macOS
}

// SetWindowCorners is a no-op on macOS
func SetWindowCorners(hwnd uintptr) error {
	return nil
}

// GetWindowHandle is a no-op on macOS
func GetWindowHandle(title string) (uintptr, error) {
	return 0, nil
}
