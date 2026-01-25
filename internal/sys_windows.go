//go:build windows

package internal

import (
	"os"
	"os/exec"
	"syscall"

	"golang.org/x/sys/windows"
)

const ATTACH_PARENT_PROCESS uintptr = ^uintptr(0)

var (
	modKernel32 = windows.NewLazySystemDLL("kernel32.dll")

	procFreeConsole              = modKernel32.NewProc("FreeConsole")
	procAttachConsole            = modKernel32.NewProc("AttachConsole")
	procSetConsoleCtrlHandler    = modKernel32.NewProc("SetConsoleCtrlHandler")
	procGenerateConsoleCtrlEvent = modKernel32.NewProc("GenerateConsoleCtrlEvent")
)

func SetCmdWindowHidden(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: windows.CREATE_UNICODE_ENVIRONMENT | windows.CREATE_NEW_PROCESS_GROUP,
		HideWindow:    true,
	}
}

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
