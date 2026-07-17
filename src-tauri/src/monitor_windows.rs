use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{
    AppHandle, Manager, Monitor, PhysicalPosition, PhysicalSize, Position, Size, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder,
};

pub const MAIN_WINDOW_LABEL: &str = "main";
pub const SATELLITE_PREFIX: &str = "monitor-";

static WATCHER_RUNNING: AtomicBool = AtomicBool::new(false);
static SYNC_IN_FLIGHT: AtomicBool = AtomicBool::new(false);

pub struct MonitorWindowsState {
    pub satellite_labels: Mutex<Vec<String>>,
}

impl Default for MonitorWindowsState {
    fn default() -> Self {
        Self {
            satellite_labels: Mutex::new(Vec::new()),
        }
    }
}

pub fn satellite_label(index: usize) -> String {
    format!("{SATELLITE_PREFIX}{index}")
}

pub fn is_launcher_window_label(label: &str) -> bool {
    label == MAIN_WINDOW_LABEL || label.starts_with(SATELLITE_PREFIX)
}

pub fn ordered_monitors(app: &AppHandle) -> Result<Vec<Monitor>, String> {
    let mut monitors = app
        .available_monitors()
        .map_err(|e| format!("No se pudieron enumerar los monitores: {e}"))?;

    if monitors.is_empty() {
        return Err("No se encontró ningún monitor.".into());
    }

    let primary = app
        .primary_monitor()
        .map_err(|e| format!("No se pudo obtener el monitor primario: {e}"))?;

    // Stable order: primary first, then left-to-right / top-to-bottom.
    // Unstable EnumDisplay order was flipping the signature every poll and
    // re-running sync → visible flicker.
    monitors.sort_by(|a, b| {
        let ap = a.position();
        let bp = b.position();
        ap.x.cmp(&bp.x).then(ap.y.cmp(&bp.y))
    });

    if let Some(primary) = primary {
        if let Some(index) = monitors.iter().position(|monitor| same_monitor(monitor, &primary)) {
            let primary_monitor = monitors.remove(index);
            monitors.insert(0, primary_monitor);
        }
    }

    Ok(monitors)
}

fn same_monitor(a: &Monitor, b: &Monitor) -> bool {
    a.position() == b.position() && a.size() == b.size()
}

fn monitor_signature(monitors: &[Monitor]) -> String {
    monitors
        .iter()
        .map(|monitor| {
            let pos = monitor.position();
            let size = monitor.size();
            format!("{}:{}:{}x{}", pos.x, pos.y, size.width, size.height)
        })
        .collect::<Vec<_>>()
        .join("|")
}

pub fn launcher_windows(app: &AppHandle) -> Vec<WebviewWindow> {
    let mut windows = Vec::new();
    if let Some(main) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        windows.push(main);
    }

    let mut satellites: Vec<_> = app
        .webview_windows()
        .into_iter()
        .filter(|(label, _)| label.starts_with(SATELLITE_PREFIX))
        .collect();
    satellites.sort_by(|(a, _), (b, _)| a.cmp(b));
    windows.extend(satellites.into_iter().map(|(_, window)| window));
    windows
}

fn window_matches_monitor(window: &WebviewWindow, monitor: &Monitor) -> bool {
    let Ok(pos) = window.outer_position() else {
        return false;
    };
    let Ok(size) = window.outer_size() else {
        return false;
    };
    let mpos = monitor.position();
    let msize = monitor.size();
    // Tolerate 2px DPI/rounding drift.
    (pos.x - mpos.x).abs() <= 2
        && (pos.y - mpos.y).abs() <= 2
        && (size.width as i32 - msize.width as i32).abs() <= 2
        && (size.height as i32 - msize.height as i32).abs() <= 2
}

pub fn place_window_on_monitor(window: &WebviewWindow, monitor: &Monitor) -> Result<(), String> {
    if window_matches_monitor(window, monitor) {
        return Ok(());
    }

    let pos = monitor.position();
    let size = monitor.size();

    window
        .set_position(Position::Physical(PhysicalPosition::new(pos.x, pos.y)))
        .map_err(|e| format!("No se pudo posicionar la ventana: {e}"))?;
    window
        .set_size(Size::Physical(PhysicalSize::new(size.width, size.height)))
        .map_err(|e| format!("No se pudo redimensionar la ventana: {e}"))?;
    Ok(())
}

fn create_satellite(
    app: &AppHandle,
    label: &str,
    monitor: &Monitor,
) -> Result<WebviewWindow, String> {
    let pos = monitor.position();
    let size = monitor.size();

    let window = WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title("Persona5 Explorer")
        .decorations(false)
        .skip_taskbar(true)
        .visible(true)
        .focused(false)
        .inner_size(size.width as f64, size.height as f64)
        .position(pos.x as f64, pos.y as f64)
        .build()
        .map_err(|e| format!("No se pudo crear la ventana {label}: {e}"))?;

    place_window_on_monitor(&window, monitor)?;
    Ok(window)
}

fn attach_close_handler(app: &AppHandle, window: &WebviewWindow) {
    crate::system::attach_launcher_window_events(app, window);
}

fn desktop_mode_active(app: &AppHandle) -> bool {
    let state = app.state::<crate::DesktopModeState>();
    state
        .active
        .lock()
        .map(|value| *value)
        .unwrap_or(false)
}

pub async fn sync_monitor_windows_impl(app: AppHandle) -> Result<(), String> {
    if SYNC_IN_FLIGHT.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    let _guard = SyncGuard;

    let monitors = ordered_monitors(&app)?;
    let state = app.state::<MonitorWindowsState>();
    let desktop_active = desktop_mode_active(&app);

    let main = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "No se encontró la ventana principal.".to_string())?;

    // In desktop mode the Win32 overlay owns geometry; Tauri set_position fights it.
    if !desktop_active {
        place_window_on_monitor(&main, &monitors[0])?;
    }

    let mut next_labels = Vec::new();
    for index in 1..monitors.len() {
        let label = satellite_label(index);
        let monitor = &monitors[index];

        if let Some(existing) = app.get_webview_window(&label) {
            if !desktop_active {
                place_window_on_monitor(&existing, monitor)?;
            }
        } else {
            let window = create_satellite(&app, &label, monitor)?;
            attach_close_handler(&app, &window);
            if desktop_active {
                // New satellite during desktop mode: pin as overlay once.
                let _ = crate::desktop_mode::refresh_all_desktop_overlays(&app);
            }
        }

        next_labels.push(label);
    }

    let stale: Vec<String> = {
        let current = state
            .satellite_labels
            .lock()
            .map_err(|_| "Estado de monitores bloqueado.".to_string())?;
        app.webview_windows()
            .into_keys()
            .filter(|label| {
                label.starts_with(SATELLITE_PREFIX)
                    && !next_labels.iter().any(|keep| keep == label)
            })
            .chain(
                current
                    .iter()
                    .filter(|label| !next_labels.iter().any(|keep| keep == *label))
                    .cloned(),
            )
            .collect()
    };

    for label in stale {
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.close();
        }
    }

    if let Ok(mut labels) = state.satellite_labels.lock() {
        *labels = next_labels;
    }

    Ok(())
}

struct SyncGuard;

impl Drop for SyncGuard {
    fn drop(&mut self) {
        SYNC_IN_FLIGHT.store(false, Ordering::SeqCst);
    }
}

#[tauri::command]
pub async fn sync_monitor_windows(app: AppHandle) -> Result<(), String> {
    sync_monitor_windows_impl(app).await
}

pub fn start_monitor_layout_watcher(app: AppHandle) {
    if WATCHER_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }

    std::thread::spawn(move || {
        let mut last_signature = String::new();
        while WATCHER_RUNNING.load(Ordering::SeqCst) {
            let signature = ordered_monitors(&app)
                .map(|monitors| monitor_signature(&monitors))
                .unwrap_or_default();

            if !signature.is_empty() && signature != last_signature {
                let changed = !last_signature.is_empty();
                last_signature = signature;
                if changed {
                    let handle = app.clone();
                    let desktop_active = desktop_mode_active(&handle);

                    let sync_result =
                        tauri::async_runtime::block_on(sync_monitor_windows_impl(handle.clone()));
                    if sync_result.is_ok() && desktop_active {
                        let _ = crate::desktop_mode::refresh_all_desktop_overlays(&handle);
                    }
                }
            }

            std::thread::sleep(Duration::from_secs(2));
        }
    });
}

pub fn stop_monitor_layout_watcher() {
    WATCHER_RUNNING.store(false, Ordering::SeqCst);
}

pub fn show_all_launcher_windows(app: &AppHandle) -> Result<(), String> {
    for window in launcher_windows(app) {
        window
            .show()
            .map_err(|e| format!("No se pudo mostrar la ventana: {e}"))?;
    }
    if let Some(main) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        main.set_focus()
            .map_err(|e| format!("No se pudo enfocar la ventana: {e}"))?;
    }
    Ok(())
}

pub fn hide_all_launcher_windows(app: &AppHandle) -> Result<(), String> {
    for window in launcher_windows(app) {
        window
            .hide()
            .map_err(|e| format!("No se pudo ocultar la ventana: {e}"))?;
    }
    Ok(())
}

pub fn any_launcher_window_visible(app: &AppHandle) -> Result<bool, String> {
    for window in launcher_windows(app) {
        if window
            .is_visible()
            .map_err(|e| format!("No se pudo comprobar visibilidad: {e}"))?
        {
            return Ok(true);
        }
    }
    Ok(false)
}
