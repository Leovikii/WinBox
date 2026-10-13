# WinBox user guide

[Back to WinBox](../README.md)

## Installation and updates

Download the Windows AMD64/x64 installer from [Releases](https://github.com/Leovikii/WinBox/releases). ARM64 is not supported. The installer uses your Windows account and opens WinBox when installation finishes. WebView2 is required; the installer offers its installation if missing.

The default install location is `%LOCALAPPDATA%\Programs\WinBox`. Check for application and sing-box core updates in Settings. Enable **Pre-release updates** if you want beta releases. Application updates preserve user data.

WinBox 3.0 requires **sing-box 1.14 or newer**. Update an older core in Settings before connecting.

If a download fails, check your network or configure **Download proxy** in Settings, then retry.

## Connection and permissions

- **Proxy** uses the Windows system proxy. Apps that ignore that setting may not use it.
- **TUN** routes traffic through a virtual network adapter.
- **Mixed** enables both TUN and the system proxy.

TUN and Mixed request administrator approval, then restart WinBox and connect. Use the same Windows account; entering another administrator account is not supported. The authorized instance remains elevated until you exit. UWP loopback changes also require approval; your selection is retained for confirmation after restart.

With **Smart** auto-connect, **Detecting** means the network check is in progress, **Standby** means the check found direct access and no automatic connection is needed, and **Net Timeout** means the network readiness check timed out. **Always** skips the smart check; **Off** disables automatic connection.

Sign-in startup stays minimized. When TUN or Mixed needs approval, WinBox waits instead of opening a UAC prompt automatically. Open it from the tray or notification and click **Start**. Notifications may be hidden by Windows notification settings or Do Not Disturb.

## Web UI and inbound settings

**Web UI** opens the enabled dashboard from the running configuration. Native sing-box Dashboard takes priority; Clash API dashboards remain supported. The native dashboard opens at the listener root address; Clash dashboards use `/ui/`. Authentication stays in the dashboard. If neither dashboard is enabled, WinBox explains this instead of opening a fixed port. Saved profile changes take effect after restarting the core.

The default mixed inbound listens only on `127.0.0.1:7893`, so other LAN devices cannot use it. TUN keeps the existing dual-stack addresses and MTU 9000, with `auto_redirect: false`. Existing customized inbounds are preserved. To adopt new defaults, use **Settings → Inbound config → Edit → Reset → Reset (confirmation) → Save**, then restart if connected. Each inbound must be a JSON object whose `type` matches the TUN or Mixed editor page.

## Data and uninstalling

Profiles, settings, logs, WebView data, and the downloaded core are stored in `%LOCALAPPDATA%\com.leovikii.winbox`. Exit WinBox before backing up this folder.

Choose **Quit** from the tray menu before uninstalling so WinBox can stop its core and restore the system proxy it owns. Uninstall selects **Delete app data** by default; clear this option to retain your profiles and settings.

## Upgrading from alpha.3 or earlier

The current installation model does not support an in-place upgrade from alpha.3. Back up any profiles you need, disable startup in the old app, and exit it. Uninstall the old version and remove its remaining WinBox user data before installing the current version. Import your subscriptions again. Old installations and startup tasks are not automatically migrated.

## Getting help

[Report an issue](https://github.com/Leovikii/WinBox/issues) with your WinBox version, Windows version, steps to reproduce, and the relevant error or log excerpt. Remove subscription URLs, credentials, and other private information before posting.
