use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, WebviewWindow};
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::Input::KeyboardAndMouse::EnableWindow;
use windows::Win32::UI::Shell::{SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNF_IDLIST};
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, HWND_BOTTOM, SWP_NOACTIVATE,
    SWP_NOMOVE, SWP_NOSIZE, WS_EX_APPWINDOW, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
};
use winreg::enums::*;
use winreg::RegKey;

use crate::monitor_windows::ordered_monitors;

const HIDE_ICONS_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced";

static PIN_DEBOUNCE: Mutex<Option<Instant>> = Mutex::new(None);
static PIN_IN_FLIGHT: AtomicBool = AtomicBool::new(false);

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

fn window_hwnd(window: &WebviewWindow) -> Result<HWND, String> {
    window
        .hwnd()
        .map_err(|e| format!("No se pudo obtener el handle de ventana: {e}"))
}

fn configure_overlay_window(hwnd: HWND) {
    unsafe {
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let next_style = (ex_style | WS_EX_TOOLWINDOW.0) & !WS_EX_APPWINDOW.0 & !WS_EX_NOACTIVATE.0;
        if next_style != ex_style {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, next_style as _);
        }

        let _ = EnableWindow(hwnd, true);
    }
}

fn position_hwnd_as_desktop_overlay(hwnd: HWND, x: i32, y: i32, width: i32, height: i32) {
    unsafe {
        let _ = SetWindowPos(
            hwnd,
            Some(HWND_BOTTOM),
            x,
            y,
            width,
            height,
            // No SHOWWINDOW: avoids focus/activation churn that flickered multi-monitor overlays.
            SWP_NOACTIVATE,
        );
    }
}

fn pin_hwnd_zorder(hwnd: HWND) {
    unsafe {
        let _ = SetWindowPos(
            hwnd,
            Some(HWND_BOTTOM),
            0,
            0,
            0,
            0,
            SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE,
        );
    }
}

pub fn position_window_as_desktop_overlay(
    window: &WebviewWindow,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<(), String> {
    let hwnd = window_hwnd(window)?;
    position_hwnd_as_desktop_overlay(hwnd, x, y, width, height);
    Ok(())
}

fn set_registry_hide_icons(hide: bool) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu
        .create_subkey(HIDE_ICONS_KEY)
        .map_err(|e| format!("No se pudo abrir el registro: {e}"))?;

    let value: u32 = if hide { 1 } else { 0 };
    key.set_value("HideIcons", &value)
        .map_err(|e| format!("No se pudo escribir HideIcons: {e}"))?;

    refresh_shell();
    Ok(())
}

fn refresh_shell() {
    unsafe {
        let _ = SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None);
    }
}

pub fn hide_desktop_icons() -> Result<(), String> {
    set_registry_hide_icons(true)
}

pub fn show_desktop_icons() -> Result<(), String> {
    set_registry_hide_icons(false)
}

pub fn embed_as_desktop(window: &WebviewWindow, _state: &DesktopModeState) -> Result<(), String> {
    let hwnd = window_hwnd(window)?;

    unsafe {
        use windows::Win32::UI::WindowsAndMessaging::SetParent;
        let _ = SetParent(hwnd, None);
    }

    configure_overlay_window(hwnd);
    Ok(())
}

pub fn detach_from_desktop(
    window: &WebviewWindow,
    _state: &DesktopModeState,
) -> Result<(), String> {
    let hwnd = window_hwnd(window)?;

    unsafe {
        use windows::Win32::UI::WindowsAndMessaging::{SetParent, HWND_NOTOPMOST};
        let _ = SetParent(hwnd, None);

        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let next_style = ex_style & !WS_EX_TOOLWINDOW.0;
        if next_style != ex_style {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, next_style as _);
        }

        let _ = SetWindowPos(
            hwnd,
            Some(HWND_NOTOPMOST),
            0,
            0,
            0,
            0,
            SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE,
        );
    }

    Ok(())
}

pub fn refresh_desktop_overlay(
    window: &WebviewWindow,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<(), String> {
    position_window_as_desktop_overlay(window, x, y, width, height)
}

/// Full geometry + z-order apply (layout changes / enabling desktop mode).
pub fn refresh_desktop_overlays_for_app(app: &AppHandle) -> Result<(), String> {
    let monitors = ordered_monitors(app)?;
    let windows = crate::monitor_windows::launcher_windows(app);

    for (index, window) in windows.iter().enumerate() {
        let monitor = monitors.get(index).unwrap_or(&monitors[0]);
        let pos = monitor.position();
        let size = monitor.size();
        embed_as_desktop(window, &DesktopModeState::default())?;
        refresh_desktop_overlay(window, pos.x, pos.y, size.width as i32, size.height as i32)?;
    }

    Ok(())
}

/// Lightweight z-order pin used on blur — must NOT show/move/resize or focus fights start.
pub fn pin_desktop_overlays_zorder(app: &AppHandle) -> Result<(), String> {
    if PIN_IN_FLIGHT.swap(true, Ordering::SeqCst) {
        return Ok(());
    }

    {
        let mut last = PIN_DEBOUNCE
            .lock()
            .map_err(|_| "Debounce de overlay bloqueado.".to_string())?;
        if let Some(prev) = *last {
            if prev.elapsed() < Duration::from_millis(400) {
                PIN_IN_FLIGHT.store(false, Ordering::SeqCst);
                return Ok(());
            }
        }
        *last = Some(Instant::now());
    }

    for window in crate::monitor_windows::launcher_windows(app) {
        if let Ok(hwnd) = window_hwnd(&window) {
            pin_hwnd_zorder(hwnd);
        }
    }

    PIN_IN_FLIGHT.store(false, Ordering::SeqCst);
    Ok(())
}

pub fn start_desktop_overlay_watcher(app: AppHandle) {
    crate::monitor_windows::start_monitor_layout_watcher(app);
}

pub fn stop_desktop_overlay_watcher() {
    // Layout watcher stays alive for multi-monitor sync outside desktop mode.
}
