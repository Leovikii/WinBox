//go:build windows

package internal

import (
	"os"
	"os/exec"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

// ============================================================================
// Process Control - Console and Signal Management
// ============================================================================

const ATTACH_PARENT_PROCESS uintptr = ^uintptr(0)

var (
	modKernel32 = windows.NewLazySystemDLL("kernel32.dll")

	procFreeConsole              = modKernel32.NewProc("FreeConsole")
	procAttachConsole            = modKernel32.NewProc("AttachConsole")
	procSetConsoleCtrlHandler    = modKernel32.NewProc("SetConsoleCtrlHandler")
	procGenerateConsoleCtrlEvent = modKernel32.NewProc("GenerateConsoleCtrlEvent")
)

// SetCmdWindowHidden configures a command to run with hidden window
func SetCmdWindowHidden(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: windows.CREATE_UNICODE_ENVIRONMENT | windows.CREATE_NEW_PROCESS_GROUP,
		HideWindow:    true,
	}
}

// SendExitSignal sends a graceful exit signal to a process
func SendExitSignal(p *os.Process) error {
	if ret, _, err := procFreeConsole.Call(); ret == 0 && err != windows.ERROR_INVALID_HANDLE {
		return err
	}

	defer func() {
		procAttachConsole.Call(ATTACH_PARENT_PROCESS)
	}()

	if ret, _, err := procAttachConsole.Call(uintptr(p.Pid)); ret == 0 && err != windows.ERROR_ACCESS_DENIED {
		return err
	}

	if ret, _, err := procSetConsoleCtrlHandler.Call(0, 1); ret == 0 {
		return err
	}

	if ret, _, err := procGenerateConsoleCtrlEvent.Call(windows.CTRL_BREAK_EVENT, uintptr(p.Pid)); ret == 0 {
		return err
	}

	return nil
}

// ============================================================================
// Window Management - DWM and Window Styling
// ============================================================================

var (
	dwmapi                    = windows.NewLazySystemDLL("dwmapi.dll")
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
