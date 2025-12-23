//go:build !windows

package main

import (
	"os"
	"os/exec"
)

func SetCmdWindowHidden(cmd *exec.Cmd) {
}

func SendExitSignal(p *os.Process) error {
	return p.Kill()
}

func IsProcessAlive(p *os.Process) (bool, error) {
	return false, nil
}
