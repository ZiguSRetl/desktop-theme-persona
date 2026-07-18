use std::sync::Mutex;

use tauri::{AppHandle, WebviewWindow};

pub struct DesktopModeState {
    pub active: Mutex<bool>,
}

impl Default for DesktopModeState {
    fn default() -> Self {
        Self {
            active: Mutex::new(false),
        }
    }
}

pub fn hide_desktop_icons() -> Result<(), String> {
    Err("El modo escritorio solo está disponible en Windows.".into())
}

pub fn show_desktop_icons() -> Result<(), String> {
    Ok(())
}

pub fn embed_as_desktop(_window: &WebviewWindow, _state: &DesktopModeState) -> Result<(), String> {
    Err("El modo escritorio solo está disponible en Windows.".into())
}

pub fn detach_from_desktop(
    _window: &WebviewWindow,
    _state: &DesktopModeState,
) -> Result<(), String> {
    Ok(())
}

pub fn refresh_desktop_overlay(
    _window: &WebviewWindow,
    _x: i32,
    _y: i32,
    _width: i32,
    _height: i32,
) -> Result<(), String> {
    Ok(())
}

pub fn refresh_desktop_overlays_for_app(_app: &AppHandle) -> Result<(), String> {
    Ok(())
}

pub fn snap_desktop_overlays_if_drifted(_app: &AppHandle) -> Result<(), String> {
    Ok(())
}

pub fn pin_desktop_overlays_zorder(_app: &AppHandle) -> Result<(), String> {
    Ok(())
}

pub fn start_desktop_overlay_watcher(app: AppHandle) {
    crate::monitor_windows::start_monitor_layout_watcher(app);
}

pub fn stop_desktop_overlay_watcher() {}
