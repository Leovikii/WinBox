//go:build darwin

package internal

// GetWindowHandle is a stub for non-Windows platforms
func GetWindowHandle(title string) (uintptr, error) {
	return 0, nil
}

// SetWindowCorners is a stub for non-Windows platforms
func SetWindowCorners(hwnd uintptr) error {
	return nil
}
