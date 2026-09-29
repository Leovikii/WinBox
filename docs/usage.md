# WinBox user guide

[Back to WinBox](../README.md)

## Installation and updates

Download the Windows AMD64/x64 installer from [Releases](https://github.com/Leovikii/WinBox/releases). ARM64 is not supported. The installer uses your Windows account and opens WinBox when installation finishes. WebView2 is required; the installer offers its installation if missing.

The default install location is `%LOCALAPPDATA%\Programs\WinBox`. Check for application and sing-box core updates in Settings. Enable **Pre-release updates** if you want beta releases. Application updates preserve user data.

If a download fails, check your network or configure **Download proxy** in Settings, then retry.

## Connection and permissions

- **Proxy** uses the Windows system proxy. Apps that ignore that setting may not use it.
- **TUN** routes traffic through a virtual network adapter.
- **Mixed** enables both TUN and the system proxy.

TUN and Mixed request administrator approval, then restart WinBox and connect. Use the same Windows account; entering another administrator account is not supported. The authorized instance remains elevated until you exit. UWP loopback changes also require approval; your selection is retained for confirmation after restart.

With **Smart** auto-connect, **Detecting** means the network check is in progress, **Standby** means the check found direct access and no automatic connection is needed, and **Net Timeout** means the network readiness check timed out. **Always** skips the smart check; **Off** disables automatic connection.

Sign-in startup stays minimized. When TUN or Mixed needs approval, WinBox waits instead of opening a UAC prompt automatically. Open it from the tray or notification and click **Start**. Notifications may be hidden by Windows notification settings or Do Not Disturb.

## Data and uninstalling

Profiles, settings, logs, WebView data, and the downloaded core are stored in `%LOCALAPPDATA%\com.leovikii.winbox`. Exit WinBox before backing up this folder.

Choose **Quit** from the tray menu before uninstalling so WinBox can stop its core and restore the system proxy it owns. Uninstall selects **Delete app data** by default; clear this option to retain your profiles and settings.

## Upgrading from alpha.3 or earlier

The current installation model does not support an in-place upgrade from alpha.3. Back up any profiles you need, disable startup in the old app, and exit it. Uninstall the old version and remove its remaining WinBox user data before installing the current version. Import your subscriptions again. Old installations and startup tasks are not automatically migrated.

## Getting help

[Report an issue](https://github.com/Leovikii/WinBox/issues) with your WinBox version, Windows version, steps to reproduce, and the relevant error or log excerpt. Remove subscription URLs, credentials, and other private information before posting.
