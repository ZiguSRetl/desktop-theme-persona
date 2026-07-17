use tauri::{AppHandle, Manager, State};

#[cfg(windows)]
use crate::desktop_embed::{
    detach_from_desktop, embed_as_desktop, hide_desktop_icons, pin_desktop_overlays_zorder,
    refresh_desktop_overlays_for_app, show_desktop_icons, start_desktop_overlay_watcher,
    stop_desktop_overlay_watcher, DesktopModeState,
};

#[cfg(not(windows))]
use crate::desktop_embed_stub::{
    detach_from_desktop, embed_as_desktop, hide_desktop_icons, pin_desktop_overlays_zorder,
    refresh_desktop_overlays_for_app, show_desktop_icons, start_desktop_overlay_watcher,
    stop_desktop_overlay_watcher, DesktopModeState,
};

use crate::monitor_windows::{launcher_windows, ordered_monitors, sync_monitor_windows_impl};
use crate::system::apply_autostart;

pub fn is_desktop_mode_active(state: &DesktopModeState) -> bool {
    state
        .active
        .lock()
        .map(|value| *value)
        .unwrap_or(false)
}

pub fn refresh_all_desktop_overlays(app: &AppHandle) -> Result<(), String> {
    refresh_desktop_overlays_for_app(app)
}

pub fn pin_all_desktop_overlays(app: &AppHandle) -> Result<(), String> {
    pin_desktop_overlays_zorder(app)
}

async fn prepare_monitor_windows(app: &AppHandle) -> Result<(), String> {
    sync_monitor_windows_impl(app.clone()).await
}

pub async fn enable_desktop_mode_impl(app: &AppHandle, state: &DesktopModeState) -> Result<(), String> {
    if is_desktop_mode_active(state) {
        let _ = refresh_all_desktop_overlays(app);
        return Ok(());
    }

    apply_autostart(app, true)?;
    prepare_monitor_windows(app).await?;

    for window in launcher_windows(app) {
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
        window
            .show()
            .map_err(|e| format!("No se pudo mostrar la ventana: {e}"))?;
        embed_as_desktop(&window, state)?;
    }

    hide_desktop_icons()?;
    refresh_all_desktop_overlays(app)?;

    if let Some(main) = app.get_webview_window(crate::monitor_windows::MAIN_WINDOW_LABEL) {
        main.set_focus()
            .map_err(|e| format!("No se pudo enfocar la ventana: {e}"))?;
    }

    if let Ok(mut active) = state.active.lock() {
        *active = true;
    }

    start_desktop_overlay_watcher(app.clone());
    Ok(())
}

pub async fn disable_desktop_mode_impl(app: &AppHandle, state: &DesktopModeState) -> Result<(), String> {
    if !is_desktop_mode_active(state) {
        return Ok(());
    }

    stop_desktop_overlay_watcher();

    if let Ok(mut active) = state.active.lock() {
        *active = false;
    }

    for window in launcher_windows(app) {
        detach_from_desktop(&window, state)?;
    }

    show_desktop_icons()?;

    let monitors = ordered_monitors(app)?;
    for (index, window) in launcher_windows(app).into_iter().enumerate() {
        window
            .set_fullscreen(false)
            .map_err(|e| format!("No se pudo desactivar pantalla completa: {e}"))?;

        let skip_taskbar = window.label() != crate::monitor_windows::MAIN_WINDOW_LABEL;
        window
            .set_skip_taskbar(skip_taskbar)
            .map_err(|e| format!("No se pudo restaurar la barra de tareas: {e}"))?;

        let monitor = monitors.get(index).unwrap_or(&monitors[0]);
        crate::monitor_windows::place_window_on_monitor(&window, monitor)?;
        window
            .maximize()
            .map_err(|e| format!("No se pudo maximizar la ventana: {e}"))?;
        window
            .show()
            .map_err(|e| format!("No se pudo mostrar la ventana: {e}"))?;
    }

    Ok(())
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

pub async fn restore_windows_desktop(app: &AppHandle, state: &DesktopModeState) -> Result<(), String> {
    disable_desktop_mode_impl(app, state).await
}

pub fn detach_before_exit(app: &AppHandle, state: &DesktopModeState) {
    if is_desktop_mode_active(state) {
        if let Ok(mut guard) = state.active.lock() {
            *guard = false;
        }
        for window in launcher_windows(app) {
            let _ = detach_from_desktop(&window, state);
        }
        let _ = show_desktop_icons();
    }
}
