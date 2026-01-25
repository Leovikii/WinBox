# WinBox

A minimal, modern, and lightweight Windows GUI for [Sing-box](https://github.com/SagerNet/sing-box), built with [Wails](https://wails.io) and Vue 3.

![Platform](https://img.shields.io/badge/platform-Windows-blue.svg) ![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Features

* **⚡ Zero-Config Kernel**: Automatically detects system architecture (AMD64/ARM64), downloads, and updates the correct Sing-box kernel.
* **🛡️ Dual Modes**: Seamlessly toggle between **TUN Mode** (Virtual Network Interface) and **System Proxy Mode**.
* **🚀 Silent Start**: Optimized background process handling for a completely silent and window-free startup.
* **📂 Clean Structure**: All dependencies, kernels, profiles, and logs are neatly organized in a single `data/` folder.
* **🔗 GitHub Mirror**: Built-in toggle for GitHub mirrors to ensure stable downloads in restricted network environments.
* **🎨 Profile Manager**: Easily add, update, and manage remote subscription profiles.
* **⚙️ Advanced Config**: Built-in JSON editor with formatting for TUN and Mixed inbound overrides.

## 📥 Installation

1.  Go to the [Releases](../../releases) page.
2.  Download the latest `WinBox.exe`.
3.  **Run the application**.
    * *Note: The app requires Administrator privileges to manage network interfaces (TUN mode).*

## 🚀 Usage

1.  **First Run**: Go to **Settings** -> Click the **GitHub Mirror** switch if needed -> Click **"CHECK UPDATES"**.
2.  **Add Profile**: Open the "Profiles" drawer and paste your subscription URL.
3.  **Connect**: Toggle **TUN MODE** or **SYSTEM PROXY** on the main dashboard.

## 🛠️ Build from Source

**Prerequisites:**
* [Go](https://go.dev/) (1.21+)
* [Node.js](https://nodejs.org/) (18+)
* [Wails CLI](https://wails.io/docs/gettingstarted/installation)

**Build Steps:**

```bash
# 1. Clone the repository
git clone [https://github.com/YourUsername/WB.git](https://github.com/YourUsername/WB.git)
cd WB

# 2. Build the application (Production build)
wails build -clean -ldflags "-s -w"