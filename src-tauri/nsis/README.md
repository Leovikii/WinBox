# NSIS template

`installer.nsi` reuses the official Tauri bundler 2.9.4 template (MIT / Apache-2.0). Source: https://github.com/tauri-apps/tauri/blob/tauri-bundler-v2.9.4/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi

Product changes: installation defaults to the official passive flow (visible progress, no wizard choices), then automatically launches WinBox after success. The uninstaller remains interactive. Passive reinstalls replace application files in place without reading absent maintenance radio controls. The current-user default directory adds `Programs`, and the official uninstall data checkbox defaults to checked. Tauri does not expose that checkbox default through configuration/hooks. Uninstall also requires WinBox to exit gracefully instead of force-killing it, so the core and proxy are cleaned up before data removal. Rebase these small changes when upgrading the bundler; keep the upstream copyright/license headers.

The upstream UpdateMode guard preserves data during updates. Interactive uninstall lets users uncheck data removal; unattended uninstall does not imply consent to delete data. The template removes the current-user Run entry and its Windows Startup apps approval value named WinBox during actual uninstall. Shared WebView2 runtime and unrelated system settings are not deleted.
