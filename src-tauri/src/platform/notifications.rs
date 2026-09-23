use tauri::{AppHandle, Manager};
use windows::core::HSTRING;
use windows::Data::Xml::Dom::XmlDocument;
use windows::UI::Notifications::{ToastNotification, ToastNotificationManager};

const PERMISSION_TOAST: &str = "<toast activationType=\"protocol\" launch=\"winbox-notification://open\"><visual><binding template=\"ToastGeneric\"><text>Connection needs approval</text><text>TUN / Mixed requires administrator permission. Click to open WinBox.</text></binding></visual></toast>";

pub fn notify_permission(app: &AppHandle) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Err(error) = show_permission(&handle) {
            let runtime = handle
                .state::<crate::runtime::RuntimeState>()
                .inner()
                .clone();
            tauri::async_runtime::spawn(async move {
                let _ = runtime
                    .append_app_log(
                        &handle,
                        "ERROR",
                        &format!("Authorization notification failed: {error}"),
                    )
                    .await;
                // A failed notification must not leave the user with only a hidden tooltip.
                let _ = crate::commands::show(handle);
            });
        }
    });
}

fn show_permission(app: &AppHandle) -> windows::core::Result<()> {
    let xml = XmlDocument::new()?;
    xml.LoadXml(&HSTRING::from(PERMISSION_TOAST))?;
    let toast = ToastNotification::CreateToastNotification(&xml)?;
    // The official NSIS template applies this AUMID to the Start menu shortcut.
    let notifier = ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(
        app.config().identifier.as_str(),
    ))?;
    notifier.Show(&toast)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn notification_protocol_matches_installer_and_only_opens_the_app() {
        let xml = super::XmlDocument::new().unwrap();
        xml.LoadXml(&super::HSTRING::from(super::PERMISSION_TOAST))
            .unwrap();
        let root = xml.DocumentElement().unwrap();
        assert_eq!(
            root.GetAttribute(&"activationType".into()).unwrap(),
            "protocol"
        );
        let uri = root.GetAttribute(&"launch".into()).unwrap().to_string();
        let options = crate::startup::StartupOptions::from_args(["WinBox.exe", uri.as_str()]);
        assert!(options.notification);
        assert!(!options.autostart && !options.minimized);
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../../tauri.conf.json")).unwrap();
        assert!(config["plugins"]["deep-link"]["desktop"]["schemes"]
            .as_array()
            .unwrap()
            .iter()
            .any(|scheme| scheme == uri.split(':').next().unwrap()));
    }
}
