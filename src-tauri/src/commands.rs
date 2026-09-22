use crate::core::CoreProcess;
use crate::models::{DataSnapshot, Profile, DEFAULT_MIXED_CONFIG, DEFAULT_TUN_CONFIG};
use crate::paths::AppPaths;
use crate::platform::windows::{
    configure_hidden_command, get_uwp_apps as platform_get_uwp_apps, read_system_proxy,
    replace_file_with_backup, restore_system_proxy, set_autostart, set_loopback_exemptions,
};
use crate::runtime::RuntimeState;
use crate::storage::{Storage, StorageError};
use crate::updates::{expected_sing_box_asset_name, stage_sing_box_archive, TargetArchitecture};
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use std::time::Duration;
use tauri::image::Image;
use tauri::menu::CheckMenuItem;
use tauri::window::{Effect, EffectsBuilder};
use tauri::Theme;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_updater::{Updater, UpdaterExt};
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex;
use tokio::time::sleep;
use uuid::Uuid;

const MAX_PROFILE_BYTES: usize = 32 * 1024 * 1024;
const MAX_UPDATE_BYTES: u64 = 512 * 1024 * 1024;
const DEFAULT_DASHBOARD_URL: &str = "http://127.0.0.1:9090/ui";
const HTTP_USER_AGENT: &str = "sing-box";
const PROGRAM_REPOSITORY: &str = "https://github.com/Leovikii/WinBox";
const PROGRAM_REPOSITORY_API: &str = "https://api.github.com/repos/Leovikii/WinBox";

#[derive(Debug, Serialize)]
pub struct AppError {
    pub code: String,
    pub message: String,
}

impl AppError {
    fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.to_owned(),
            message: message.to_owned(),
        }
    }
    fn detailed(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.to_owned(),
            message: message.into(),
        }
    }
    fn invalid_input(message: &str) -> Self {
        Self::new("invalid_input", message)
    }
    fn operation_failed() -> Self {
        Self::new("operation_failed", "The requested operation failed")
    }
    fn storage_load() -> Self {
        Self::new(
            "storage_load_failed",
            "Failed to load local application data",
        )
    }
    fn storage_write() -> Self {
        Self::new(
            "storage_write_failed",
            "Failed to save local application data",
        )
    }
    fn invalid_override_type() -> Self {
        Self::new(
            "invalid_override_type",
            "Override type must be tun or mixed",
        )
    }
    fn invalid_override_json() -> Self {
        Self::new(
            "invalid_override_json",
            "Override content must be valid JSON",
        )
    }
    fn update_failed() -> Self {
        Self::new("update_failed", "The update could not be completed")
    }
}

fn io_error_detail(error: &io::Error) -> String {
    match error.raw_os_error() {
        Some(code) => format!("{} (OS error {code})", error),
        None => error.to_string(),
    }
}

fn update_phase_error(code: &str, phase: &str, error: impl std::fmt::Display) -> AppError {
    AppError::detailed(code, format!("Kernel update {phase} failed: {error}"))
}

async fn log_update_phase(
    runtime: &RuntimeState,
    app: &AppHandle,
    level: &str,
    message: impl Into<String>,
) {
    let message = message.into();
    let _ = runtime.append_app_log(app, level, &message).await;
}

fn safe_error_message(error: &AppError) -> &str {
    if error.code == "config_invalid" {
        "configuration rejected"
    } else {
        error.message.as_str()
    }
}

async fn log_command_failure(
    runtime: &RuntimeState,
    app: &AppHandle,
    operation: &str,
    error: &AppError,
) {
    let message = format!(
        "{operation} failed [{}]: {}",
        error.code,
        safe_error_message(error)
    );
    let _ = runtime.append_app_log(app, "ERROR", &message).await;
}

async fn log_failed_result<T>(
    runtime: &RuntimeState,
    app: &AppHandle,
    operation: &str,
    result: Result<T, AppError>,
) -> Result<T, AppError> {
    if let Err(error) = &result {
        log_command_failure(runtime, app, operation, error).await;
    }
    result
}

impl From<StorageError> for AppError {
    fn from(_: StorageError) -> Self {
        Self::storage_load()
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitDataDto {
    pub running: bool,
    pub core_busy: bool,
    pub core_exists: bool,
    pub local_version: String,
    pub tun_mode: bool,
    pub sys_proxy: bool,
    pub profiles: Vec<Profile>,
    pub active_profile: Option<Profile>,
    pub mirror: String,
    pub mirror_enabled: bool,
    pub start_on_boot: bool,
    pub auto_connect_state: String,
    pub theme_mode: String,
    pub accent_color: String,
    pub ipv6_enabled: bool,
    pub pre_release: bool,
    pub log_level: String,
    pub log_to_file: bool,
    pub close_behavior: String,
}

#[derive(Debug, Deserialize)]
struct ReleaseInfo {
    tag_name: String,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    assets: Vec<ReleaseAsset>,
}

#[derive(Debug, Deserialize)]
struct ReleaseAsset {
    name: String,
    browser_download_url: String,
    #[serde(default)]
    digest: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgramUpdateDto {
    pub version: String,
    pub changelog: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UwpAppDto {
    pub sid: String,
    pub display_name: String,
    pub package_name: String,
    pub is_exempt: bool,
}

#[derive(Clone)]
pub struct TrayMenuState {
    pub mode_mixed: CheckMenuItem<tauri::Wry>,
    pub mode_tun: CheckMenuItem<tauri::Wry>,
    pub mode_proxy: CheckMenuItem<tauri::Wry>,
    pub stop: CheckMenuItem<tauri::Wry>,
}

async fn init_data_from_snapshot(
    storage: &Storage,
    runtime: &RuntimeState,
    snapshot: DataSnapshot,
) -> InitDataDto {
    let core_exists = storage.paths().core_dir.join("sing-box.exe").is_file();
    let active_profile = snapshot
        .profiles
        .iter()
        .find(|profile| profile.id == snapshot.state.active_id)
        .cloned();
    InitDataDto {
        running: runtime.core().await.is_some(),
        core_busy: runtime.core_busy(),
        core_exists,
        local_version: local_version(&storage.paths().core_dir),
        tun_mode: snapshot.state.tun_mode,
        sys_proxy: snapshot.state.sys_proxy,
        profiles: snapshot.profiles,
        active_profile,
        mirror: snapshot.settings.mirror,
        mirror_enabled: snapshot.settings.mirror_enabled,
        start_on_boot: snapshot.settings.start_on_boot,
        auto_connect_state: snapshot.settings.auto_connect_state,
        theme_mode: snapshot.settings.theme_mode,
        accent_color: snapshot.settings.accent_color,
        ipv6_enabled: snapshot.settings.ipv6_enabled,
        pre_release: snapshot.settings.pre_release,
        log_level: snapshot.settings.log_level,
        log_to_file: snapshot.settings.log_to_file,
        close_behavior: snapshot.settings.close_behavior,
    }
}

#[tauri::command]
pub async fn get_init_data(
    storage: State<'_, Storage>,
    runtime: State<'_, RuntimeState>,
) -> Result<InitDataDto, AppError> {
    let snapshot = storage.load().map_err(|_| AppError::storage_load())?;
    Ok(init_data_from_snapshot(&storage, &runtime, snapshot).await)
}

#[tauri::command]
pub fn get_product_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

fn validate_override_type(name: &str) -> Result<(), AppError> {
    if matches!(name, "tun" | "mixed") {
        Ok(())
    } else {
        Err(AppError::invalid_override_type())
    }
}

fn override_from_snapshot(snapshot: &DataSnapshot, name: &str) -> Result<String, AppError> {
    validate_override_type(name)?;
    match name {
        "tun" => Ok(snapshot.tun_config.clone()),
        "mixed" => Ok(snapshot.mixed_config.clone()),
        _ => unreachable!("override type was validated"),
    }
}

fn default_override(name: &str) -> Result<&'static str, AppError> {
    validate_override_type(name)?;
    match name {
        "tun" => Ok(DEFAULT_TUN_CONFIG),
        "mixed" => Ok(DEFAULT_MIXED_CONFIG),
        _ => unreachable!("override type was validated"),
    }
}

#[tauri::command]
pub fn get_override(name: String, storage: State<'_, Storage>) -> Result<String, AppError> {
    let snapshot = storage.load().map_err(|_| AppError::storage_load())?;
    override_from_snapshot(&snapshot, &name)
}

#[tauri::command]
pub fn get_default_override(name: String) -> Result<String, AppError> {
    default_override(&name).map(str::to_owned)
}

fn map_storage_write_error(error: StorageError) -> AppError {
    match error {
        StorageError::InvalidOverride { .. } => AppError::invalid_override_json(),
        StorageError::Io { .. } | StorageError::Json { .. } => AppError::storage_write(),
    }
}

#[tauri::command]
pub fn save_override(
    name: String,
    content: String,
    storage: State<'_, Storage>,
) -> Result<(), AppError> {
    validate_override_type(&name)?;
    storage
        .save_override(&name, &content)
        .map_err(map_storage_write_error)
}

#[tauri::command]
pub fn reset_override(name: String, storage: State<'_, Storage>) -> Result<(), AppError> {
    let content = default_override(&name)?;
    storage
        .save_override(&name, content)
        .map_err(map_storage_write_error)
}

#[tauri::command(rename_all = "camelCase")]
pub fn save_settings(
    mirror: String,
    enabled: bool,
    storage: State<'_, Storage>,
) -> Result<String, AppError> {
    if enabled {
        validate_http_url(&mirror)?;
    }
    let mut snapshot = storage.load().map_err(|_| AppError::storage_load())?;
    snapshot.settings.mirror = mirror;
    snapshot.settings.mirror_enabled = enabled;
    storage.save(&snapshot).map_err(map_storage_write_error)?;
    Ok("Success".to_owned())
}

#[tauri::command]
pub fn set_start_on_boot(enabled: bool, storage: State<'_, Storage>) -> Result<String, AppError> {
    let executable = std::env::current_exe().map_err(|_| AppError::operation_failed())?;
    set_autostart(&executable, enabled).map_err(|_| AppError::operation_failed())?;
    let mut snapshot = storage.load().map_err(|_| AppError::storage_load())?;
    snapshot.settings.start_on_boot = enabled;
    storage.save(&snapshot).map_err(map_storage_write_error)?;
    Ok("Success".to_owned())
}

#[tauri::command]
pub fn set_auto_connect(state: String, storage: State<'_, Storage>) -> Result<String, AppError> {
    if !matches!(state.as_str(), "off" | "smart" | "always") {
        return Err(AppError::invalid_input(
            "Auto-connect state must be off, smart, or always",
        ));
    }
    let mut snapshot = storage.load().map_err(|_| AppError::storage_load())?;
    snapshot.settings.auto_connect_state = state;
    storage.save(&snapshot).map_err(map_storage_write_error)?;
    Ok("Success".to_owned())
}

#[tauri::command(rename_all = "camelCase")]
pub fn save_theme(
    mode: String,
    accent_color: String,
    storage: State<'_, Storage>,
) -> Result<String, AppError> {
    if !matches!(mode.as_str(), "light" | "dark" | "system") {
        return Err(AppError::invalid_input("Theme mode is invalid"));
    }
    if !is_hex_color(&accent_color) {
        return Err(AppError::invalid_input("Accent color is invalid"));
    }
    let mut snapshot = storage.load().map_err(|_| AppError::storage_load())?;
    snapshot.settings.theme_mode = mode;
    snapshot.settings.accent_color = accent_color;
    storage.save(&snapshot).map_err(map_storage_write_error)?;
    Ok("Success".to_owned())
}

fn window_theme(mode: &str) -> Result<(Option<Theme>, Effect), AppError> {
    match mode {
        "light" => Ok((Some(Theme::Light), Effect::MicaLight)),
        "dark" => Ok((Some(Theme::Dark), Effect::MicaDark)),
        "system" => Ok((None, Effect::Mica)),
        _ => Err(AppError::invalid_input("Theme mode is invalid")),
    }
}

#[tauri::command]
pub fn set_window_theme(app: AppHandle, mode: String) -> Result<(), AppError> {
    let (theme, effect) = window_theme(&mode)?;
    let window = app
        .get_webview_window("main")
        .ok_or_else(AppError::operation_failed)?;
    window
        .set_theme(theme)
        .map_err(|_| AppError::operation_failed())?;
    window
        .set_effects(EffectsBuilder::new().effect(effect).build())
        .map_err(|_| AppError::operation_failed())
}

#[tauri::command(rename_all = "camelCase")]
pub fn save_mode(
    tun_mode: bool,
    sys_proxy: bool,
    storage: State<'_, Storage>,
) -> Result<String, AppError> {
    let mut snapshot = storage.load().map_err(|_| AppError::storage_load())?;
    snapshot.state.tun_mode = tun_mode;
    snapshot.state.sys_proxy = sys_proxy;
    storage.save(&snapshot).map_err(map_storage_write_error)?;
    Ok("Success".to_owned())
}

#[tauri::command]
pub fn toggle_ipv6(enabled: bool, storage: State<'_, Storage>) -> Result<String, AppError> {
    let mut snapshot = storage.load().map_err(|_| AppError::storage_load())?;
    snapshot.settings.ipv6_enabled = enabled;
    storage.save(&snapshot).map_err(map_storage_write_error)?;
    Ok("Success".to_owned())
}

#[tauri::command]
pub fn set_pre_release(enabled: bool, storage: State<'_, Storage>) -> Result<String, AppError> {
    let mut snapshot = storage.load().map_err(|_| AppError::storage_load())?;
    snapshot.settings.pre_release = enabled;
    storage.save(&snapshot).map_err(map_storage_write_error)?;
    Ok("Success".to_owned())
}

#[tauri::command(rename_all = "camelCase")]
pub fn set_log_config(
    level: String,
    to_file: bool,
    storage: State<'_, Storage>,
) -> Result<String, AppError> {
    if !level.is_empty()
        && !matches!(
            level.as_str(),
            "trace" | "debug" | "info" | "warn" | "error" | "fatal"
        )
    {
        return Err(AppError::invalid_input("Log level is invalid"));
    }
    let mut snapshot = storage.load().map_err(|_| AppError::storage_load())?;
    snapshot.settings.log_level = level;
    snapshot.settings.log_to_file = to_file;
    storage.save(&snapshot).map_err(map_storage_write_error)?;
    Ok("Success".to_owned())
}

#[tauri::command]
pub fn set_close_behavior(
    behavior: String,
    storage: State<'_, Storage>,
) -> Result<String, AppError> {
    if !matches!(behavior.as_str(), "ask" | "tray" | "quit") {
        return Err(AppError::invalid_input("Close behavior is invalid"));
    }
    let mut snapshot = storage.load().map_err(|_| AppError::storage_load())?;
    snapshot.settings.close_behavior = behavior;
    storage.save(&snapshot).map_err(map_storage_write_error)?;
    Ok("Success".to_owned())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn apply_state(
    app: AppHandle,
    target_tun: bool,
    target_proxy: bool,
    storage: State<'_, Storage>,
    runtime: State<'_, RuntimeState>,
) -> Result<String, AppError> {
    apply_state_impl(&app, target_tun, target_proxy, &storage, &runtime).await
}

fn requested_mode(target_tun: bool, target_proxy: bool) -> Option<(bool, bool)> {
    (target_tun || target_proxy).then_some((target_tun, target_proxy))
}

async fn apply_state_impl(
    app: &AppHandle,
    target_tun: bool,
    target_proxy: bool,
    storage: &Storage,
    runtime: &RuntimeState,
) -> Result<String, AppError> {
    let _operation = runtime.core_operation(app).await;
    let mut snapshot = storage.load().map_err(|_| AppError::storage_load())?;

    let Some((target_tun, target_proxy)) = requested_mode(target_tun, target_proxy) else {
        let _ = app.emit("core-stopping", ());
        let result = stop_core_impl(app, runtime).await;
        if result == "Stopped" || result == "Already stopped" {
            let _ = app.emit("status", false);
            let _ = app.emit(
                "state-sync",
                json!({
                    "tunMode": snapshot.state.tun_mode,
                    "sysProxy": snapshot.state.sys_proxy
                }),
            );
            refresh_tray(
                app,
                false,
                snapshot.state.tun_mode,
                snapshot.state.sys_proxy,
            );
        }
        return Ok(result);
    };

    if active_profile_path(&snapshot, storage.paths()).is_err() {
        return Ok("config-missing".to_owned());
    }
    let was_running = runtime.core().await.is_some();
    let needs_restart = !was_running
        || snapshot.state.tun_mode != target_tun
        || snapshot.state.sys_proxy != target_proxy;

    let previous = snapshot.clone();
    snapshot.state.tun_mode = target_tun;
    snapshot.state.sys_proxy = target_proxy;
    storage.save(&snapshot).map_err(map_storage_write_error)?;
    if !needs_restart {
        let _ = app.emit(
            "state-sync",
            json!({"tunMode": target_tun, "sysProxy": target_proxy}),
        );
        return Ok("Success".to_owned());
    }

    let _ = app.emit(
        if was_running {
            "core-restarting"
        } else {
            "core-starting"
        },
        (),
    );
    if was_running {
        let stop_result = stop_core_impl(app, runtime).await;
        if stop_result.starts_with("Error") {
            let _ = storage.save(&previous);
            let _ = app.emit("status", runtime.core().await.is_some());
            let _ = app.emit(
                "state-sync",
                json!({
                    "tunMode": previous.state.tun_mode,
                    "sysProxy": previous.state.sys_proxy
                }),
            );
            return Ok(stop_result);
        }
    }
    match start_core_impl(app, storage, runtime, &snapshot).await {
        Ok(()) => {
            let _ = app.emit("status", true);
            let _ = app.emit(
                "state-sync",
                json!({"tunMode": target_tun, "sysProxy": target_proxy}),
            );
            refresh_tray(app, true, target_tun, target_proxy);
            Ok("Success".to_owned())
        }
        Err(error) => {
            let _ = storage.save(&previous);
            let _ = app.emit("status", false);
            Ok(format!("Error: {}", error.message))
        }
    }
}

#[tauri::command]
pub async fn restart_core(
    app: AppHandle,
    storage: State<'_, Storage>,
    runtime: State<'_, RuntimeState>,
) -> Result<String, AppError> {
    restart_core_impl(&app, &storage, &runtime).await
}

async fn restart_core_impl(
    app: &AppHandle,
    storage: &Storage,
    runtime: &RuntimeState,
) -> Result<String, AppError> {
    let _operation = runtime.core_operation(app).await;
    if runtime.core().await.is_none() {
        return Ok("Error: Core is not running".to_owned());
    }
    let snapshot = storage.load().map_err(|_| AppError::storage_load())?;
    let _ = app.emit("core-restarting", ());
    let stop_result = stop_core_impl(app, runtime).await;
    if stop_result.starts_with("Error") {
        let _ = app.emit("status", runtime.core().await.is_some());
        return Ok(stop_result);
    }
    match start_core_impl(app, storage, runtime, &snapshot).await {
        Ok(()) => {
            let _ = app.emit("status", true);
            let _ = app.emit(
                "state-sync",
                json!({
                    "tunMode": snapshot.state.tun_mode,
                    "sysProxy": snapshot.state.sys_proxy
                }),
            );
            refresh_tray(app, true, snapshot.state.tun_mode, snapshot.state.sys_proxy);
            Ok("Success".to_owned())
        }
        Err(error) => {
            let _ = app.emit("status", false);
            refresh_tray(
                app,
                false,
                snapshot.state.tun_mode,
                snapshot.state.sys_proxy,
            );
            Ok(format!("Error: {}", error.message))
        }
    }
}

fn report_tray_result(app: &AppHandle, result: Result<String, AppError>) {
    let message = match result {
        Ok(message) if matches!(message.as_str(), "Success" | "Stopped" | "Already stopped") => {
            return
        }
        Ok(message) => message,
        Err(error) => error.message,
    };
    let _ = app.emit(
        "log",
        format!("Error: {}", message.trim_start_matches("Error: ")),
    );
}

pub async fn apply_state_from_tray(app: AppHandle, target_tun: bool, target_proxy: bool) {
    let storage = app.state::<Storage>().inner().clone();
    let runtime = app.state::<RuntimeState>().inner().clone();
    let result = apply_state_impl(&app, target_tun, target_proxy, &storage, &runtime).await;
    report_tray_result(&app, result);
}

pub async fn restart_core_from_tray(app: AppHandle) {
    let storage = app.state::<Storage>().inner().clone();
    let runtime = app.state::<RuntimeState>().inner().clone();
    let result = restart_core_impl(&app, &storage, &runtime).await;
    report_tray_result(&app, result);
}

#[tauri::command]
pub async fn add_profile(
    app: AppHandle,
    name: String,
    url: String,
    storage: State<'_, Storage>,
    runtime: State<'_, RuntimeState>,
) -> Result<String, AppError> {
    let result = async {
        validate_profile_fields(&name, &url)?;
        let snapshot = storage.load().map_err(|_| AppError::storage_load())?;
        if !storage.paths().core_dir.join("sing-box.exe").is_file() {
            let error = AppError::new("kernel_missing", "Kernel is not installed");
            log_command_failure(runtime.inner(), &app, "Profile add", &error).await;
            return Ok("Error: Kernel is not installed".to_owned());
        }
        let content = download_bytes(&url, MAX_PROFILE_BYTES, None).await?;
        validate_profile_json(&content)?;
        let id = Uuid::new_v4().to_string();
        let path = storage
            .paths()
            .profile_file(&id)
            .map_err(|_| AppError::invalid_input("Profile id is invalid"))?;
        write_atomic(&path, &content).map_err(|_| AppError::operation_failed())?;
        if let Err(error) = run_core_check(&storage.paths().core_dir, &path) {
            let _ = fs::remove_file(&path);
            return Err(error);
        }
        let mut next = snapshot;
        next.profiles.push(Profile {
            id: id.clone(),
            name,
            url,
            path: format!("profiles/{id}.json"),
            updated: current_time_string(),
            ..Profile::default()
        });
        if next.state.active_id.is_empty() {
            next.state.active_id = id;
        }
        storage.save(&next).map_err(map_storage_write_error)?;
        let _ = app.emit("log", "Profile added");
        Ok("Success".to_owned())
    }
    .await;
    log_failed_result(runtime.inner(), &app, "Profile add", result).await
}

#[tauri::command]
pub async fn delete_profile(id: String, storage: State<'_, Storage>) -> Result<(), AppError> {
    let mut snapshot = storage.load().map_err(|_| AppError::storage_load())?;
    if !snapshot.profiles.iter().any(|profile| profile.id == id) {
        return Ok(());
    }
    snapshot.profiles.retain(|profile| profile.id != id);
    if snapshot.state.active_id == id {
        snapshot.state.active_id.clear();
    }
    storage.save(&snapshot).map_err(map_storage_write_error)?;
    if let Ok(path) = storage.paths().profile_file(&id) {
        let _ = fs::remove_file(path);
    }
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn edit_profile(
    id: String,
    name: String,
    url: String,
    storage: State<'_, Storage>,
) -> Result<String, AppError> {
    validate_profile_fields(&name, &url)?;
    let mut snapshot = storage.load().map_err(|_| AppError::storage_load())?;
    let Some(profile) = snapshot
        .profiles
        .iter_mut()
        .find(|profile| profile.id == id)
    else {
        return Ok("Error: Profile not found".to_owned());
    };
    profile.name = name;
    profile.url = url;
    storage.save(&snapshot).map_err(map_storage_write_error)?;
    Ok("Success".to_owned())
}

#[tauri::command]
pub async fn select_profile(
    app: AppHandle,
    id: String,
    storage: State<'_, Storage>,
    runtime: State<'_, RuntimeState>,
) -> Result<String, AppError> {
    let _operation = runtime.core_operation(&app).await;
    let mut snapshot = storage.load().map_err(|_| AppError::storage_load())?;
    if !snapshot.profiles.iter().any(|profile| profile.id == id) {
        return Ok("Error: Profile not found".to_owned());
    }
    let was_running = runtime.core().await.is_some();
    let previous = snapshot.clone();
    snapshot.state.active_id = id;
    storage.save(&snapshot).map_err(map_storage_write_error)?;
    if was_running {
        let _ = app.emit("core-restarting", ());
        let stop_result = stop_core_impl(&app, &runtime).await;
        if stop_result.starts_with("Error") {
            let _ = storage.save(&previous);
            let _ = app.emit(
                "state-sync",
                json!({
                    "tunMode": previous.state.tun_mode,
                    "sysProxy": previous.state.sys_proxy
                }),
            );
            return Ok(stop_result);
        }
        if let Err(error) = start_core_impl(&app, &storage, &runtime, &snapshot).await {
            let _ = storage.save(&previous);
            if start_core_impl(&app, &storage, &runtime, &previous)
                .await
                .is_ok()
            {
                let _ = app.emit("status", true);
                let _ = app.emit(
                    "state-sync",
                    json!({
                        "tunMode": previous.state.tun_mode,
                        "sysProxy": previous.state.sys_proxy
                    }),
                );
            } else {
                let _ = app.emit("status", false);
            }
            return Ok(format!("Error: {}", error.message));
        }
        let _ = app.emit("status", true);
    }
    Ok("Success".to_owned())
}

#[tauri::command]
pub async fn update_active_profile(
    app: AppHandle,
    storage: State<'_, Storage>,
    runtime: State<'_, RuntimeState>,
) -> Result<String, AppError> {
    let result = async {
        let snapshot = storage.load().map_err(|_| AppError::storage_load())?;
        let Some(profile) = snapshot
            .profiles
            .iter()
            .find(|profile| profile.id == snapshot.state.active_id)
            .cloned()
        else {
            let error = AppError::new("profile_missing", "No active profile");
            log_command_failure(runtime.inner(), &app, "Profile update", &error).await;
            return Ok("Error: No active profile".to_owned());
        };
        validate_profile_fields(&profile.name, &profile.url)?;
        let content = download_bytes(&profile.url, MAX_PROFILE_BYTES, None).await?;
        validate_profile_json(&content)?;
        let path = storage
            .paths()
            .profile_file(&profile.id)
            .map_err(|_| AppError::invalid_input("Profile id is invalid"))?;
        let temp = path.with_extension(format!("tmp-{}", Uuid::new_v4()));
        write_atomic(&temp, &content).map_err(|_| AppError::operation_failed())?;
        if let Err(error) = run_core_check(&storage.paths().core_dir, &temp) {
            let _ = fs::remove_file(&temp);
            return Err(error);
        }
        fs::rename(&temp, &path).map_err(|_| AppError::operation_failed())?;
        let mut next = snapshot;
        let active_id = next.state.active_id.clone();
        if let Some(profile) = next
            .profiles
            .iter_mut()
            .find(|profile| profile.id == active_id)
        {
            profile.updated = current_time_string();
            profile.path = format!("profiles/{}.json", profile.id);
        }
        storage.save(&next).map_err(map_storage_write_error)?;
        let _ = app.emit("log", "Profile updated");
        Ok("Success".to_owned())
    }
    .await;
    log_failed_result(runtime.inner(), &app, "Profile update", result).await
}

#[tauri::command]
pub async fn get_app_log(runtime: State<'_, RuntimeState>) -> Result<String, AppError> {
    let content = fs::read_to_string(&runtime.paths().app_log).unwrap_or_default();
    Ok(limit_log_lines(&content, 5_000))
}

#[tauri::command]
pub async fn clear_app_log(runtime: State<'_, RuntimeState>) -> Result<String, AppError> {
    runtime
        .clear_app_log()
        .await
        .map_err(|_| AppError::operation_failed())?;
    Ok("Success".to_owned())
}

#[tauri::command]
pub async fn get_kernel_log(runtime: State<'_, RuntimeState>) -> Result<String, AppError> {
    let buffered = runtime.kernel_log().await;
    if !buffered.is_empty() {
        return Ok(buffered);
    }
    Ok(fs::read_to_string(&runtime.paths().kernel_log)
        .unwrap_or_else(|_| "> No kernel logs available. Kernel may not be running.".to_owned()))
}

#[tauri::command]
pub async fn clear_kernel_log(runtime: State<'_, RuntimeState>) -> Result<String, AppError> {
    runtime.clear_kernel_log().await;
    if let Some(parent) = runtime.paths().kernel_log.parent() {
        fs::create_dir_all(parent).map_err(|_| AppError::operation_failed())?;
    }
    fs::write(&runtime.paths().kernel_log, []).map_err(|_| AppError::operation_failed())?;
    Ok("Success".to_owned())
}

#[tauri::command]
pub fn get_log_file(storage: State<'_, Storage>) -> String {
    fs::read_to_string(&storage.paths().kernel_log)
        .unwrap_or_else(|_| "No log file available".to_owned())
}

#[tauri::command]
pub fn get_uwp_apps() -> Result<Vec<UwpAppDto>, AppError> {
    let apps = platform_get_uwp_apps().map_err(|_| AppError::operation_failed())?;
    Ok(apps
        .into_iter()
        .map(|app| UwpAppDto {
            sid: app.sid,
            display_name: app.display_name,
            package_name: app.package_name,
            is_exempt: app.is_exempt,
        })
        .collect())
}

#[tauri::command(rename_all = "camelCase")]
pub fn set_uwp_loopback_exemptions(selected_sids: Vec<String>) -> Result<String, AppError> {
    let apps = platform_get_uwp_apps().map_err(|_| AppError::operation_failed())?;
    let current: BTreeSet<_> = apps
        .iter()
        .filter(|app| app.is_exempt)
        .map(|app| app.sid.clone())
        .collect();
    let selected: BTreeSet<_> = selected_sids.into_iter().collect();
    let add = selected.difference(&current).cloned().collect::<Vec<_>>();
    let remove = current.difference(&selected).cloned().collect::<Vec<_>>();
    set_loopback_exemptions(&add, &remove).map_err(|_| AppError::operation_failed())?;
    Ok("Success".to_owned())
}

#[tauri::command]
pub fn open_dashboard(app: AppHandle) -> Result<(), AppError> {
    tauri_plugin_opener::OpenerExt::opener(&app)
        .open_url(DEFAULT_DASHBOARD_URL, None::<String>)
        .map_err(|_| AppError::operation_failed())
}

#[tauri::command]
pub fn open_url(app: AppHandle, url: String) -> Result<(), AppError> {
    validate_http_url(&url)?;
    tauri_plugin_opener::OpenerExt::opener(&app)
        .open_url(url, None::<String>)
        .map_err(|_| AppError::operation_failed())
}

#[tauri::command]
pub fn minimize(app: AppHandle) -> Result<(), AppError> {
    app.get_webview_window("main")
        .ok_or_else(AppError::operation_failed)?
        .minimize()
        .map_err(|_| AppError::operation_failed())
}

#[tauri::command]
pub fn minimize_to_tray(app: AppHandle) -> Result<(), AppError> {
    app.get_webview_window("main")
        .ok_or_else(AppError::operation_failed)?
        .hide()
        .map_err(|_| AppError::operation_failed())
}

#[tauri::command]
pub fn show(app: AppHandle) -> Result<(), AppError> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(AppError::operation_failed)?;
    window.show().map_err(|_| AppError::operation_failed())?;
    window.set_focus().map_err(|_| AppError::operation_failed())
}

#[tauri::command]
pub fn quit(app: AppHandle) {
    app.exit(0);
}

pub(crate) fn refresh_tray(app: &AppHandle, running: bool, tun_mode: bool, sys_proxy: bool) {
    let (icon_bytes, tooltip) = match (running, tun_mode, sys_proxy) {
        (true, true, true) => (
            include_bytes!("../../frontend/icon/tray_mixed.ico"),
            "WinBox - Mixed",
        ),
        (true, true, false) => (
            include_bytes!("../../frontend/icon/tray_tun.ico"),
            "WinBox - Tun",
        ),
        (true, false, true) => (
            include_bytes!("../../frontend/icon/tray_proxy.ico"),
            "WinBox - Proxy",
        ),
        _ => (
            include_bytes!("../../frontend/icon/tray.ico"),
            "WinBox - Stopped",
        ),
    };
    if let Some(tray) = app.tray_by_id("main") {
        if let Ok(icon) = Image::from_bytes(icon_bytes) {
            let _ = tray.set_icon(Some(icon));
        }
        let _ = tray.set_tooltip(Some(tooltip));
    }
    if let Some(menu) = app.try_state::<TrayMenuState>() {
        let _ = menu
            .mode_mixed
            .set_checked(running && tun_mode && sys_proxy);
        let _ = menu.mode_tun.set_checked(running && tun_mode && !sys_proxy);
        let _ = menu
            .mode_proxy
            .set_checked(running && !tun_mode && sys_proxy);
        let _ = menu.stop.set_checked(!running || (!tun_mode && !sys_proxy));
    }
}

#[tauri::command]
pub async fn check_update(
    app: AppHandle,
    storage: State<'_, Storage>,
    runtime: State<'_, RuntimeState>,
) -> Result<String, AppError> {
    let result = async {
        let snapshot = storage.load().map_err(|_| AppError::storage_load())?;
        let release = latest_release(
            "https://api.github.com/repos/SagerNet/sing-box",
            snapshot.settings.pre_release,
        )
        .await?;
        if release.tag_name.is_empty() {
            return Err(AppError::new(
                "update_check_failed",
                "No release version found",
            ));
        }
        Ok(release.tag_name)
    }
    .await;
    log_failed_result(runtime.inner(), &app, "Kernel update check", result).await
}

#[tauri::command]
pub async fn check_program_update(
    app: AppHandle,
    storage: State<'_, Storage>,
    runtime: State<'_, RuntimeState>,
) -> Result<ProgramUpdateDto, AppError> {
    let result = async {
        let snapshot = storage.load().map_err(|_| AppError::storage_load())?;
        let release = latest_release(PROGRAM_REPOSITORY_API, snapshot.settings.pre_release).await?;
        if !release_has_updater_metadata(&release) {
            return Ok(ProgramUpdateDto {
                version: app.package_info().version.to_string(),
                changelog: String::new(),
            });
        }
        let tag = snapshot
            .settings
            .pre_release
            .then_some(release.tag_name.as_str());
        let updater = build_program_updater(&app, snapshot.settings.pre_release, tag)?;
        let update = updater
            .check()
            .await
            .map_err(|error| AppError::detailed("update_check_failed", error.to_string()))?;
        Ok(match update {
            Some(update) => ProgramUpdateDto {
                version: update.version,
                changelog: update.body.unwrap_or_default(),
            },
            None => ProgramUpdateDto {
                version: app.package_info().version.to_string(),
                changelog: String::new(),
            },
        })
    }
    .await;
    log_failed_result(runtime.inner(), &app, "Program update check", result).await
}

#[tauri::command]
pub async fn update_kernel(
    app: AppHandle,
    mirror: String,
    storage: State<'_, Storage>,
    runtime: State<'_, RuntimeState>,
) -> Result<String, AppError> {
    let _operation = runtime.core_operation(&app).await;
    let snapshot = log_failed_result(
        runtime.inner(),
        &app,
        "Kernel update",
        storage.load().map_err(|_| AppError::storage_load()),
    )
    .await?;
    let release = log_failed_result(
        runtime.inner(),
        &app,
        "Kernel update metadata",
        latest_release(
            "https://api.github.com/repos/SagerNet/sing-box",
            snapshot.settings.pre_release,
        )
        .await,
    )
    .await?;
    let version = release.tag_name.trim_start_matches('v');
    let architecture = log_failed_result(
        runtime.inner(),
        &app,
        "Kernel update metadata",
        TargetArchitecture::current().map_err(|error| {
            update_phase_error("update_metadata_failed", "selecting the x64 asset", error)
        }),
    )
    .await?;
    let expected = log_failed_result(
        runtime.inner(),
        &app,
        "Kernel update metadata",
        expected_sing_box_asset_name(version, architecture).map_err(|error| {
            update_phase_error(
                "update_metadata_failed",
                "selecting the release asset",
                error,
            )
        }),
    )
    .await?;
    let asset = log_failed_result(
        runtime.inner(),
        &app,
        "Kernel update metadata",
        release
            .assets
            .iter()
            .find(|asset| asset.name == expected)
            .ok_or_else(|| {
                AppError::detailed(
                    "update_asset_missing",
                    format!("Kernel update asset {expected} was not found"),
                )
            }),
    )
    .await?;
    let digest = log_failed_result(
        runtime.inner(),
        &app,
        "Kernel update metadata",
        asset.digest.clone().ok_or_else(|| {
            AppError::detailed(
                "update_digest_missing",
                format!("Kernel update asset {} has no SHA-256 digest", asset.name),
            )
        }),
    )
    .await?;
    let download_url = log_failed_result(
        runtime.inner(),
        &app,
        "Kernel update metadata",
        mirrored_url(&mirror, &asset.browser_download_url),
    )
    .await?;
    let archive = storage
        .paths()
        .core_dir
        .join(format!(".download-{}.zip", Uuid::new_v4()));
    let staging = storage
        .paths()
        .core_dir
        .join(format!(".update-{}", Uuid::new_v4()));
    if let Some(parent) = archive.parent() {
        log_failed_result(
            runtime.inner(),
            &app,
            "Kernel update preparation",
            fs::create_dir_all(parent).map_err(|error| {
                update_phase_error(
                    "update_prepare_failed",
                    "preparing the kernel directory",
                    io_error_detail(&error),
                )
            }),
        )
        .await?;
    }
    log_update_phase(
        &runtime,
        &app,
        "INFO",
        format!("Kernel update started for sing-box {version}"),
    )
    .await;
    let result = async {
        if let Err(error) = download_file(&app, &download_url, &archive).await {
            log_update_phase(
                &runtime,
                &app,
                "ERROR",
                format!("Kernel update download failed: {}", error.message),
            )
            .await;
            return Err(error);
        }
        log_update_phase(&runtime, &app, "INFO", "Kernel update download complete").await;

        let staged = match stage_sing_box_archive(
            &archive,
            &asset.name,
            &digest,
            &staging,
            version,
            architecture,
        )
        {
            Ok(staged) => staged,
            Err(error) => {
                let error = update_phase_error("update_stage_failed", "staging the downloaded core", error);
                log_update_phase(&runtime, &app, "ERROR", error.message.clone()).await;
                return Err(error);
            }
        };
        log_update_phase(&runtime, &app, "INFO", "Checking staged sing-box core").await;
        if let Err(error) = check_staged_core(&staging, &storage, &snapshot) {
            log_update_phase(
                &runtime,
                &app,
                "ERROR",
                format!(
                    "Kernel update staged check failed: {}",
                    safe_error_message(&error)
                ),
            )
            .await;
            return Err(error);
        }
        log_update_phase(&runtime, &app, "INFO", "Staged sing-box core passed check").await;

        let was_running = runtime.core().await.is_some();
        if was_running {
            let _ = app.emit("core-stopping", ());
            let stop_result = stop_core_impl(&app, &runtime).await;
            if stop_result.starts_with("Error") {
                log_update_phase(&runtime, &app, "ERROR", stop_result.clone()).await;
                return Err(AppError::detailed("core_stop_failed", stop_result));
            }
            log_update_phase(&runtime, &app, "INFO", "Running sing-box core stopped").await;
        }
        let target = storage.paths().core_dir.join("sing-box.exe");
        let backup = match install_staged_file(&staged, &target) {
            Ok(backup) => backup,
            Err(error) => {
                log_update_phase(&runtime, &app, "ERROR", error.message.clone()).await;
                return Err(error);
            }
        };
        log_update_phase(&runtime, &app, "INFO", "New sing-box core installed").await;
        if !was_running {
            remove_backup(backup);
        } else {
            match start_core_impl(&app, &storage, &runtime, &snapshot).await {
                Ok(()) => {
                    remove_backup(backup);
                    let _ = app.emit("status", true);
                    log_update_phase(&runtime, &app, "INFO", "New sing-box core started").await;
                }
                Err(start_error) => {
                    log_update_phase(
                        &runtime,
                        &app,
                        "ERROR",
                        format!(
                            "New sing-box core failed to start: {}",
                            safe_error_message(&start_error)
                        ),
                    )
                    .await;
                    let restored = match restore_installed_file(backup, &target) {
                        Ok(()) => true,
                        Err(error) => {
                            log_update_phase(
                                &runtime,
                                &app,
                                "ERROR",
                                format!("Kernel rollback failed: {}", error.message),
                            )
                            .await;
                            false
                        }
                    };
                    if restored
                        && start_core_impl(&app, &storage, &runtime, &snapshot)
                            .await
                            .is_ok()
                    {
                        let _ = app.emit("status", true);
                        let _ = app.emit("log", "Update failed; previous core restored");
                        return Err(AppError::detailed(
                            "update_rolled_back",
                            format!(
                                "The new core could not start; the previous core was restored ({})",
                                start_error.message
                            ),
                        ));
                    }
                    let _ = app.emit("status", false);
                    return Err(if restored {
                        AppError::detailed(
                            "update_rollback_start_failed",
                            format!(
                                "The new core failed ({}) and the previous core could not be restarted",
                                start_error.message
                            ),
                        )
                    } else {
                        AppError::detailed(
                            "update_rollback_failed",
                            format!(
                                "The new core failed ({}) and the previous core could not be restored",
                                start_error.message
                            ),
                        )
                    });
                }
            }
        }
        let _ = app.emit("log", "Update Complete");
        Ok::<(), AppError>(())
    }
    .await;
    let _ = fs::remove_file(&archive);
    let _ = fs::remove_dir_all(&staging);
    result.map(|()| "Success".to_owned())
}

#[tauri::command]
pub async fn update_program(
    app: AppHandle,
    mirror: String,
    storage: State<'_, Storage>,
    runtime: State<'_, RuntimeState>,
) -> Result<String, AppError> {
    let result = async {
        let snapshot = storage.load().map_err(|_| AppError::storage_load())?;
        let release = latest_release(PROGRAM_REPOSITORY_API, snapshot.settings.pre_release).await?;
        if !release_has_updater_metadata(&release) {
            return Err(AppError::new(
                "update_not_available",
                "No updater metadata is available for the selected release",
            ));
        }
        let tag = snapshot
            .settings
            .pre_release
            .then_some(release.tag_name.as_str());
        let updater = build_program_updater(&app, snapshot.settings.pre_release, tag)?;
        let _operation = runtime.core_operation(&app).await;
        let mut update = updater
            .check()
            .await
            .map_err(|error| AppError::detailed("update_check_failed", error.to_string()))?
            .ok_or_else(|| {
                AppError::new("update_not_available", "No program update is available")
            })?;
        if !mirror.trim().is_empty() {
            let download_url = mirrored_url(&mirror, update.download_url.as_str())?;
            update.download_url = Url::parse(&download_url)
                .map_err(|error| AppError::detailed("update_download_failed", error.to_string()))?;
        }
        let _ = app.emit("log", "Update ready. Restarting...");
        let mut downloaded = 0_u64;
        let bytes = update
            .download(
                |chunk, total| {
                    downloaded = downloaded.saturating_add(chunk as u64);
                    let progress = total
                        .and_then(|total| downloaded.checked_mul(100)?.checked_div(total))
                        .unwrap_or(0)
                        .min(100) as u32;
                    let _ = app.emit("download-progress", progress);
                },
                || {
                    let _ = app.emit("download-progress", 100_u32);
                },
            )
            .await
            .map_err(|error| AppError::detailed("update_download_failed", error.to_string()))?;
        drop(_operation);
        update
            .install(bytes)
            .map_err(|error| AppError::detailed("update_install_failed", error.to_string()))?;
        Ok("Success".to_owned())
    }
    .await;
    log_failed_result(runtime.inner(), &app, "Program update", result).await
}

fn restore_installed_file(backup: Option<PathBuf>, target: &Path) -> Result<(), AppError> {
    let backup = backup.ok_or_else(AppError::update_failed)?;
    let displaced = target.with_extension(format!("rollback-{}", Uuid::new_v4()));
    let had_target = replace_file_with_backup(&backup, target, &displaced).map_err(|error| {
        update_phase_error(
            "update_rollback_failed",
            "restoring the previous core",
            io_error_detail(&error),
        )
    })?;
    if had_target {
        let _ = fs::remove_file(displaced);
    }
    Ok(())
}

async fn start_core_impl(
    app: &AppHandle,
    storage: &Storage,
    runtime: &RuntimeState,
    snapshot: &DataSnapshot,
) -> Result<(), AppError> {
    let profile = active_profile_path(snapshot, storage.paths())?;
    let config_path = storage.paths().core_dir.join("config.json");
    let mut config = build_runtime_config(&profile, snapshot)?;
    let api_address = prepare_control_api(&mut config)?;
    let bytes = serde_json::to_vec_pretty(&config).map_err(|_| AppError::operation_failed())?;
    write_atomic(&config_path, &bytes).map_err(|_| AppError::operation_failed())?;
    run_core_check(&storage.paths().core_dir, &config_path)?;

    let proxy_restore = if snapshot.state.sys_proxy {
        Some(read_system_proxy().map_err(|_| {
            AppError::new("proxy_state_failed", "System proxy state could not be read")
        })?)
    } else {
        None
    };
    let mut process = CoreProcess::start(&storage.paths().core_dir)
        .await
        .map_err(|error| {
            AppError::detailed(
                "core_start_failed",
                format!("Failed to start sing-box: {}", io_error_detail(&error)),
            )
        })?;
    let mut output = process
        .take_output()
        .ok_or_else(|| AppError::new("core_start_failed", "Failed to capture sing-box output"))?;
    let secret = extract_api_secret(&config);
    let readiness = {
        let ready = process.wait_ready(api_address, secret.as_deref(), Duration::from_secs(30));
        tokio::pin!(ready);
        let mut output_open = true;
        loop {
            tokio::select! {
                result = &mut ready => break result,
                line = output.recv(), if output_open => match line {
                    Some(line) => runtime.append_kernel_log(line).await,
                    None => output_open = false,
                }
            }
        }
    };
    if let Err(error) = readiness {
        let stop_result = process.stop().await;
        while let Ok(line) = output.try_recv() {
            runtime.append_kernel_log(line).await;
        }
        if let Some(previous) = &proxy_restore {
            let _ = restore_system_proxy(previous);
        }
        let detail = format!("Core startup failed: {error}; cleanup: {stop_result:?}");
        let _ = runtime.append_app_log(app, "ERROR", &detail).await;
        let _ = app.emit("log", format!("Error: {detail}"));
        return Err(AppError::detailed("core_start_failed", detail));
    }
    if let Some(proxy_restore) = proxy_restore {
        let proxy_owned = match read_system_proxy() {
            Ok(proxy_owned) => proxy_owned,
            Err(_) => {
                let _ = process.stop().await;
                let _ = restore_system_proxy(&proxy_restore);
                return Err(AppError::new(
                    "proxy_state_failed",
                    "System proxy state could not be read",
                ));
            }
        };
        if runtime
            .remember_proxy_state(proxy_restore.clone(), proxy_owned)
            .await
            .is_err()
        {
            let _ = process.stop().await;
            let _ = restore_system_proxy(&proxy_restore);
            return Err(AppError::new(
                "proxy_state_failed",
                "System proxy state could not be saved",
            ));
        }
    }
    let process = Arc::new(Mutex::new(process));
    runtime.set_core(process.clone()).await;
    runtime.spawn_core_monitor(app, process, output);
    runtime
        .start_traffic(app, extract_api_url(&config), extract_api_secret(&config))
        .await;
    let _ = runtime
        .append_app_log(app, "INFO", "Core started successfully")
        .await;
    Ok(())
}

async fn stop_core_impl(app: &AppHandle, runtime: &RuntimeState) -> String {
    runtime.request_stop(true);
    let core = runtime.core().await;
    runtime.stop_traffic().await;
    let result = if let Some(core) = core {
        match core.lock().await.stop().await {
            Ok(_) => {
                runtime.clear_core_if(&core).await;
                "Stopped".to_owned()
            }
            Err(error) => format!(
                "Error: Failed to stop sing-box: {}",
                io_error_detail(&error)
            ),
        }
    } else {
        "Already stopped".to_owned()
    };
    let result = if matches!(result.as_str(), "Stopped" | "Already stopped")
        && runtime.restore_proxy_if_owned().await.is_err()
    {
        "Error: Failed to restore system proxy".to_owned()
    } else {
        result
    };
    runtime.request_stop(false);
    let _ = app.emit("status", runtime.core().await.is_some());
    result
}

pub async fn shutdown_runtime(app: &AppHandle, runtime: &RuntimeState) {
    let _operation = runtime.core_operation(app).await;
    let _ = stop_core_impl(app, runtime).await;
    let _ = runtime
        .append_app_log(app, "INFO", "Application shutdown")
        .await;
}

pub async fn startup_runtime(app: AppHandle, runtime: RuntimeState) {
    let _ = runtime.restore_proxy_if_owned().await;
    let storage = app.state::<Storage>();
    let Ok(snapshot) = storage.load() else {
        let _ = app.emit("status", false);
        refresh_tray(&app, false, false, false);
        return;
    };
    if snapshot.settings.auto_connect_state == "off"
        || !storage.paths().core_dir.join("sing-box.exe").is_file()
        || active_profile_path(&snapshot, storage.paths()).is_err()
    {
        let _ = app.emit("status", false);
        refresh_tray(
            &app,
            false,
            snapshot.state.tun_mode,
            snapshot.state.sys_proxy,
        );
        return;
    }

    if snapshot.settings.auto_connect_state == "smart" {
        let _ = app.emit("core-lock", true);
        let _ = app.emit("log", "Detecting");
        let client = match Client::builder().timeout(Duration::from_secs(2)).build() {
            Ok(client) => client,
            Err(_) => {
                let _ = app.emit("core-lock", false);
                let _ = app.emit("log", "Net Timeout");
                let _ = app.emit("status", false);
                refresh_tray(
                    &app,
                    false,
                    snapshot.state.tun_mode,
                    snapshot.state.sys_proxy,
                );
                return;
            }
        };
        let mut network_ready = false;
        for _ in 0..15 {
            if let Ok(response) = client
                .get("http://edge.microsoft.com/captiveportal/generate_204")
                .send()
                .await
            {
                if response.status().is_success() {
                    network_ready = true;
                    break;
                }
            }
            sleep(Duration::from_secs(2)).await;
        }
        if !network_ready {
            let _ = app.emit("core-lock", false);
            let _ = app.emit("log", "Net Timeout");
            let _ = app.emit("status", false);
            refresh_tray(
                &app,
                false,
                snapshot.state.tun_mode,
                snapshot.state.sys_proxy,
            );
            return;
        }
        if let Ok(response) = client
            .get("http://clients3.google.com/generate_204")
            .send()
            .await
        {
            if response.status().as_u16() == 204 {
                let _ = app.emit("core-lock", false);
                let _ = app.emit("log", "Standby");
                let _ = app.emit("status", false);
                refresh_tray(
                    &app,
                    false,
                    snapshot.state.tun_mode,
                    snapshot.state.sys_proxy,
                );
                return;
            }
        }
    }

    let _operation = runtime.core_operation(&app).await;
    if runtime.core().await.is_some() {
        let _ = app.emit("core-lock", false);
        return;
    }
    let snapshot = match storage.load() {
        Ok(snapshot) => snapshot,
        Err(_) => {
            let _ = app.emit("core-lock", false);
            let _ = app.emit("status", false);
            refresh_tray(&app, false, false, false);
            return;
        }
    };
    if snapshot.settings.auto_connect_state == "off"
        || !storage.paths().core_dir.join("sing-box.exe").is_file()
        || active_profile_path(&snapshot, storage.paths()).is_err()
    {
        let _ = app.emit("core-lock", false);
        let _ = app.emit("status", false);
        refresh_tray(
            &app,
            false,
            snapshot.state.tun_mode,
            snapshot.state.sys_proxy,
        );
        return;
    }
    let _ = app.emit("core-lock", false);
    let _ = app.emit("core-starting", ());
    if start_core_impl(&app, &storage, &runtime, &snapshot)
        .await
        .is_ok()
    {
        let _ = app.emit("status", true);
        let _ = app.emit(
            "state-sync",
            json!({"tunMode": snapshot.state.tun_mode, "sysProxy": snapshot.state.sys_proxy}),
        );
        refresh_tray(
            &app,
            true,
            snapshot.state.tun_mode,
            snapshot.state.sys_proxy,
        );
    } else {
        let _ = app.emit("status", false);
        let _ = app.emit("log", "AutoStart Failed");
        refresh_tray(
            &app,
            false,
            snapshot.state.tun_mode,
            snapshot.state.sys_proxy,
        );
    }
}

fn active_profile_path(snapshot: &DataSnapshot, paths: &AppPaths) -> Result<PathBuf, AppError> {
    if snapshot.state.active_id.is_empty()
        || !snapshot
            .profiles
            .iter()
            .any(|profile| profile.id == snapshot.state.active_id)
    {
        return Err(AppError::new(
            "config_missing",
            "No active configuration selected",
        ));
    }
    let path = paths
        .profile_file(&snapshot.state.active_id)
        .map_err(|_| AppError::new("config_missing", "Profile file is invalid"))?;
    if path.is_file() {
        Ok(path)
    } else {
        Err(AppError::new("config_missing", "Profile file is missing"))
    }
}

fn staged_profile_path(
    snapshot: &DataSnapshot,
    paths: &AppPaths,
) -> Result<Option<PathBuf>, AppError> {
    if snapshot.state.active_id.is_empty() {
        return Ok(None);
    }
    active_profile_path(snapshot, paths).map(Some)
}

fn build_runtime_config(profile_path: &Path, snapshot: &DataSnapshot) -> Result<Value, AppError> {
    let bytes = fs::read(profile_path).map_err(|_| AppError::operation_failed())?;
    let mut config: Value = serde_json::from_slice(&bytes)
        .map_err(|_| AppError::invalid_input("Profile JSON is invalid"))?;
    let object = config
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("Profile JSON must be an object"))?;
    let mut inbounds = Vec::new();
    if snapshot.state.tun_mode {
        let mut tun: Value = serde_json::from_str(&snapshot.tun_config)
            .map_err(|_| AppError::invalid_override_json())?;
        if let Some(addresses) = tun.get_mut("address").and_then(Value::as_array_mut) {
            addresses.retain(|address| {
                address.as_str() != Some("fdfe:dcba:9876::1/126") || snapshot.settings.ipv6_enabled
            });
            if snapshot.settings.ipv6_enabled
                && !addresses
                    .iter()
                    .any(|address| address.as_str() == Some("fdfe:dcba:9876::1/126"))
            {
                addresses.push(Value::String("fdfe:dcba:9876::1/126".to_owned()));
            }
        }
        inbounds.push(tun);
    }
    if snapshot.state.sys_proxy {
        inbounds.push(
            serde_json::from_str(&snapshot.mixed_config)
                .map_err(|_| AppError::invalid_override_json())?,
        );
    }
    object.insert("inbounds".to_owned(), Value::Array(inbounds));
    if snapshot.settings.log_level.is_empty() && !snapshot.settings.log_to_file {
        return Ok(config);
    }
    let mut log = object
        .remove("log")
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    if !snapshot.settings.log_level.is_empty() {
        log.insert(
            "level".to_owned(),
            Value::String(snapshot.settings.log_level.clone()),
        );
    }
    log.insert("timestamp".to_owned(), Value::Bool(true));
    if snapshot.settings.log_to_file {
        log.insert("output".to_owned(), Value::String("box.log".to_owned()));
    }
    object.insert("log".to_owned(), Value::Object(log));
    Ok(config)
}

// Only the generated config receives a fallback controller; the saved profile is untouched.
fn prepare_control_api(config: &mut Value) -> Result<std::net::SocketAddr, AppError> {
    let experimental = config
        .as_object_mut()
        .ok_or_else(AppError::operation_failed)?
        .entry("experimental")
        .or_insert_with(|| json!({}));
    if experimental.is_null() {
        *experimental = json!({});
    }
    let clash = experimental
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("experimental must be an object"))?
        .entry("clash_api")
        .or_insert_with(|| json!({}));
    if clash.is_null() {
        *clash = json!({});
    }
    let clash = clash
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("clash_api must be an object"))?;
    if clash
        .get("external_controller")
        .and_then(Value::as_str)
        .unwrap_or("")
        .is_empty()
    {
        let listener = std::net::TcpListener::bind("127.0.0.1:0")
            .map_err(|e| AppError::detailed("core_start_failed", e.to_string()))?;
        let address = listener
            .local_addr()
            .map_err(|e| AppError::detailed("core_start_failed", e.to_string()))?;
        clash.insert("external_controller".into(), json!(address.to_string()));
        if clash
            .get("secret")
            .and_then(Value::as_str)
            .unwrap_or("")
            .is_empty()
        {
            clash.insert("secret".into(), json!(Uuid::new_v4().to_string()));
        }
    }
    let external = clash
        .get("external_controller")
        .and_then(Value::as_str)
        .unwrap_or("");
    let external = if external.starts_with(':') {
        format!("0.0.0.0{external}")
    } else if let Some(port) = external.strip_prefix("localhost:") {
        format!("127.0.0.1:{port}")
    } else {
        external.to_owned()
    };
    clash.insert("external_controller".into(), json!(external));
    let mut address: std::net::SocketAddr = external.parse().map_err(|_| {
        AppError::invalid_input("Control API must use a local IP address and nonzero port")
    })?;
    if address.port() == 0 {
        return Err(AppError::invalid_input("Control API port must not be zero"));
    }
    if address.ip().is_unspecified() {
        address.set_ip(if address.is_ipv4() {
            std::net::Ipv4Addr::LOCALHOST.into()
        } else {
            std::net::Ipv6Addr::LOCALHOST.into()
        });
    }
    Ok(address)
}

fn extract_api_url(config: &Value) -> String {
    let external = config
        .pointer("/experimental/clash_api/external_controller")
        .and_then(Value::as_str)
        .unwrap_or("127.0.0.1:9090");
    let host_port = if external.starts_with(':') {
        format!("127.0.0.1{external}")
    } else if let Some(port) = external.strip_prefix("0.0.0.0:") {
        format!("127.0.0.1:{port}")
    } else if let Some(port) = external.strip_prefix("[::]:") {
        format!("[::1]:{port}")
    } else {
        external.to_owned()
    };
    format!("http://{host_port}")
}

fn extract_api_secret(config: &Value) -> Option<String> {
    config
        .get("experimental")
        .and_then(|value| value.get("clash_api"))
        .and_then(|value| value.get("secret"))
        .and_then(Value::as_str)
        .filter(|secret| !secret.is_empty())
        .map(ToOwned::to_owned)
}

fn check_staged_core(
    staging_dir: &Path,
    storage: &Storage,
    snapshot: &DataSnapshot,
) -> Result<(), AppError> {
    let Some(profile) = staged_profile_path(snapshot, storage.paths())? else {
        return run_core_version_check(staging_dir);
    };
    let config = build_runtime_config(&profile, snapshot)?;
    let bytes = serde_json::to_vec_pretty(&config).map_err(|_| AppError::operation_failed())?;
    let config_path = staging_dir.join("config.check.json");
    fs::write(&config_path, bytes).map_err(|error| {
        update_phase_error(
            "update_check_failed",
            "writing the staged check configuration",
            io_error_detail(&error),
        )
    })?;
    let result = run_core_check(staging_dir, &config_path);
    let _ = fs::remove_file(config_path);
    result.map_err(|error| {
        if error.code == "config_invalid" {
            AppError::detailed(
                "update_check_failed",
                format!(
                    "Kernel update configuration check failed: {}",
                    error.message
                ),
            )
        } else {
            error
        }
    })
}

fn run_core_check(core_dir: &Path, config: &Path) -> Result<(), AppError> {
    let executable = core_dir.join("sing-box.exe");
    if !executable.is_file() {
        return Err(AppError::new("kernel_missing", "sing-box is not installed"));
    }
    let mut command = Command::new(executable);
    configure_hidden_command(&mut command);
    let output = command
        .current_dir(core_dir)
        .args(["check", "-c"])
        .arg(config)
        .output()
        .map_err(|_| AppError::operation_failed())?;
    if output.status.success() {
        Ok(())
    } else {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        let message = if detail.is_empty() {
            "sing-box rejected the configuration".to_owned()
        } else {
            format!("sing-box rejected the configuration: {detail}")
        };
        Err(AppError::detailed("config_invalid", message))
    }
}

fn run_core_version_check(core_dir: &Path) -> Result<(), AppError> {
    let executable = core_dir.join("sing-box.exe");
    if !executable.is_file() {
        return Err(AppError::new("kernel_missing", "sing-box is not installed"));
    }
    let output = core_version_output(core_dir).map_err(|error| {
        update_phase_error(
            "update_check_failed",
            "staged executable check",
            io_error_detail(&error),
        )
    })?;
    if output.status.success() {
        return Ok(());
    }
    let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
    Err(update_phase_error(
        "update_check_failed",
        "staged executable check",
        if detail.is_empty() {
            "sing-box version command returned a failure status"
        } else {
            &detail
        },
    ))
}

fn local_version(core_dir: &Path) -> String {
    let executable = core_dir.join("sing-box.exe");
    if !executable.is_file() {
        return "Not Installed".to_owned();
    }
    let Ok(output) = core_version_output(core_dir) else {
        return "Unknown".to_owned();
    };
    let text = String::from_utf8_lossy(&output.stdout);
    let Some(version) = text
        .split_whitespace()
        .collect::<Vec<_>>()
        .windows(2)
        .find_map(|parts| (parts[0].eq_ignore_ascii_case("version")).then_some(parts[1]))
    else {
        return "Unknown".to_owned();
    };
    version.to_owned()
}

fn core_version_output(core_dir: &Path) -> io::Result<std::process::Output> {
    let mut command = Command::new(core_dir.join("sing-box.exe"));
    configure_hidden_command(&mut command);
    command.current_dir(core_dir).args(["version"]).output()
}

fn program_update_endpoint(pre_release: bool, tag: Option<&str>) -> Result<Url, AppError> {
    let endpoint = if pre_release {
        let tag = tag
            .map(str::trim)
            .filter(|tag| {
                !tag.is_empty()
                    && tag.bytes().all(|byte| {
                        byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_')
                    })
            })
            .ok_or_else(|| AppError::new("update_check_failed", "Release tag is invalid"))?;
        format!("{PROGRAM_REPOSITORY}/releases/download/{tag}/latest.json")
    } else {
        format!("{PROGRAM_REPOSITORY}/releases/latest/download/latest.json")
    };
    Url::parse(&endpoint)
        .map_err(|error| AppError::detailed("update_check_failed", error.to_string()))
}

fn build_program_updater(
    app: &AppHandle,
    pre_release: bool,
    tag: Option<&str>,
) -> Result<Updater, AppError> {
    let endpoint = program_update_endpoint(pre_release, tag)?;
    let cleanup_app = app.clone();
    let cleanup_runtime = app.state::<RuntimeState>().inner().clone();
    app.updater_builder()
        .target("windows-x86_64-nsis")
        .endpoints(vec![endpoint])
        .map_err(|error| AppError::detailed("update_check_failed", error.to_string()))?
        .on_before_exit(move || {
            let app = cleanup_app.clone();
            let runtime = cleanup_runtime.clone();
            let _ = std::thread::spawn(move || {
                tauri::async_runtime::block_on(shutdown_runtime(&app, &runtime));
            })
            .join();
            cleanup_app.cleanup_before_exit();
        })
        .build()
        .map_err(|error| AppError::detailed("update_check_failed", error.to_string()))
}

async fn latest_release(repo: &str, pre_release: bool) -> Result<ReleaseInfo, AppError> {
    let url = if pre_release {
        format!("{repo}/releases")
    } else {
        format!("{repo}/releases/latest")
    };
    let response = http_client()?
        .get(url)
        .send()
        .await
        .map_err(|_| AppError::new("network_error", "Network request failed"))?;
    if !response.status().is_success() {
        return Err(AppError::detailed(
            "network_error",
            format!(
                "The release service returned HTTP {}",
                response.status().as_u16()
            ),
        ));
    }
    if pre_release {
        let releases = response
            .json::<Vec<ReleaseInfo>>()
            .await
            .map_err(|_| AppError::new("network_error", "Release data is invalid"))?;
        select_pre_release(releases)
    } else {
        response
            .json::<ReleaseInfo>()
            .await
            .map_err(|_| AppError::new("network_error", "Release data is invalid"))
    }
}

fn select_pre_release(releases: Vec<ReleaseInfo>) -> Result<ReleaseInfo, AppError> {
    releases
        .into_iter()
        .find(|release| release.prerelease)
        .ok_or_else(|| AppError::new("update_check_failed", "No pre-release found"))
}

fn release_has_updater_metadata(release: &ReleaseInfo) -> bool {
    release
        .assets
        .iter()
        .any(|asset| asset.name == "latest.json")
}

fn http_client() -> Result<Client, AppError> {
    Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent(HTTP_USER_AGENT)
        .build()
        .map_err(|_| AppError::operation_failed())
}

async fn download_bytes(
    url: &str,
    limit: usize,
    app: Option<&AppHandle>,
) -> Result<Vec<u8>, AppError> {
    validate_http_url(url)?;
    let response = http_client()?
        .get(url)
        .send()
        .await
        .map_err(|_| AppError::new("network_error", "Download failed"))?;
    if !response.status().is_success() {
        return Err(AppError::detailed(
            "network_error",
            format!("Download failed (HTTP {})", response.status().as_u16()),
        ));
    }
    let mut body = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = futures_util::StreamExt::next(&mut stream).await {
        let chunk = chunk.map_err(|_| AppError::new("network_error", "Download failed"))?;
        if body.len().saturating_add(chunk.len()) > limit {
            return Err(AppError::new(
                "download_too_large",
                "Downloaded data is too large",
            ));
        }
        body.extend_from_slice(&chunk);
        if let Some(app) = app {
            let _ = app.emit("download-progress", 0_u32);
        }
    }
    Ok(body)
}

async fn download_file(app: &AppHandle, url: &str, target: &Path) -> Result<(), AppError> {
    validate_http_url(url)?;
    let response = http_client()?
        .get(url)
        .send()
        .await
        .map_err(|_| AppError::new("network_error", "Download failed"))?;
    if !response.status().is_success() {
        return Err(AppError::detailed(
            "network_error",
            format!("Download failed (HTTP {})", response.status().as_u16()),
        ));
    }
    if response
        .content_length()
        .is_some_and(|size| size > MAX_UPDATE_BYTES)
    {
        return Err(AppError::new(
            "download_too_large",
            "Downloaded data is too large",
        ));
    }
    let total = response.content_length().unwrap_or(0);
    let mut current = 0_u64;
    let temp = target.with_extension(format!("part-{}", Uuid::new_v4()));
    let result = async {
        let mut file = tokio::fs::File::create(&temp)
            .await
            .map_err(|_| AppError::operation_failed())?;
        let mut stream = response.bytes_stream();
        while let Some(chunk) = futures_util::StreamExt::next(&mut stream).await {
            let chunk = chunk.map_err(|_| AppError::new("network_error", "Download failed"))?;
            current = current.saturating_add(chunk.len() as u64);
            if current > MAX_UPDATE_BYTES {
                return Err(AppError::new(
                    "download_too_large",
                    "Downloaded data is too large",
                ));
            }
            file.write_all(&chunk)
                .await
                .map_err(|_| AppError::operation_failed())?;
            let progress = current
                .saturating_mul(100)
                .checked_div(total)
                .unwrap_or(0)
                .min(100) as u32;
            let _ = app.emit("download-progress", progress);
        }
        file.flush()
            .await
            .map_err(|_| AppError::operation_failed())?;
        drop(file);
        tokio::fs::rename(&temp, target)
            .await
            .map_err(|_| AppError::operation_failed())
    }
    .await;
    if result.is_err() {
        let _ = tokio::fs::remove_file(&temp).await;
    }
    result
}

fn mirrored_url(mirror: &str, url: &str) -> Result<String, AppError> {
    if mirror.trim().is_empty() {
        return Ok(url.to_owned());
    }
    validate_http_url(mirror)?;
    Ok(format!("{}/{}", mirror.trim_end_matches('/'), url))
}

fn validate_profile_fields(name: &str, url: &str) -> Result<(), AppError> {
    if name.trim().is_empty() || name.chars().count() > 128 {
        return Err(AppError::invalid_input("Profile name is invalid"));
    }
    validate_http_url(url)
}

fn validate_http_url(url: &str) -> Result<(), AppError> {
    let parsed = reqwest::Url::parse(url).map_err(|_| AppError::invalid_input("URL is invalid"))?;
    if !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none() {
        return Err(AppError::invalid_input(
            "Only HTTP and HTTPS URLs are supported",
        ));
    }
    Ok(())
}

fn validate_profile_json(content: &[u8]) -> Result<(), AppError> {
    let value: Value = serde_json::from_slice(content)
        .map_err(|_| AppError::invalid_input("Profile JSON is invalid"))?;
    if !value.is_object() {
        return Err(AppError::invalid_input("Profile JSON must be an object"));
    }
    Ok(())
}

fn write_atomic(path: &Path, content: &[u8]) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let temp = path.with_extension(format!("tmp-{}", Uuid::new_v4()));
    fs::write(&temp, content)?;
    if let Err(error) = fs::rename(&temp, path) {
        let _ = fs::remove_file(&temp);
        return Err(error);
    }
    Ok(())
}

fn install_staged_file(staged: &Path, target: &Path) -> Result<Option<PathBuf>, AppError> {
    let backup = target.with_extension(format!("bak-{}", Uuid::new_v4()));
    let had_target = replace_file_with_backup(staged, target, &backup).map_err(|error| {
        let detail = io_error_detail(&error);
        if matches!(
            error.raw_os_error(),
            Some(code) if matches!(code, 5 | 32 | 33)
        ) || error.kind() == io::ErrorKind::PermissionDenied
        {
            AppError::detailed(
                "update_permission_denied",
                format!("The sing-box executable is in use: {detail}"),
            )
        } else {
            update_phase_error("update_replace_failed", "replacing the core", detail)
        }
    })?;
    Ok(had_target.then_some(backup))
}

fn remove_backup(backup: Option<PathBuf>) {
    if let Some(path) = backup {
        let _ = fs::remove_file(path);
    }
}

fn is_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value[1..]
            .chars()
            .all(|character| character.is_ascii_hexdigit())
}

fn current_time_string() -> String {
    crate::runtime::local_time_string(false)
}

fn limit_log_lines(content: &str, max_lines: usize) -> String {
    let mut starts = vec![0];
    starts.extend(
        content
            .char_indices()
            .filter_map(|(index, character)| (character == '\n').then_some(index + 1)),
    );
    let line_count = starts.len() - usize::from(content.ends_with('\n'));
    if line_count > max_lines {
        return content[starts[line_count - max_lines]..].to_owned();
    }
    content.to_owned()
}

#[cfg(test)]
mod tests {
    use super::prepare_control_api;
    use super::{
        current_time_string, extract_api_secret, extract_api_url, http_client, install_staged_file,
        is_hex_color, limit_log_lines, mirrored_url, program_update_endpoint,
        release_has_updater_metadata, requested_mode, restore_installed_file, select_pre_release,
        staged_profile_path, window_theme, AppPaths, DataSnapshot, Effect, Profile, ReleaseInfo,
        Theme, HTTP_USER_AGENT,
    };
    use serde_json::json;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("winbox-command-tests-{nonce}"));
        fs::create_dir_all(&path).expect("temporary directory");
        path
    }

    #[test]
    fn api_url_preserves_explicit_controller_and_maps_wildcards() {
        assert_eq!(
            extract_api_url(&json!({"experimental":{"clash_api":{"external_controller":":9090"}}})),
            "http://127.0.0.1:9090"
        );
        assert_eq!(
            extract_api_url(
                &json!({"experimental":{"clash_api":{"external_controller":"10.0.0.1:9090"}}})
            ),
            "http://10.0.0.1:9090"
        );
        assert_eq!(
            extract_api_url(
                &json!({"experimental":{"clash_api":{"external_controller":"0.0.0.0:9090"}}})
            ),
            "http://127.0.0.1:9090"
        );
        assert_eq!(
            extract_api_secret(&json!({"experimental":{"clash_api":{"secret":"test-secret"}}})),
            Some("test-secret".to_owned())
        );
    }

    #[test]
    fn runtime_controller_fallback_preserves_profile_options() {
        let mut absent = json!({"log": {"disabled": true}});
        let address = prepare_control_api(&mut absent).unwrap();
        assert!(address.ip().is_loopback());
        assert_ne!(address.port(), 0);
        assert!(extract_api_secret(&absent).is_some());
        assert_eq!(absent["log"]["disabled"], true);
        for (controller, expected) in [
            ("0.0.0.0:9090", "127.0.0.1:9090"),
            ("[::]:9090", "[::1]:9090"),
            ("localhost:9090", "127.0.0.1:9090"),
        ] {
            let mut config = json!({"experimental":{"clash_api":{"external_controller":controller,"secret":"keep", "external_ui":"ui"}}});
            assert_eq!(
                prepare_control_api(&mut config).unwrap().to_string(),
                expected
            );
            assert_eq!(extract_api_secret(&config).as_deref(), Some("keep"));
            assert_eq!(config["experimental"]["clash_api"]["external_ui"], "ui");
        }
        for controller in ["127.0.0.1:0", "example.com:9090", "invalid"] {
            let mut config =
                json!({"experimental":{"clash_api":{"external_controller":controller}}});
            assert!(prepare_control_api(&mut config).is_err());
        }
    }

    #[test]
    fn small_helpers_keep_boundaries() {
        assert!(is_hex_color("#0090FF"));
        assert!(!is_hex_color("0090FF"));
        assert_eq!(limit_log_lines("a\nb\nc\n", 2), "b\nc\n");
        assert_eq!(
            mirrored_url("https://mirror.example/", "https://example.com/a").expect("mirror"),
            "https://mirror.example/https://example.com/a"
        );
    }

    #[test]
    fn stop_request_is_not_a_mode_selection() {
        assert_eq!(requested_mode(false, false), None);
        assert_eq!(requested_mode(false, true), Some((false, true)));
        assert_eq!(requested_mode(true, false), Some((true, false)));
        assert_eq!(requested_mode(true, true), Some((true, true)));
    }

    #[test]
    fn program_update_endpoints_use_release_metadata_for_each_channel() {
        assert_eq!(
            program_update_endpoint(false, None)
                .expect("stable endpoint")
                .as_str(),
            "https://github.com/Leovikii/WinBox/releases/latest/download/latest.json"
        );
        assert_eq!(
            program_update_endpoint(true, Some("v3.0.0-alpha.1"))
                .expect("pre-release endpoint")
                .as_str(),
            "https://github.com/Leovikii/WinBox/releases/download/v3.0.0-alpha.1/latest.json"
        );
        assert!(program_update_endpoint(true, Some("<invalid>")).is_err());
    }

    #[test]
    fn pre_release_lookup_skips_stable_releases() {
        let releases: Vec<ReleaseInfo> = serde_json::from_value(json!([
            {"tag_name":"v3.0.0","prerelease":false},
            {"tag_name":"v3.0.0-alpha.2","prerelease":true},
            {"tag_name":"v3.0.0-alpha.1","prerelease":true}
        ]))
        .expect("release list");
        assert_eq!(
            select_pre_release(releases)
                .expect("latest pre-release")
                .tag_name,
            "v3.0.0-alpha.2"
        );
    }

    #[test]
    fn legacy_release_without_updater_metadata_is_not_updateable() {
        let legacy: ReleaseInfo = serde_json::from_value(json!({
            "tag_name":"v2.8.0",
            "prerelease":false,
            "assets":[{"name":"WinBox-v2.8.0-windows-amd64.zip","browser_download_url":"https://example.invalid/legacy.zip"}]
        }))
        .expect("legacy release");
        assert!(!release_has_updater_metadata(&legacy));

        let current: ReleaseInfo = serde_json::from_value(json!({
            "tag_name":"v3.0.0-alpha.1",
            "prerelease":true,
            "assets":[{"name":"latest.json","browser_download_url":"https://example.invalid/latest.json"}]
        }))
        .expect("updater release");
        assert!(release_has_updater_metadata(&current));
    }

    #[test]
    fn staged_core_check_needs_a_profile_only_when_one_is_selected() {
        let root = temp_dir();
        let paths = AppPaths::from_data_dir(&root);
        let no_selection = DataSnapshot::default();
        assert!(staged_profile_path(&no_selection, &paths)
            .expect("version-only check")
            .is_none());

        let mut selected = DataSnapshot::default();
        selected.state.active_id = "profile-1".to_owned();
        selected.profiles.push(Profile {
            id: "profile-1".to_owned(),
            ..Profile::default()
        });
        let error =
            staged_profile_path(&selected, &paths).expect_err("selected profile file is missing");
        assert_eq!(error.code, "config_missing");
        assert_eq!(error.message, "Profile file is missing");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn profile_time_uses_legacy_shape() {
        let value = current_time_string();
        assert_eq!(value.len(), 16);
        for (index, byte) in value.bytes().enumerate() {
            match index {
                4 | 7 => assert_eq!(byte, b'-'),
                10 => assert_eq!(byte, b' '),
                13 => assert_eq!(byte, b':'),
                _ => assert!(byte.is_ascii_digit()),
            }
        }
    }

    #[tokio::test]
    async fn remote_requests_use_the_sing_box_user_agent() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        use tokio::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").await.expect("listener");
        let address = listener.local_addr().expect("listener address");
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.expect("connection");
            let mut request = Vec::new();
            let mut chunk = [0_u8; 1024];
            loop {
                let read = socket.read(&mut chunk).await.expect("request");
                if read == 0 {
                    break;
                }
                request.extend_from_slice(&chunk[..read]);
                if request.windows(4).any(|window| window == b"\r\n\r\n") {
                    break;
                }
            }
            let request = String::from_utf8_lossy(&request);
            assert!(request.lines().any(|line| {
                line.eq_ignore_ascii_case(&format!("user-agent: {HTTP_USER_AGENT}"))
            }));
            socket
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n")
                .await
                .expect("response");
        });

        let response = http_client()
            .expect("HTTP client")
            .get(format!("http://{address}"))
            .send()
            .await
            .expect("HTTP response");
        assert!(response.status().is_success());
        server.await.expect("server task");
    }

    #[test]
    fn window_theme_matches_webview_and_mica_modes() {
        let (light_theme, light_effect) = window_theme("light").expect("light");
        assert_eq!(light_theme, Some(Theme::Light));
        assert_eq!(light_effect, Effect::MicaLight);

        let (dark_theme, dark_effect) = window_theme("dark").expect("dark");
        assert_eq!(dark_theme, Some(Theme::Dark));
        assert_eq!(dark_effect, Effect::MicaDark);

        let (system_theme, system_effect) = window_theme("system").expect("system");
        assert_eq!(system_theme, None);
        assert_eq!(system_effect, Effect::Mica);

        assert!(window_theme("unknown").is_err());
    }

    #[test]
    fn staged_core_install_can_restore_previous_binary() {
        let root = temp_dir();
        let target = root.join("sing-box.exe");
        let staged = root.join("staged.exe");
        fs::write(&target, b"old core").expect("old core");
        fs::write(&staged, b"new core").expect("new core");

        let backup = install_staged_file(&staged, &target).expect("install");
        assert_eq!(fs::read(&target).expect("installed core"), b"new core");
        restore_installed_file(backup, &target).expect("restore");
        assert_eq!(fs::read(&target).expect("restored core"), b"old core");

        fs::remove_dir_all(root).expect("cleanup");
    }
}
