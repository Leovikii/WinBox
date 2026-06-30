package main

import (
	"embed"
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"golang.org/x/sys/windows/registry"

	"WinBox/internal"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/windows/icon.ico
var icon []byte

//go:embed frontend/icon/tray.ico
var trayDefault []byte

//go:embed frontend/icon/tray_tun.ico
var trayTun []byte

//go:embed frontend/icon/tray_proxy.ico
var trayProxy []byte

//go:embed frontend/icon/tray_mixed.ico
var trayMixed []byte

func isSystemDark() bool {
	k, err := registry.OpenKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Themes\Personalize`, registry.QUERY_VALUE)
	if err != nil {
		return true
	}
	defer k.Close()
	val, _, err := k.GetIntegerValue("AppsUseLightTheme")
	if err != nil {
		return true
	}
	return val == 0
}

func main() {
	startMinimized := false
	for _, arg := range os.Args {
		if arg == "-minimized" {
			startMinimized = true
		}
		if arg == "-delay-start" {
			time.Sleep(1500 * time.Millisecond)
		}
	}

	app := internal.NewApp(icon, trayDefault, trayTun, trayProxy, trayMixed, startMinimized)

	// Determine initial theme for webview background to prevent flash
	bgColour := &options.RGBA{R: 20, G: 20, B: 20, A: 0}
	winTheme := windows.SystemDefault
	exe, err := os.Executable()
	if err == nil {
		appDir := filepath.Dir(exe)
		settingsPath := filepath.Join(appDir, "data", "config", "settings.json")
		data, err := os.ReadFile(settingsPath)
		if err == nil {
			var meta struct {
				ThemeMode string `json:"theme_mode"`
			}
			if json.Unmarshal(data, &meta) == nil {
				if meta.ThemeMode == "light" || (meta.ThemeMode == "system" && !isSystemDark()) {
					bgColour = &options.RGBA{R: 253, G: 253, B: 253, A: 0}
					winTheme = windows.Light
				} else if meta.ThemeMode == "dark" || (meta.ThemeMode == "system" && isSystemDark()) {
					winTheme = windows.Dark
				}
			}
		}
	}

	err = wails.Run(&options.App{
		Title:         "WinBox",
		Width:         400,
		Height:        720,
		DisableResize: false,
		Frameless:     true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: bgColour,
		OnStartup:        app.Startup,
		OnShutdown:       app.OnShutdown,
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: "c79c67f4-c24c-4e4b-8c67-0e6e7e112345",
			OnSecondInstanceLaunch: func(secondInstanceData options.SecondInstanceData) {
				app.Show()
			},
		},
		Bind: []interface{}{
			app,
		},
		Windows: &windows.Options{
			Theme:                             winTheme,
			WebviewIsTransparent:              true,
			WindowIsTranslucent:               true,
			BackdropType:                      windows.Mica,
			DisableWindowIcon:                 false,
			DisableFramelessWindowDecorations: true,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
