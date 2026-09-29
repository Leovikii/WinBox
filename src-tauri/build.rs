fn main() {
    let windows =
        tauri_build::WindowsAttributes::new().app_manifest(include_str!("windows-app.manifest"));
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
        .expect("failed to run Tauri build script");
    // tauri-build links resources only into bin targets. Updater test executables
    // also need Common Controls v6 when exercising the official updater runtime.
    let resource =
        std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap()).join("resource.lib");
    println!("cargo:rustc-link-arg-tests={}", resource.display());
}
