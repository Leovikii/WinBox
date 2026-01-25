//go:build windows

package internal

import (
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	dwmapi                  = windows.NewLazySystemDLL("dwmapi.dll")
	procDwmSetWindowAttribute = dwmapi.NewProc("DwmSetWindowAttribute")
)

const (
	DWMWA_WINDOW_CORNER_PREFERENCE = 33
	DWMWCP_ROUND                   = 2
)

// SetWindowCorners sets the window to have rounded corners
func SetWindowCorners(hwnd uintptr) error {
	cornerPreference := DWMWCP_ROUND
	ret, _, err := procDwmSetWindowAttribute.Call(
		hwnd,
		DWMWA_WINDOW_CORNER_PREFERENCE,
		uintptr(unsafe.Pointer(&cornerPreference)),
		unsafe.Sizeof(cornerPreference),
	)
	if ret != 0 {
		return err
	}
	return nil
}

// GetWindowHandle retrieves the window handle using user32.dll
func GetWindowHandle(title string) (uintptr, error) {
	user32 := syscall.NewLazyDLL("user32.dll")
	procFindWindow := user32.NewProc("FindWindowW")

	titlePtr, err := syscall.UTF16PtrFromString(title)
	if err != nil {
		return 0, err
	}

	hwnd, _, _ := procFindWindow.Call(0, uintptr(unsafe.Pointer(titlePtr)))
	return hwnd, nil
}
