//go:build !windows

package internal

import (
	"os"
	"os/exec"
)

func SetCmdWindowHidden(cmd *exec.Cmd) {
}

func SendExitSignal(p *os.Process) error {
	return p.Kill()
}
