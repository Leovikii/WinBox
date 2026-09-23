#[cfg(not(all(target_os = "windows", target_arch = "x86_64")))]
compile_error!("WinBox supports only Windows AMD64/x64");

pub mod commands;
#[cfg(windows)]
pub mod core;
pub mod handoff;
pub mod models;
pub mod paths;
#[cfg(windows)]
pub mod platform;
#[cfg(windows)]
pub mod runtime;
pub mod startup;
pub mod storage;
pub mod updates;

use paths::AppPaths;
use runtime::RuntimeState;
use startup::{StartupOptions, DELAY_START};
use std::time::Duration;
use storage::Storage;
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, RunEvent, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial = match handoff::receive() {
        Ok(action) => action,
        Err(error) => {
            eprintln!("WinBox handoff failed: {error}");
            return;
        }
    };
    let startup = StartupOptions::from_environment();
    if startup.delay_start {
        std::thread::sleep(DELAY_START);
    }

    let minimized = startup.minimized;
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = commands::show(app.clone());
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::get_init_data,
            commands::authorize,
            commands::continue_handoff,
            commands::get_product_version,
            commands::get_override,
            commands::get_default_override,
            commands::save_override,
            commands::reset_override,
            commands::save_settings,
            commands::get_start_on_boot,
            commands::set_start_on_boot,
            commands::set_auto_connect,
            commands::save_theme,
            commands::save_mode,
            commands::toggle_ipv6,
            commands::set_pre_release,
            commands::set_log_config,
            commands::set_close_behavior,
            commands::set_window_theme,
            commands::apply_state,
            commands::restart_core,
            commands::add_profile,
            commands::delete_profile,
            commands::edit_profile,
            commands::select_profile,
            commands::update_active_profile,
            commands::get_app_log,
            commands::clear_app_log,
            commands::get_kernel_log,
            commands::clear_kernel_log,
            commands::get_log_file,
            commands::get_uwp_apps,
            commands::set_uwp_loopback_exemptions,
            commands::open_dashboard,
            commands::open_url,
            commands::minimize,
            commands::minimize_to_tray,
            commands::show,
            commands::quit,
            commands::check_update,
            commands::check_program_update,
            commands::update_kernel,
            commands::update_program
        ])
        .setup(move |app| {
            app.manage(startup);
            app.manage(handoff::HandoffState {
                initial: std::sync::Mutex::new(initial.clone()),
                ..Default::default()
            });
            let paths = AppPaths::from_data_dir(app.path().app_local_data_dir()?);
            let runtime = RuntimeState::new(paths.clone());
            // Recover before exposing commands or starting any network/privilege flow.
            let proxy_recovery_failed =
                tauri::async_runtime::block_on(runtime.restore_proxy_if_owned()).is_err();
            tauri::async_runtime::block_on(runtime.clear_session_logs())?;
            let storage = Storage::new(paths);
            app.manage(runtime.clone());
            app.manage(storage.clone());
            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let separator_one = PredefinedMenuItem::separator(app)?;
            let mixed_item =
                CheckMenuItem::with_id(app, "mode-mixed", "Mixed", true, false, None::<&str>)?;
            let tun_item =
                CheckMenuItem::with_id(app, "mode-tun", "Tun", true, false, None::<&str>)?;
            let proxy_item =
                CheckMenuItem::with_id(app, "mode-proxy", "Proxy", true, false, None::<&str>)?;
            let stop_item =
                CheckMenuItem::with_id(app, "mode-stop", "Stop Service", true, true, None::<&str>)?;
            let separator_two = PredefinedMenuItem::separator(app)?;
            let restart_core_item =
                MenuItem::with_id(app, "restart-core", "Restart Core", true, None::<&str>)?;
            let separator_three = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            app.manage(commands::TrayMenuState {
                mode_mixed: mixed_item.clone(),
                mode_tun: tun_item.clone(),
                mode_proxy: proxy_item.clone(),
                stop: stop_item.clone(),
            });
            let menu = Menu::with_items(
                app,
                &[
                    &show_item,
                    &separator_one,
                    &mixed_item,
                    &tun_item,
                    &proxy_item,
                    &stop_item,
                    &separator_two,
                    &restart_core_item,
                    &separator_three,
                    &quit_item,
                ],
            )?;
            let icon = Image::from_bytes(include_bytes!("../icons/icon.ico"))?;
            TrayIconBuilder::with_id("main")
                .icon(icon)
                .menu(&menu)
                .tooltip("WinBox")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        let _ = commands::show(app.clone());
                    }
                    "mode-mixed" => {
                        let app = app.clone();
                        tauri::async_runtime::spawn(async move {
                            commands::apply_state_from_tray(app, true, true).await;
                        });
                    }
                    "mode-tun" => {
                        let app = app.clone();
                        tauri::async_runtime::spawn(async move {
                            commands::apply_state_from_tray(app, true, false).await;
                        });
                    }
                    "mode-proxy" => {
                        let app = app.clone();
                        tauri::async_runtime::spawn(async move {
                            commands::apply_state_from_tray(app, false, true).await;
                        });
                    }
                    "mode-stop" => {
                        let app = app.clone();
                        tauri::async_runtime::spawn(async move {
                            commands::apply_state_from_tray(app, false, false).await;
                        });
                    }
                    "restart-core" => {
                        let app = app.clone();
                        tauri::async_runtime::spawn(async move {
                            commands::restart_core_from_tray(app).await;
                        });
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if matches!(
                        event,
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        }
                    ) {
                        let _ = commands::show(tray.app_handle().clone());
                    }
                })
                .build(app)?;
            let snapshot = storage.load().unwrap_or_default();
            let _ = commands::set_window_theme(
                app.handle().clone(),
                snapshot.settings.theme_mode.clone(),
            );
            commands::refresh_tray(
                app.handle(),
                false,
                snapshot.state.tun_mode,
                snapshot.state.sys_proxy,
            );

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_shadow(true);
            }

            if let Some(window) = app.get_webview_window("main") {
                let event_app = app.handle().clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = event_app.emit("window-close-requested", ());
                    }
                });
            }
            if minimized && !proxy_recovery_failed {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            let startup_app = app.handle().clone();
            tauri::async_runtime::block_on(runtime.append_app_log(
                &startup_app,
                "INFO",
                "Application started",
            ))?;
            if let Some(error) = tauri::async_runtime::block_on(runtime.proxy_error()) {
                tauri::async_runtime::block_on(runtime.append_app_log(
                    &startup_app,
                    "ERROR",
                    &error,
                ))?;
            }
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(200)).await;
                if initial.is_none() && !proxy_recovery_failed && !startup.notification {
                    commands::startup_runtime(startup_app, runtime).await;
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building WinBox");
    app.run(|app, event| {
        if matches!(event, RunEvent::ExitRequested { .. }) {
            let runtime = app.state::<RuntimeState>().inner().clone();
            let app_handle = (*app).clone();
            tauri::async_runtime::block_on(commands::shutdown_runtime(&app_handle, &runtime));
        }
    });
}
