package main

import (
	"embed"
	"os"

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

func main() {
	startMinimized := false
	for _, arg := range os.Args {
		if arg == "-minimized" {
			startMinimized = true
			break
		}
	}

	app := internal.NewApp(icon, startMinimized)

	err := wails.Run(&options.App{
		Title:         "WinBox",
		Width:         400,
		Height:        720,
		DisableResize: false,
		Frameless:     true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 0},
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
