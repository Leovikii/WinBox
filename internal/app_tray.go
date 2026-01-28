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
			// Set tray icon or title
			if len(a.iconData) > 0 {
				systray.SetIcon(a.iconData)
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

			mRestart := systray.AddMenuItem("Restart", "Restart Application")
			mRestart.Click(func() {
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
	// Trick to bring window to front
	wailsRuntime.WindowSetAlwaysOnTop(a.ctx, true)
	wailsRuntime.WindowSetAlwaysOnTop(a.ctx, false)
}
