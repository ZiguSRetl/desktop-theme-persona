use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

#[cfg(windows)]
mod desktop_embed;
#[cfg(not(windows))]
mod desktop_embed_stub;

mod app_search;
mod desktop_mode;
mod file_icon;
mod launch;
mod monitor_windows;
mod system;
pub mod system_clean;
mod system_stats;
mod wallpaper;

#[cfg(windows)]
pub use desktop_embed::DesktopModeState;
#[cfg(not(windows))]
pub use desktop_embed_stub::DesktopModeState;

use desktop_mode::{disable_desktop_mode, enable_desktop_mode, is_desktop_mode_active_cmd};
use monitor_windows::{hide_all_launcher_windows, sync_monitor_windows, MonitorWindowsState};
use system::{exit_app, sync_native_settings, NativeSettingsState};
use system_clean::run_clean_script;
use system_stats::{get_system_stats, list_gpus, SystemStatsState};

const STATE_FILE: &str = "launcher-state.json";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LaunchPayload {
    item_type: String,
    target: String,
    arguments: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedDesktopState {
    schema_version: u32,
    items: serde_json::Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    settings: Option<serde_json::Value>,
}

pub fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No se pudo obtener el directorio de datos: {e}"))?;

    fs::create_dir_all(&dir)
        .map_err(|e| format!("No se pudo crear el directorio de datos: {e}"))?;
    Ok(dir.join(STATE_FILE))
}

#[tauri::command]
fn launch_item(app: AppHandle, payload: LaunchPayload) -> Result<(), String> {
    launch::launch_item(
        &app,
        launch::LaunchPayload {
            item_type: payload.item_type,
            target: payload.target,
            arguments: payload.arguments,
        },
    )
}

#[tauri::command]
fn search_installed_apps(
    query: String,
    limit: Option<u32>,
) -> Result<Vec<app_search::InstalledAppResult>, String> {
    let max = limit.unwrap_or(12).clamp(1, 50) as usize;
    app_search::search_installed_apps(&query, max)
}

#[tauri::command]
fn list_installed_apps() -> Result<Vec<app_search::InstalledAppResult>, String> {
    app_search::list_installed_apps()
}

#[tauri::command]
fn start_installed_apps_scan(app: AppHandle, force: Option<bool>) -> Result<(), String> {
    app_search::start_installed_apps_scan(app, force.unwrap_or(false));
    Ok(())
}

#[tauri::command]
fn refresh_installed_apps_index() -> Result<usize, String> {
    app_search::refresh_installed_apps_index()
}

#[tauri::command]
fn get_file_icon(target: String, size: Option<u32>) -> Result<String, String> {
    file_icon::get_file_icon(&target, size)
}

#[tauri::command]
fn reveal_item_in_dir(app: AppHandle, target: String) -> Result<(), String> {
    let path = target.trim();
    if path.is_empty() {
        return Err("La ruta está vacía.".into());
    }

    if app_search::is_shell_app_target(path) {
        return Err(
            "Esta aplicación empaquetada no tiene una ubicación de archivo que abrir.".into(),
        );
    }

    if app_search::is_protocol_target(path) {
        return Err("Los enlaces y protocolos no tienen una ubicación de archivo que abrir.".into());
    }

    if !std::path::Path::new(path).exists() {
        return Err(format!("No se encontró la ruta: {path}"));
    }

    app.opener()
        .reveal_item_in_dir(path)
        .map_err(|e| format!("No se pudo abrir la ubicación: {e}"))
}

#[tauri::command]
fn load_launcher_state(app: AppHandle) -> Result<Option<PersistedDesktopState>, String> {
    let path = state_path(&app)?;

    if !path.exists() {
        return Ok(None);
    }

    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("No se pudo leer el estado guardado: {e}"))?;

    serde_json::from_str(&contents)
        .map(Some)
        .map_err(|e| format!("El estado guardado es inválido: {e}"))
}

#[tauri::command]
fn save_launcher_state(app: AppHandle, state: PersistedDesktopState) -> Result<(), String> {
    let path = state_path(&app)?;
    let contents = serde_json::to_string_pretty(&state)
        .map_err(|e| format!("No se pudo serializar el estado: {e}"))?;

    fs::write(&path, contents).map_err(|e| format!("No se pudo guardar el estado: {e}"))
}

#[tauri::command]
fn hide_launcher_windows(app: AppHandle) -> Result<(), String> {
    hide_all_launcher_windows(&app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init());

    let builder = system::setup_plugins(builder);

    let app = builder
        .manage(NativeSettingsState::default())
        .manage(DesktopModeState::default())
        .manage(MonitorWindowsState::default())
        .manage(SystemStatsState::default())
        .setup(|app| {
            #[cfg(desktop)]
            system::setup_tray(app.handle())?;
            system::setup_window_close_handler(app.handle());
            monitor_windows::start_monitor_layout_watcher(app.handle().clone());
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let _ = system::apply_persisted_desktop_mode(&handle).await;
            });
            app_search::warm_installed_apps_index();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            launch_item,
            get_file_icon,
            search_installed_apps,
            list_installed_apps,
            start_installed_apps_scan,
            refresh_installed_apps_index,
            reveal_item_in_dir,
            load_launcher_state,
            save_launcher_state,
            sync_native_settings,
            exit_app,
            get_system_stats,
            list_gpus,
            enable_desktop_mode,
            disable_desktop_mode,
            is_desktop_mode_active_cmd,
            sync_monitor_windows,
            hide_launcher_windows,
            wallpaper::save_wallpaper,
            wallpaper::remove_wallpaper,
            wallpaper::load_image_data_url,
            run_clean_script,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        system::on_run_event(app_handle, event);
    });
}
