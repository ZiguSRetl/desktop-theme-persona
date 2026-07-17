use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

#[cfg(windows)]
mod desktop_embed;
#[cfg(not(windows))]
mod desktop_embed_stub;

mod app_search;
mod desktop_mode;
mod file_icon;
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

fn is_uri(target: &str) -> bool {
    target.contains("://")
}

fn is_lnk(target: &str) -> bool {
    target.to_ascii_lowercase().ends_with(".lnk")
}

#[tauri::command]
fn launch_item(app: AppHandle, payload: LaunchPayload) -> Result<(), String> {
    let item_type = payload.item_type.as_str();
    let target = payload.target.trim();
    let args = payload.arguments.unwrap_or_default();

    if target.is_empty() {
        return Err("El destino está vacío.".into());
    }

    match item_type {
        "url" => app
            .opener()
            .open_url(target, None::<&str>)
            .map_err(|e| format!("No se pudo abrir la URL: {e}")),
        "folder" => {
            if !std::path::Path::new(target).is_dir() {
                return Err(format!("La carpeta no existe: {target}"));
            }
            Command::new("explorer")
                .arg(target)
                .spawn()
                .map(|_| ())
                .map_err(|e| format!("No se pudo abrir la carpeta: {e}"))
        }
        "application" | "game" => {
            if is_uri(target) {
                return app
                    .opener()
                    .open_url(target, None::<&str>)
                    .map_err(|e| format!("No se pudo abrir el URI: {e}"));
            }

            if is_lnk(target) || target.contains(' ') {
                let mut cmd = Command::new("cmd");
                cmd.args(["/C", "start", "", target]);
                return cmd
                    .spawn()
                    .map(|_| ())
                    .map_err(|e| format!("No se pudo lanzar el acceso: {e}"));
            }

            if !std::path::Path::new(target).exists() {
                return Err(format!("No se encontró la ruta: {target}"));
            }

            let mut cmd = Command::new(target);
            if !args.is_empty() {
                cmd.args(&args);
            }
            cmd.spawn()
                .map(|_| ())
                .map_err(|e| format!("No se pudo lanzar la aplicación: {e}"))
        }
        other => Err(format!("Tipo de acceso no soportado: {other}")),
    }
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
fn get_file_icon(target: String) -> Result<String, String> {
    file_icon::get_file_icon(&target)
}

#[tauri::command]
fn reveal_item_in_dir(app: AppHandle, target: String) -> Result<(), String> {
    let path = target.trim();
    if path.is_empty() {
        return Err("La ruta está vacía.".into());
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
