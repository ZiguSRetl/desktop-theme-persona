use tauri::{AppHandle, State};

#[cfg(windows)]
use crate::desktop_embed::{
    detach_from_desktop, embed_as_desktop, hide_desktop_icons, pin_desktop_overlays_zorder,
    refresh_desktop_overlays_for_app, restore_desktop_icons, snap_desktop_overlays_if_drifted,
    start_desktop_overlay_watcher, stop_desktop_overlay_watcher, DesktopModeState,
};

#[cfg(not(windows))]
use crate::desktop_embed_stub::{
    detach_from_desktop, embed_as_desktop, hide_desktop_icons, pin_desktop_overlays_zorder,
    refresh_desktop_overlays_for_app, restore_desktop_icons, snap_desktop_overlays_if_drifted,
    start_desktop_overlay_watcher, stop_desktop_overlay_watcher, DesktopModeState,
};

use crate::monitor_windows::{launcher_windows, sync_monitor_windows_impl, MAIN_WINDOW_LABEL};

static DESKTOP_TRANSITION: tauri::async_runtime::Mutex<()> =
    tauri::async_runtime::Mutex::const_new(());

pub fn is_desktop_mode_active(state: &DesktopModeState) -> bool {
    state.active.lock().map(|value| *value).unwrap_or(false)
}

pub fn refresh_all_desktop_overlays(app: &AppHandle) -> Result<(), String> {
    refresh_desktop_overlays_for_app(app)
}

pub fn snap_overlays_if_drifted(app: &AppHandle) -> Result<(), String> {
    snap_desktop_overlays_if_drifted(app)
}

pub fn pin_all_desktop_overlays(app: &AppHandle) -> Result<(), String> {
    pin_desktop_overlays_zorder(app)
}

pub async fn enable_desktop_mode_impl(
    app: &AppHandle,
    state: &DesktopModeState,
) -> Result<(), String> {
    let _transition = DESKTOP_TRANSITION.lock().await;
    if is_desktop_mode_active(state) {
        return Ok(());
    }

    if !cfg!(windows) || app.tray_by_id("main-tray").is_none() {
        return Err("El modo escritorio requiere Windows y la bandeja del sistema.".into());
    }

    let result: Result<(), String> = (|| {
        for window in &launcher_windows(app) {
            window
                .set_resizable(false)
                .map_err(|e| format!("No se pudo bloquear el redimensionado: {e}"))?;
            window
                .set_skip_taskbar(true)
                .map_err(|e| format!("No se pudo ocultar de la barra de tareas: {e}"))?;
            window
                .set_decorations(false)
                .map_err(|e| format!("No se pudo quitar decoraciones: {e}"))?;
            // Avoid Tauri fullscreen: it fights Win32 SetWindowPos overlays and causes flicker.
            window
                .set_fullscreen(false)
                .map_err(|e| format!("No se pudo preparar la ventana: {e}"))?;
            window.unmaximize().map_err(|e| e.to_string())?;
            window.unminimize().map_err(|e| e.to_string())?;
            window
                .show()
                .map_err(|e| format!("No se pudo mostrar la ventana: {e}"))?;
            embed_as_desktop(window, state)?;
        }

        hide_desktop_icons(state)?;
        refresh_all_desktop_overlays(app)
    })();

    if let Err(error) = result {
        return Err(restore_after_failure(app, state, error).await);
    }

    if let Ok(mut active) = state.active.lock() {
        *active = true;
    }

    if let Err(error) = sync_monitor_windows_impl(app.clone()).await {
        return Err(restore_after_failure(app, state, error).await);
    }

    // Start z-order keeper before focus so the shell stays behind other apps.
    start_desktop_overlay_watcher(app.clone());

    // Z-order is enforced by WM_WINDOWPOSCHANGING subclass; avoid set_focus
    // here so we don't raise above other apps on enable.
    let _ = pin_all_desktop_overlays(app);

    Ok(())
}

pub async fn disable_desktop_mode_impl(
    app: &AppHandle,
    state: &DesktopModeState,
) -> Result<(), String> {
    let _transition = DESKTOP_TRANSITION.lock().await;
    if !is_desktop_mode_active(state) {
        return Ok(());
    }

    restore_windowed_mode(app, state).await
}

async fn restore_after_failure(
    app: &AppHandle,
    state: &DesktopModeState,
    error: String,
) -> String {
    match restore_windowed_mode(app, state).await {
        Ok(()) => error,
        Err(restore_error) => format!("{error}\n{restore_error}"),
    }
}

async fn restore_windowed_mode(app: &AppHandle, state: &DesktopModeState) -> Result<(), String> {
    stop_desktop_overlay_watcher();

    if let Ok(mut active) = state.active.lock() {
        *active = false;
    }

    let mut errors = Vec::new();
    for window in launcher_windows(app) {
        errors.extend(detach_from_desktop(&window, state).err());
        if window.label() == MAIN_WINDOW_LABEL {
            errors.extend(
                [
                    window.set_fullscreen(false),
                    window.set_skip_taskbar(false),
                    window.set_decorations(true),
                    window.set_resizable(true),
                    window.set_minimizable(true),
                    window.show(),
                    window.set_focus(),
                ]
                .into_iter()
                .filter_map(Result::err)
                .map(|error| error.to_string()),
            );
        } else {
            errors.extend(window.destroy().err().map(|error| error.to_string()));
        }
    }
    errors.extend(restore_desktop_icons(state).err());
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("\n"))
    }
}

#[tauri::command]
pub async fn enable_desktop_mode(
    app: AppHandle,
    state: State<'_, DesktopModeState>,
) -> Result<(), String> {
    enable_desktop_mode_impl(&app, &state).await
}

#[tauri::command]
pub async fn disable_desktop_mode(
    app: AppHandle,
    state: State<'_, DesktopModeState>,
) -> Result<(), String> {
    disable_desktop_mode_impl(&app, &state).await
}

#[tauri::command]
pub fn is_desktop_mode_active_cmd(state: State<'_, DesktopModeState>) -> Result<bool, String> {
    Ok(is_desktop_mode_active(&state))
}

pub async fn apply_desktop_mode_setting(
    app: &AppHandle,
    state: &DesktopModeState,
    enabled: bool,
) -> Result<(), String> {
    if enabled {
        enable_desktop_mode_impl(app, state).await
    } else {
        disable_desktop_mode_impl(app, state).await
    }
}

pub async fn restore_windows_desktop(
    app: &AppHandle,
    state: &DesktopModeState,
) -> Result<(), String> {
    disable_desktop_mode_impl(app, state).await
}

pub fn detach_before_exit(app: &AppHandle, state: &DesktopModeState) {
    if is_desktop_mode_active(state) {
        stop_desktop_overlay_watcher();
        if let Ok(mut guard) = state.active.lock() {
            *guard = false;
        }
        for window in launcher_windows(app) {
            let _ = detach_from_desktop(&window, state);
        }
    }
    let _ = restore_desktop_icons(state);
}
