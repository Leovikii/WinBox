# <img src="frontend/src/assets/icon-builder/src/tray.svg" width="32" style="vertical-align: -5px;"> WinBox

![Platform](https://img.shields.io/badge/platform-Windows-blue.svg) ![License](https://img.shields.io/badge/license-MIT-green.svg)

A minimal, modern, and highly optimized Windows GUI for [Sing-box](https://github.com/SagerNet/sing-box), engineered with [Tauri 2](https://tauri.app), Rust, React, and Microsoft Fluent UI.

<div align="center">
  <img src="frontend/src/assets/demo/demo1.png" alt="WinBox Dashboard 1" width="350" style="border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.1); margin: 0 10px;">
  <img src="frontend/src/assets/demo/demo2.png" alt="WinBox Dashboard 2" width="350" style="border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.1); margin: 0 10px;">
</div>

## Overview

WinBox is designed to provide a seamless and professional proxy management experience on Windows. It combines a Rust backend with a modern, lightweight frontend, prioritizing stability, performance, and automation.

## Key Features

* **Smart Auto-Connect**: Checks network access at startup and connects when needed. Always and Off modes are also available; TUN and Mixed wait for administrator approval.
* **Zero-Configuration Kernel**: Fully automated provisioning for Windows AMD64/x64. WinBox downloads, installs, and updates the matching Sing-box core without manual intervention.
* **UWP Loopback Manager**: Includes a built-in exemption manager to grant Windows UWP applications (e.g., Microsoft Store apps) local loopback access, effortlessly bypassing Windows AppContainer isolation.
* **High-Performance Architecture**: Batches event-driven logs and isolates traffic rendering to keep the dashboard responsive. The application is compiled with advanced optimization flags for a drastically reduced binary footprint.
* **Modern Design System**: Crafted following WinUI 3 principles. It features an adaptive Light/Dark mode and utilizes a premium, high-contrast color palette inspired by Radix UI, delivering a professional and native Windows 11 aesthetic.
* **Three Routing Modes**: Choose Proxy, TUN (virtual network adapter), or Mixed (TUN and system proxy).
* **Background Startup**: Starts minimized at sign-in. A Windows notification lets you open WinBox when automatic connection requires approval.

## 3.0.0-alpha.4

- Current-user NSIS installation with visible installation/update progress.
- WinBox starts without administrator privileges. TUN and Mixed request UAC authorization when needed, then restart and connect.
- Sign-in startup stays minimized and waits for authorization when automatic connection needs TUN. No Windows service or elevated startup task is installed.
- Startup restores WinBox's recorded system proxy before network checks or connection attempts. Errors appear in a shared English toast without moving the page layout.
- Uninstall defaults to deleting WinBox user data; uncheck the option to retain it. Exit WinBox from its tray menu first so its core stops and its system proxy is restored.

## Installation

1. Download the Windows AMD64/x64 NSIS installer from [Releases](https://github.com/Leovikii/WinBox/releases).
2. Install for the current user. The default directory is `%LOCALAPPDATA%\Programs\WinBox`.
3. Installation starts immediately, shows progress, and launches WinBox automatically. There are no Next, directory-selection or Finish steps. Updates use the same visible automatic flow.

User data lives in `%LOCALAPPDATA%\com.leovikii.winbox`: subscriptions, settings, logs, WebView data and the downloaded sing-box core. Application updates preserve this directory. Interactive uninstall checks **Delete app data** by default; clear the checkbox to retain it.

**Alpha.4 requires a fresh installation.** In alpha.3, disable startup and exit; uninstall it and manually remove any remaining WinBox user data before installing alpha.4. There is no data migration, old-task cleanup or compatibility code, and an in-place update from alpha.3 is not supported. Import your subscriptions again.

TUN/Mixed authorization uses the same Windows account; entering a different administrator account is not supported. Once authorized, this WinBox instance remains elevated until exit. UWP changes also require authorization and retain the draft for confirmation after restart. Updates from an elevated instance first restart WinBox without elevation.

## Quick Start

1. **First Initialization**: Navigate to **Settings**. If operating in a restricted network environment, enable the **GitHub Mirror** option. Click **"Check Updates"** to automatically provision the Sing-box kernel.
2. **Import Profiles**: Open the "Profile" manager to add and manage your subscription URLs.
3. **Connect**: Select **Proxy**, **TUN**, or **Mixed**, then click **Start**.

## Build from Source

**Prerequisites:**
* [Rust](https://www.rust-lang.org/tools/install) (1.97+, Windows x64 MSVC toolchain and Visual Studio C++ Build Tools)
* [Node.js](https://nodejs.org/) (20.19+ on Node 20, or 22.12+)
* WebView2 Runtime
* [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

**Build Instructions:**

```bash
# 1. Clone the repository
git clone https://github.com/Leovikii/WinBox.git
cd WinBox

# 2. Install frontend dependencies and build the frontend
npm ci --prefix frontend
npm --prefix frontend run build

# 3. Install the pinned CLI, then build the x64 NSIS installer for local testing
cargo install tauri-cli --version 2.11.4 --locked
cargo tauri build --target x86_64-pc-windows-msvc --bundles nsis --no-sign
```

Pull requests to `main` build the unsigned x64 NSIS installer for validation.
After merge, GitHub Actions signs and publishes the NSIS installer and the
official Tauri updater artifacts. Local test executables are never used as
release inputs. This release line does not publish portable, MSI or ARM64
artifacts.

The in-app updater uses the existing pre-release setting when checking release
metadata; no separate update channel is created.

Development of `3.0.0-alpha.4` is complete, including reduced default privileges and current-user installation. Publication follows the maintainer's `dev` → `main` pull request and the existing signed release workflow.

Development guides: [Architecture](docs/architecture.md),
[Frontend design](docs/frontend.md), [Backend contracts](docs/backend.md),
[Testing and release](docs/development.md). AI agents start with [AGENTS.md](AGENTS.md).
