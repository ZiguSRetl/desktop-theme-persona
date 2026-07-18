use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, WebviewWindow};
use windows::core::w;
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::Input::KeyboardAndMouse::EnableWindow;
use windows::Win32::UI::Shell::{SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNF_IDLIST};
use windows::Win32::UI::WindowsAndMessaging::{
    CallWindowProcW, DefWindowProcW, EnumWindows, FindWindowExW, FindWindowW, GetWindowLongPtrW,
    SendMessageTimeoutW, SetWindowLongPtrW, SetWindowPos, GWLP_WNDPROC, GWL_EXSTYLE, GWL_STYLE,
    HWND_BOTTOM, SMTO_NORMAL, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WINDOWPOS,
    WM_WINDOWPOSCHANGING, WNDPROC, WS_EX_APPWINDOW, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    WS_MAXIMIZEBOX, WS_THICKFRAME,
};
use windows_core::BOOL;
use winreg::enums::*;
use winreg::RegKey;

use crate::monitor_windows::ordered_monitors;

const HIDE_ICONS_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced";
/// Progman message that spawns the wallpaper WorkerW (behind desktop icons).
const PROGMAN_SPAWN_WORKERW: u32 = 0x052C;

static PIN_DEBOUNCE: Mutex<Option<Instant>> = Mutex::new(None);
static PIN_IN_FLIGHT: AtomicBool = AtomicBool::new(false);
static SNAP_DEBOUNCE: Mutex<Option<Instant>> = Mutex::new(None);
/// When true, WM_WINDOWPOSCHANGING allows our intentional SetWindowPos geometry.
static ALLOW_GEOMETRY_CHANGE: AtomicBool = AtomicBool::new(false);
static LOCKED_GEOMETRY: Mutex<Option<HashMap<isize, (i32, i32, i32, i32)>>> = Mutex::new(None);
static SUBCLASSED_PROCS: Mutex<Option<HashMap<isize, isize>>> = Mutex::new(None);

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

fn hwnd_key(hwnd: HWND) -> isize {
    hwnd.0 as isize
}

fn is_null_hwnd(hwnd: HWND) -> bool {
    hwnd.0.is_null()
}

/// Find the WorkerW that sits behind desktop icons (Wallpaper Engine layer).
fn find_wallpaper_workerw() -> Option<HWND> {
    unsafe {
        let progman = FindWindowW(w!("Progman"), None).ok()?;
        if is_null_hwnd(progman) {
            return None;
        }

        let mut result = 0usize;
        let _ = SendMessageTimeoutW(
            progman,
            PROGMAN_SPAWN_WORKERW,
            WPARAM(0),
            LPARAM(0),
            SMTO_NORMAL,
            1000,
            Some(&mut result),
        );

        let mut worker = HWND::default();
        let _ = EnumWindows(
            Some(enum_find_workerw),
            LPARAM(std::ptr::addr_of_mut!(worker) as isize),
        );
        if is_null_hwnd(worker) {
            None
        } else {
            Some(worker)
        }
    }
}

unsafe extern "system" fn enum_find_workerw(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let shell = FindWindowExW(Some(hwnd), None, w!("SHELLDLL_DefView"), None).unwrap_or_default();
    if !is_null_hwnd(shell) {
        // WorkerW after the desktop icons host — wallpaper / Wallpaper Engine layer.
        let worker = FindWindowExW(None, Some(hwnd), w!("WorkerW"), None).unwrap_or_default();
        if !is_null_hwnd(worker) {
            let out = lparam.0 as *mut HWND;
            if !out.is_null() {
                *out = worker;
            }
            return BOOL(0);
        }
    }
    BOOL(1)
}

/// Place shell just above the wallpaper WorkerW (or HWND_BOTTOM as fallback).
fn desktop_zorder_anchor() -> HWND {
    find_wallpaper_workerw().unwrap_or(HWND_BOTTOM)
}

fn configure_overlay_window(hwnd: HWND) {
    unsafe {
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let next_ex = (ex_style | WS_EX_TOOLWINDOW.0) & !WS_EX_APPWINDOW.0 & !WS_EX_NOACTIVATE.0;
        if next_ex != ex_style {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, next_ex as _);
        }

        // Lock geometry: no thick-frame edge resize even if a style races back in.
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
        let next_style = style & !WS_THICKFRAME.0 & !WS_MAXIMIZEBOX.0;
        if next_style != style {
            SetWindowLongPtrW(hwnd, GWL_STYLE, next_style as _);
        }

        let _ = EnableWindow(hwnd, true);
    }
    install_zorder_subclass(hwnd);
}

fn lock_geometry(hwnd: HWND, x: i32, y: i32, width: i32, height: i32) {
    let Ok(mut guard) = LOCKED_GEOMETRY.lock() else {
        return;
    };
    let map = guard.get_or_insert_with(HashMap::new);
    map.insert(hwnd_key(hwnd), (x, y, width, height));
}

fn clear_locked_geometry(hwnd: HWND) {
    if let Ok(mut guard) = LOCKED_GEOMETRY.lock() {
        if let Some(map) = guard.as_mut() {
            map.remove(&hwnd_key(hwnd));
        }
    }
}

struct AllowGeometryGuard;

impl AllowGeometryGuard {
    fn enter() -> Self {
        ALLOW_GEOMETRY_CHANGE.store(true, Ordering::SeqCst);
        Self
    }
}

impl Drop for AllowGeometryGuard {
    fn drop(&mut self) {
        ALLOW_GEOMETRY_CHANGE.store(false, Ordering::SeqCst);
    }
}

unsafe extern "system" fn overlay_wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if msg == WM_WINDOWPOSCHANGING {
        let wp = lparam.0 as *mut WINDOWPOS;
        if !wp.is_null() {
            let flags = (*wp).flags;
            // Only rewrite when Windows is trying to change z-order (e.g. raise on click).
            if (flags & SWP_NOZORDER).0 == 0 {
                (*wp).hwndInsertAfter = desktop_zorder_anchor();
            }

            // Freeze move/resize unless we are applying intentional overlay geometry.
            if !ALLOW_GEOMETRY_CHANGE.load(Ordering::SeqCst) {
                let moving = (flags & SWP_NOMOVE).0 == 0;
                let sizing = (flags & SWP_NOSIZE).0 == 0;
                if moving || sizing {
                    let locked = LOCKED_GEOMETRY
                        .lock()
                        .ok()
                        .and_then(|guard| {
                            guard
                                .as_ref()
                                .and_then(|map| map.get(&hwnd_key(hwnd)).copied())
                        });
                    if let Some((x, y, w, h)) = locked {
                        if moving {
                            (*wp).x = x;
                            (*wp).y = y;
                        }
                        if sizing {
                            (*wp).cx = w;
                            (*wp).cy = h;
                        }
                    } else {
                        (*wp).flags |= SWP_NOMOVE | SWP_NOSIZE;
                    }
                }
            }
        }
    }

    let prev_ptr = SUBCLASSED_PROCS
        .lock()
        .ok()
        .and_then(|guard| guard.as_ref().and_then(|map| map.get(&hwnd_key(hwnd)).copied()));

    if let Some(prev) = prev_ptr {
        if prev != 0 {
            let prev_proc: WNDPROC = std::mem::transmute(prev);
            return CallWindowProcW(prev_proc, hwnd, msg, wparam, lparam);
        }
    }

    DefWindowProcW(hwnd, msg, wparam, lparam)
}

fn install_zorder_subclass(hwnd: HWND) {
    let key = hwnd_key(hwnd);
    let Ok(mut guard) = SUBCLASSED_PROCS.lock() else {
        return;
    };
    let map = guard.get_or_insert_with(HashMap::new);
    if map.contains_key(&key) {
        return;
    }

    unsafe {
        let prev = SetWindowLongPtrW(
            hwnd,
            GWLP_WNDPROC,
            overlay_wnd_proc as *const () as usize as isize,
        );
        if prev == 0 {
            return;
        }
        map.insert(key, prev);
    }
}

fn remove_zorder_subclass(hwnd: HWND) {
    clear_locked_geometry(hwnd);
    let key = hwnd_key(hwnd);
    let Ok(mut guard) = SUBCLASSED_PROCS.lock() else {
        return;
    };
    let Some(map) = guard.as_mut() else {
        return;
    };
    let Some(prev) = map.remove(&key) else {
        return;
    };
    unsafe {
        let _ = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, prev);
    }
}

fn position_hwnd_as_desktop_overlay(hwnd: HWND, x: i32, y: i32, width: i32, height: i32) {
    lock_geometry(hwnd, x, y, width, height);
    let _guard = AllowGeometryGuard::enter();
    unsafe {
        let _ = SetWindowPos(
            hwnd,
            Some(desktop_zorder_anchor()),
            x,
            y,
            width,
            height,
            SWP_NOACTIVATE,
        );
    }
}

fn pin_hwnd_zorder(hwnd: HWND) {
    unsafe {
        let _ = SetWindowPos(
            hwnd,
            Some(desktop_zorder_anchor()),
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
    remove_zorder_subclass(hwnd);

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

/// Work-area geometry + z-order (excludes taskbar/docks).
pub fn refresh_desktop_overlays_for_app(app: &AppHandle) -> Result<(), String> {
    let monitors = ordered_monitors(app)?;
    let windows = crate::monitor_windows::launcher_windows(app);

    for (index, window) in windows.iter().enumerate() {
        let monitor = monitors.get(index).unwrap_or(&monitors[0]);
        let (x, y, width, height) = crate::monitor_windows::monitor_work_geometry(monitor);
        embed_as_desktop(window, &DesktopModeState::default())?;
        refresh_desktop_overlay(window, x, y, width as i32, height as i32)?;
    }

    Ok(())
}

/// Re-apply work-area geometry only when a window has drifted (resize/move races).
pub fn snap_desktop_overlays_if_drifted(app: &AppHandle) -> Result<(), String> {
    {
        let mut last = SNAP_DEBOUNCE
            .lock()
            .map_err(|_| "Debounce de snap bloqueado.".to_string())?;
        if let Some(prev) = *last {
            if prev.elapsed() < Duration::from_millis(80) {
                return Ok(());
            }
        }
        *last = Some(Instant::now());
    }

    let monitors = ordered_monitors(app)?;
    let windows = crate::monitor_windows::launcher_windows(app);
    let mut drifted = false;

    for (index, window) in windows.iter().enumerate() {
        let monitor = monitors.get(index).unwrap_or(&monitors[0]);
        if !crate::monitor_windows::window_matches_work_area(window, monitor) {
            drifted = true;
            break;
        }
    }

    if drifted {
        refresh_desktop_overlays_for_app(app)?;
    } else {
        pin_desktop_overlays_zorder_inner(app, false)?;
    }

    Ok(())
}

fn pin_desktop_overlays_zorder_inner(app: &AppHandle, debounce: bool) -> Result<(), String> {
    if PIN_IN_FLIGHT.swap(true, Ordering::SeqCst) {
        return Ok(());
    }

    if debounce {
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

/// Lightweight z-order pin — must NOT show/move/resize or focus fights start.
pub fn pin_desktop_overlays_zorder(app: &AppHandle) -> Result<(), String> {
    pin_desktop_overlays_zorder_inner(app, true)
}

pub fn start_desktop_overlay_watcher(app: AppHandle) {
    crate::monitor_windows::start_monitor_layout_watcher(app);
}

pub fn stop_desktop_overlay_watcher() {
    // Layout watcher stays alive for multi-monitor sync outside desktop mode.
}
