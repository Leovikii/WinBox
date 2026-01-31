package internal

import (
	"runtime"

	"github.com/energye/systray"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// StartTray initializes and starts the system tray
func (a *App) StartTray() {
	go func() {
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()

		systray.Run(func() {
			if len(a.trayIcons.Default) > 0 {
				systray.SetIcon(a.trayIcons.Default)
			} else {
				systray.SetTitle("WinBox")
			}

			systray.SetTooltip("WinBox Client")

			// Left click: show window
			systray.SetOnClick(func(menu systray.IMenu) {
				go a.Show()
			})

			// Right click: show menu
			systray.SetOnRClick(func(menu systray.IMenu) {
				menu.ShowMenu()
			})

			// Menu items
			mOpen := systray.AddMenuItem("Open APP", "Open main window")
			mOpen.Click(func() {
				go a.Show()
			})

			systray.AddSeparator()

			mRestartCore := systray.AddMenuItem("Restart Core", "Restart sing-box kernel")
			mRestartCore.Click(func() {
				go func() {
					result := a.RestartCore()
					if result != "Success" {
						a.appLogger.Error("Tray restart core failed: " + result)
					}
				}()
			})

			mRestartApp := systray.AddMenuItem("Restart APP", "Restart WinBox application")
			mRestartApp.Click(func() {
				go a.Restart()
			})

			systray.AddSeparator()

			mQuit := systray.AddMenuItem("Quit", "Quit Application")
			mQuit.Click(func() {
				systray.Quit()
				go a.Quit()
			})

		}, func() {
			// OnExit callback (cleanup if needed)
		})
	}()
}

// MinimizeToTray hides the window to system tray
func (a *App) MinimizeToTray() {
	wailsRuntime.WindowHide(a.ctx)
}

// Minimize minimizes the window to taskbar
func (a *App) Minimize() {
	wailsRuntime.WindowMinimise(a.ctx)
}

// Show shows and focuses the window
func (a *App) Show() {
	wailsRuntime.WindowShow(a.ctx)
	wailsRuntime.WindowUnminimise(a.ctx)
	wailsRuntime.WindowSetAlwaysOnTop(a.ctx, true)
	wailsRuntime.WindowSetAlwaysOnTop(a.ctx, false)
}

// UpdateTrayIcon updates the tray icon based on current core state
func (a *App) UpdateTrayIcon() {
	if !a.coreManager.IsRunning() {
		systray.SetIcon(a.trayIcons.Default)
		systray.SetTooltip("WinBox - Stopped")
		return
	}

	meta, err := a.storage.LoadMeta()
	if err != nil {
		systray.SetIcon(a.trayIcons.Default)
		systray.SetTooltip("WinBox - Stopped")
		return
	}

	if meta.TunMode && meta.SysProxy {
		systray.SetIcon(a.trayIcons.Full)
		systray.SetTooltip("WinBox - Full Mode (TUN + Proxy)")
	} else if meta.TunMode {
		systray.SetIcon(a.trayIcons.Tun)
		systray.SetTooltip("WinBox - TUN Mode")
	} else if meta.SysProxy {
		systray.SetIcon(a.trayIcons.Proxy)
		systray.SetTooltip("WinBox - Proxy Mode")
	} else {
		systray.SetIcon(a.trayIcons.Default)
		systray.SetTooltip("WinBox - Stopped")
	}
}
