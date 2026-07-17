use serde::Deserialize;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, WindowEvent,
};

use crate::desktop_mode::{
    apply_desktop_mode_setting, detach_before_exit, restore_windows_desktop,
};
use crate::monitor_windows::{
    any_launcher_window_visible, focus_launcher_under_cursor, hide_all_launcher_windows,
    is_launcher_window_label, show_all_launcher_windows, MAIN_WINDOW_LABEL,
};
use crate::DesktopModeState;

#[cfg(desktop)]
use tauri_plugin_autostart::MacosLauncher;
#[cfg(desktop)]
use tauri_plugin_autostart::ManagerExt;
#[cfg(desktop)]
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub struct NativeSettingsState {
    pub close_behavior: Mutex<String>,
}

impl Default for NativeSettingsState {
    fn default() -> Self {
        Self {
            close_behavior: Mutex::new("hide".to_string()),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettingsPayload {
    pub global_shortcut: String,
    pub launch_on_startup: bool,
    pub close_behavior: String,
    pub desktop_mode: bool,
    #[serde(default = "default_language_field")]
    pub language: String,
}

fn default_language_field() -> String {
    detect_system_language().to_string()
}

struct TrayLabels {
    show: &'static str,
    hide: &'static str,
    settings: &'static str,
    restore: &'static str,
    quit: &'static str,
}

pub fn resolve_app_language(tag: &str) -> &'static str {
    let primary = tag
        .trim()
        .split(['-', '_'])
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    match primary.as_str() {
        "es" => "es",
        "en" => "en",
        "de" => "de",
        "fr" => "fr",
        "ja" => "ja",
        _ => "en",
    }
}

pub fn detect_system_language() -> &'static str {
    #[cfg(windows)]
    {
        use windows::Win32::Globalization::GetUserDefaultLocaleName;

        let mut buffer = [0u16; 85];
        let len = unsafe { GetUserDefaultLocaleName(&mut buffer) };
        if len > 1 {
            let tag = String::from_utf16_lossy(&buffer[..(len as usize - 1)]);
            return resolve_app_language(&tag);
        }
        "en"
    }

    #[cfg(not(windows))]
    {
        "en"
    }
}

fn tray_labels(language: &str) -> TrayLabels {
    match resolve_app_language(language) {
        "es" => TrayLabels {
            show: "Mostrar P5 Explorer",
            hide: "Ocultar",
            settings: "Configuración",
            restore: "Restaurar escritorio de Windows",
            quit: "Salir",
        },
        "de" => TrayLabels {
            show: "P5 Explorer anzeigen",
            hide: "Ausblenden",
            settings: "Einstellungen",
            restore: "Windows-Desktop wiederherstellen",
            quit: "Beenden",
        },
        "fr" => TrayLabels {
            show: "Afficher P5 Explorer",
            hide: "Masquer",
            settings: "Paramètres",
            restore: "Restaurer le bureau Windows",
            quit: "Quitter",
        },
        "ja" => TrayLabels {
            show: "P5 Explorer を表示",
            hide: "隠す",
            settings: "設定",
            restore: "Windows のデスクトップを復元",
            quit: "終了",
        },
        _ => TrayLabels {
            show: "Show P5 Explorer",
            hide: "Hide",
            settings: "Settings",
            restore: "Restore Windows desktop",
            quit: "Quit",
        },
    }
}

fn build_tray_menu(app: &AppHandle, language: &str) -> Result<Menu<tauri::Wry>, tauri::Error> {
    let labels = tray_labels(language);
    let restore_desktop_item = MenuItem::with_id(
        app,
        "tray_restore_desktop",
        labels.restore,
        true,
        None::<&str>,
    )?;
    let show_item = MenuItem::with_id(app, "tray_show", labels.show, true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "tray_hide", labels.hide, true, None::<&str>)?;
    let settings_item =
        MenuItem::with_id(app, "tray_settings", labels.settings, true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "tray_quit", labels.quit, true, None::<&str>)?;
    Menu::with_items(
        app,
        &[
            &show_item,
            &hide_item,
            &settings_item,
            &restore_desktop_item,
            &quit_item,
        ],
    )
}

fn apply_tray_language(app: &AppHandle, language: &str) -> Result<(), String> {
    let menu = build_tray_menu(app, language).map_err(|e| e.to_string())?;
    if let Some(tray) = app.tray_by_id("main-tray") {
        tray.set_menu(Some(menu))
            .map_err(|e| format!("Failed to update tray menu: {e}"))?;
    }
    Ok(())
}

pub fn main_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "No se encontró la ventana principal.".to_string())
}

pub fn show_main_window(app: &AppHandle) -> Result<(), String> {
    show_all_launcher_windows(app)
}

pub fn hide_main_window(app: &AppHandle) -> Result<(), String> {
    hide_all_launcher_windows(app)
}

pub fn toggle_main_window(app: &AppHandle) -> Result<(), String> {
    if any_launcher_window_visible(app)? {
        hide_main_window(app)
    } else {
        show_main_window(app)
    }
}

fn normalize_shortcut(input: &str) -> String {
    input
        .trim()
        .replace("CmdOrCtrl", "Control")
        .replace("CommandOrControl", "Control")
        .replace("Ctrl", "Control")
        .split('+')
        .map(|part| {
            let part = part.trim();
            if part.eq_ignore_ascii_case("control") {
                "Control".to_string()
            } else if part.eq_ignore_ascii_case("alt") {
                "Alt".to_string()
            } else if part.eq_ignore_ascii_case("shift") {
                "Shift".to_string()
            } else if part.len() == 1 {
                part.to_uppercase()
            } else {
                part.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("+")
}

#[cfg(desktop)]
fn apply_global_shortcut(app: &AppHandle, shortcut_str: &str) -> Result<(), String> {
    let normalized = normalize_shortcut(shortcut_str);
    if normalized.is_empty() {
        return Err("El atajo global está vacío.".into());
    }

    app.global_shortcut()
        .unregister_all()
        .map_err(|e| format!("No se pudieron limpiar atajos previos: {e}"))?;

    let shortcut: Shortcut = normalized
        .parse()
        .map_err(|e| format!("Atajo inválido ({normalized}): {e}"))?;

    app.global_shortcut()
        .on_shortcut(shortcut, |app, _, event| {
            if event.state() == ShortcutState::Pressed {
                let _ = toggle_main_window(app);
            }
        })
        .map_err(|e| format!("No se pudo registrar el atajo ({normalized}): {e}"))?;

    Ok(())
}

#[cfg(not(desktop))]
fn apply_global_shortcut(_app: &AppHandle, _shortcut_str: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(desktop)]
pub(crate) fn apply_autostart(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let autostart = app.autolaunch();
    if enabled {
        autostart
            .enable()
            .map_err(|e| format!("No se pudo activar el inicio con Windows: {e}"))?;
    } else {
        autostart
            .disable()
            .map_err(|e| format!("No se pudo desactivar el inicio con Windows: {e}"))?;
    }
    Ok(())
}

#[cfg(not(desktop))]
fn apply_autostart(_app: &AppHandle, _enabled: bool) -> Result<(), String> {
    Ok(())
}

fn apply_close_behavior(state: &NativeSettingsState, close_behavior: &str) {
    if let Ok(mut current) = state.close_behavior.lock() {
        *current = close_behavior.to_string();
    }
}

pub fn current_close_behavior(state: &NativeSettingsState) -> String {
    state
        .close_behavior
        .lock()
        .map(|value| value.clone())
        .unwrap_or_else(|_| "hide".to_string())
}

pub async fn sync_native_settings_impl(
    app: &AppHandle,
    native_state: &NativeSettingsState,
    desktop_state: &DesktopModeState,
    settings: DesktopSettingsPayload,
) -> Result<(), String> {
    apply_close_behavior(native_state, &settings.close_behavior);
    apply_global_shortcut(app, &settings.global_shortcut)?;

    let should_autostart = settings.launch_on_startup || settings.desktop_mode;
    apply_autostart(app, should_autostart)?;
    apply_desktop_mode_setting(app, desktop_state, settings.desktop_mode).await?;
    apply_tray_language(app, &settings.language)?;
    Ok(())
}

pub async fn apply_persisted_desktop_mode(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<DesktopModeState>();
    let path = crate::state_path(app)?;

    if !path.exists() {
        return Ok(());
    }

    let contents = std::fs::read_to_string(&path)
        .map_err(|e| format!("No se pudo leer el estado guardado: {e}"))?;

    let parsed: serde_json::Value = serde_json::from_str(&contents)
        .map_err(|e| format!("El estado guardado es inválido: {e}"))?;

    let desktop_mode = parsed
        .get("settings")
        .and_then(|settings| settings.get("desktopMode"))
        .and_then(|value| value.as_bool())
        .unwrap_or(false);

    let _ = crate::monitor_windows::sync_monitor_windows_impl(app.clone()).await;

    if desktop_mode {
        apply_desktop_mode_setting(app, &state, true).await?;
    }

    Ok(())
}

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let language = detect_system_language();
    let menu = build_tray_menu(app, language)?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or("No system tray icon found.")?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .tooltip("Persona5 Explorer")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray_show" => {
                let _ = show_main_window(app);
            }
            "tray_hide" => {
                let _ = hide_main_window(app);
            }
            "tray_settings" => {
                let _ = show_main_window(app);
                let _ = app.emit("navigate-settings", ());
            }
            "tray_restore_desktop" => {
                let handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    let state = handle.state::<DesktopModeState>();
                    let _ = restore_windows_desktop(&handle, &state).await;
                    let _ = handle.emit("desktop-mode-changed", false);
                });
            }
            "tray_quit" => {
                let state = app.state::<DesktopModeState>();
                detach_before_exit(app, &state);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = toggle_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

pub fn attach_launcher_window_events(app: &AppHandle, window: &tauri::WebviewWindow) {
    let app_handle = app.clone();
    let label = window.label().to_string();
    let _ = window.on_window_event(move |event| {
        match event {
            WindowEvent::CloseRequested { api, .. } => {
                let state = app_handle.state::<NativeSettingsState>();
                if current_close_behavior(&state) == "hide" {
                    api.prevent_close();
                    let _ = hide_all_launcher_windows(&app_handle);
                } else if label != MAIN_WINDOW_LABEL {
                    // Keep the app alive when closing a satellite; only hide it.
                    api.prevent_close();
                    if let Some(window) = app_handle.get_webview_window(&label) {
                        let _ = window.hide();
                    }
                }
            }
            WindowEvent::Focused(focused) => {
                if *focused && label == MAIN_WINDOW_LABEL {
                    // Taskbar activation: focus the launcher under the cursor, not always main.
                    let _ = focus_launcher_under_cursor(&app_handle);
                } else if !*focused {
                    let desktop_state = app_handle.state::<DesktopModeState>();
                    let desktop_active = desktop_state
                        .active
                        .lock()
                        .map(|value| *value)
                        .unwrap_or(false);
                    if desktop_active {
                        // Pin z-order only — full refresh on blur caused a multi-window focus loop.
                        let _ = crate::desktop_mode::pin_all_desktop_overlays(&app_handle);
                    }
                }
            }
            WindowEvent::Resized(_) | WindowEvent::Moved(_) => {
                // Taskbar click on an already-focused main minimizes it; undo and refocus.
                if label != MAIN_WINDOW_LABEL {
                    return;
                }
                if let Some(window) = app_handle.get_webview_window(&label) {
                    if window.is_minimized().unwrap_or(false) {
                        let _ = window.unminimize();
                        let _ = focus_launcher_under_cursor(&app_handle);
                    }
                }
            }
            _ => {}
        }
    });
}

pub fn setup_window_close_handler(app: &AppHandle) {
    for window in app.webview_windows().into_values() {
        if is_launcher_window_label(window.label()) {
            attach_launcher_window_events(app, &window);
        }
    }
}

pub fn setup_plugins(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    #[cfg(desktop)]
    {
        builder
            .plugin(tauri_plugin_autostart::init(
                MacosLauncher::LaunchAgent,
                Some(vec![]),
            ))
            .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    }

    #[cfg(not(desktop))]
    {
        builder
    }
}

pub fn on_run_event(app: &AppHandle, event: RunEvent) {
    if let RunEvent::ExitRequested { api, .. } = event {
        let state = app.state::<NativeSettingsState>();
        let behavior = state
            .close_behavior
            .lock()
            .map(|value| value.clone())
            .unwrap_or_else(|_| "hide".to_string());

        if behavior == "hide" {
            api.prevent_exit();
            let _ = hide_main_window(app);
        }
    }
}

#[tauri::command]
pub fn exit_app(app: AppHandle, desktop_state: tauri::State<'_, DesktopModeState>) {
    detach_before_exit(&app, &desktop_state);
    app.exit(0);
}

#[tauri::command]
pub async fn sync_native_settings(
    app: AppHandle,
    native_state: tauri::State<'_, NativeSettingsState>,
    desktop_state: tauri::State<'_, DesktopModeState>,
    settings: DesktopSettingsPayload,
) -> Result<(), String> {
    sync_native_settings_impl(&app, &native_state, &desktop_state, settings).await
}
