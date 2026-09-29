use std::sync::Arc;
use winbox_backend::program_update::LocalPackage;

#[tokio::test]
async fn official_updater_checks_local_package_and_rejects_invalid_signature() {
    use tauri_plugin_updater::UpdaterExt;
    let mut context = tauri::test::mock_context(tauri::test::noop_assets());
    let config: serde_json::Value =
        serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
    let mut updater_config = config["plugins"]["updater"].clone();
    updater_config["dangerousInsecureTransportProtocol"] = true.into();
    context
        .config_mut()
        .plugins
        .0
        .insert("updater".into(), updater_config);
    let app = tauri::test::mock_builder()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .build(context)
        .unwrap();
    let local = LocalPackage::serve(
        "99.0.0",
        "invalid signature",
        Arc::new(b"tampered package".to_vec()),
    )
    .await
    .unwrap();
    let update = app
        .updater_builder()
        .target("windows-x86_64-nsis")
        .no_proxy()
        .endpoints(vec![local.endpoint.clone()])
        .unwrap()
        .build()
        .unwrap()
        .check()
        .await
        .unwrap()
        .unwrap();
    assert_eq!(update.version, "99.0.0");
    let mut received = 0;
    assert!(update
        .download(|length, _| received += length, || {})
        .await
        .is_err());
    assert_eq!(received, b"tampered package".len());
}
