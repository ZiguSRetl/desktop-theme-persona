use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Output;
use std::thread;
use std::time::{Duration, Instant};
use sysinfo::System;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub const CLEAN_WORKER_FLAG: &str = "--p5-clean-worker";
pub const CLEAN_OUTPUT_PREFIX: &str = "--p5-clean-output=";

pub const TARGET_PROCESSES: &[&str] = &[
    "chrome.exe",
    "msedge.exe",
    "firefox.exe",
    "discord.exe",
    "steam.exe",
    "EpicGamesLauncher.exe",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanMetricsSnapshot {
    pub memory_used_bytes: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vram_used_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanStepResult {
    pub id: String,
    pub label: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanScriptResult {
    pub steps: Vec<CleanStepResult>,
    pub closed_apps: Vec<String>,
    pub before: CleanMetricsSnapshot,
    pub after: CleanMetricsSnapshot,
}

fn run_hidden_command(program: &str, args: &[&str]) -> Option<Output> {
    let mut cmd = std::process::Command::new(program);
    cmd.args(args);
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.output().ok()
}

fn step(id: &str, label: &str, status: &str, detail: Option<String>) -> CleanStepResult {
    CleanStepResult {
        id: id.to_string(),
        label: label.to_string(),
        status: status.to_string(),
        detail,
    }
}

fn read_memory_used_bytes() -> u64 {
    let mut system = System::new();
    system.refresh_memory();
    system.used_memory()
}

fn parse_f32_field(raw: &str) -> Option<f32> {
    let trimmed = raw.trim().trim_matches(|c: char| c == '[' || c == ']');
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("N/A") {
        return None;
    }
    trimmed.parse::<f32>().ok()
}

fn parse_u64_mib_to_bytes(raw: &str) -> Option<u64> {
    let mib = parse_f32_field(raw)?;
    if !mib.is_finite() || mib < 0.0 {
        return None;
    }
    Some((mib as u64).saturating_mul(1024 * 1024))
}

fn read_vram_used_bytes() -> Option<u64> {
    let output = run_hidden_command(
        "nvidia-smi",
        &["--query-gpu=memory.used", "--format=csv,noheader,nounits"],
    )?;
    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let first_line = stdout.lines().next()?.trim();
    parse_u64_mib_to_bytes(first_line)
}

fn snapshot_metrics() -> CleanMetricsSnapshot {
    CleanMetricsSnapshot {
        memory_used_bytes: read_memory_used_bytes(),
        vram_used_bytes: read_vram_used_bytes(),
    }
}

fn set_high_performance_power_plan() -> Result<(), String> {
    if let Some(output) = run_hidden_command("powercfg", &["/setactive", "SCHEME_MIN"]) {
        if output.status.success() {
            return Ok(());
        }
    }

    let fallback_guid = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";
    let output = run_hidden_command("powercfg", &["/setactive", fallback_guid])
        .ok_or_else(|| "No se pudo cambiar el plan de energía.".to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err("No se pudo activar el plan Alto rendimiento.".into())
    }
}

pub fn is_target_process(name: &str) -> bool {
    TARGET_PROCESSES
        .iter()
        .any(|target| target.eq_ignore_ascii_case(name.trim()))
}

fn process_is_running(name: &str) -> bool {
    run_hidden_command("tasklist", &["/FI", &format!("IMAGENAME eq {name}")])
        .map(|output| {
            let text = String::from_utf8_lossy(&output.stdout);
            text.lines().any(|line| {
                line.to_ascii_lowercase()
                    .contains(&name.to_ascii_lowercase())
            })
        })
        .unwrap_or(false)
}

fn try_close_process(name: &str) -> bool {
    if !process_is_running(name) {
        return false;
    }

    let _ = run_hidden_command("taskkill", &["/IM", name]);
    thread::sleep(Duration::from_secs(3));

    if process_is_running(name) {
        let _ = run_hidden_command("taskkill", &["/F", "/IM", name]);
        thread::sleep(Duration::from_millis(500));
    }

    !process_is_running(name)
}

fn close_target_apps() -> Vec<String> {
    let mut closed = Vec::new();
    for name in TARGET_PROCESSES {
        if try_close_process(name) {
            closed.push((*name).to_string());
        }
    }
    closed
}

#[cfg(windows)]
fn purge_standby_list() -> Result<(), String> {
    const SYSTEM_MEMORY_LIST_INFORMATION: u32 = 80;
    const MEMORY_PURGE_STANDBY_LIST: i32 = 4;

    #[link(name = "ntdll")]
    extern "system" {
        fn NtSetSystemInformation(class: u32, info: *mut std::ffi::c_void, length: u32) -> i32;
    }

    let mut command = MEMORY_PURGE_STANDBY_LIST;
    let status = unsafe {
        NtSetSystemInformation(
            SYSTEM_MEMORY_LIST_INFORMATION,
            &mut command as *mut _ as *mut _,
            std::mem::size_of::<i32>() as u32,
        )
    };

    if status == 0 {
        Ok(())
    } else {
        Err(format!(
            "No se pudo purgar la RAM standby (código 0x{:08X}).",
            status as u32
        ))
    }
}

#[cfg(not(windows))]
fn purge_standby_list() -> Result<(), String> {
    Err("Solo disponible en Windows.".into())
}

pub fn cache_directory_candidates() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(temp) = std::env::var_os("TEMP") {
        dirs.push(PathBuf::from(temp));
    }
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        let local = PathBuf::from(local);
        dirs.push(local.join("Temp"));
        dirs.push(local.join("D3DSCache"));
        dirs.push(local.join("NVIDIA").join("DXCache"));
        dirs.push(local.join("AMD").join("DxCache"));
    }
    dirs
}

fn allowed_cache_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    for key in ["TEMP", "LOCALAPPDATA", "TMP"] {
        if let Ok(value) = std::env::var(key) {
            let path = PathBuf::from(value);
            if path.exists() {
                roots.push(path);
            }
        }
    }
    roots
}

pub fn is_safe_cache_path(path: &Path, roots: &[PathBuf]) -> bool {
    if roots.is_empty() {
        return false;
    }

    let canonical = match path.canonicalize() {
        Ok(value) => value,
        Err(_) => return false,
    };

    roots.iter().any(|root| {
        root.canonicalize()
            .map(|root_canonical| canonical.starts_with(&root_canonical))
            .unwrap_or(false)
    })
}

fn dir_size_bytes(path: &Path) -> u64 {
    let mut total = 0u64;
    let Ok(read_dir) = fs::read_dir(path) else {
        return 0;
    };

    for entry in read_dir.flatten() {
        let entry_path = entry.path();
        if entry_path.is_dir() {
            total = total.saturating_add(dir_size_bytes(&entry_path));
        } else if let Ok(meta) = entry.metadata() {
            total = total.saturating_add(meta.len());
        }
    }
    total
}

fn clear_dir_contents(path: &Path, roots: &[PathBuf]) -> Result<u64, String> {
    if !path.exists() {
        return Ok(0);
    }
    if !is_safe_cache_path(path, roots) {
        return Err(format!("Ruta de caché no permitida: {}", path.display()));
    }

    let freed = dir_size_bytes(path);
    let entries =
        fs::read_dir(path).map_err(|e| format!("No se pudo leer {}: {e}", path.display()))?;

    for entry in entries.flatten() {
        let entry_path = entry.path();
        if entry_path.is_dir() {
            let _ = fs::remove_dir_all(&entry_path);
        } else {
            let _ = fs::remove_file(&entry_path);
        }
    }

    Ok(freed)
}

fn clear_cache_directories() -> Result<u64, String> {
    let roots = allowed_cache_roots();
    let mut total_freed = 0u64;
    let mut errors = Vec::new();

    for dir in cache_directory_candidates() {
        match clear_dir_contents(&dir, &roots) {
            Ok(freed) => total_freed = total_freed.saturating_add(freed),
            Err(error) => errors.push(error),
        }
    }

    if total_freed > 0 {
        Ok(total_freed)
    } else if errors.is_empty() {
        Ok(0)
    } else {
        Err(errors.join(" "))
    }
}

fn format_bytes_short(bytes: u64) -> String {
    const MIB: u64 = 1024 * 1024;
    const GIB: u64 = 1024 * 1024 * 1024;
    if bytes >= GIB {
        format!("{:.1} GB", bytes as f64 / GIB as f64)
    } else if bytes >= MIB {
        format!("{:.0} MB", bytes as f64 / MIB as f64)
    } else {
        format!("{bytes} B")
    }
}

fn reset_nvidia_gpu() -> Result<(), String> {
    let output = run_hidden_command("nvidia-smi", &["--gpu-reset"])
        .ok_or_else(|| "nvidia-smi no está disponible.".to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            Err("No se pudo resetear la GPU NVIDIA.".into())
        } else {
            Err(stderr)
        }
    }
}

pub fn perform_clean() -> CleanScriptResult {
    let mut steps = Vec::new();
    let before = snapshot_metrics();

    match set_high_performance_power_plan() {
        Ok(()) => steps.push(step(
            "power-plan",
            "Plan de energía Alto rendimiento",
            "ok",
            None,
        )),
        Err(error) => steps.push(step(
            "power-plan",
            "Plan de energía Alto rendimiento",
            "failed",
            Some(error),
        )),
    }

    let closed_apps = close_target_apps();
    steps.push(step(
        "close-apps",
        "Cerrar apps en segundo plano",
        if closed_apps.is_empty() {
            "skipped"
        } else {
            "ok"
        },
        Some(if closed_apps.is_empty() {
            "Ninguna app objetivo estaba en ejecución.".into()
        } else {
            format!("Cerradas: {}", closed_apps.join(", "))
        }),
    ));

    match purge_standby_list() {
        Ok(()) => steps.push(step(
            "purge-standby",
            "Purgar RAM en caché (standby)",
            "ok",
            None,
        )),
        Err(error) => steps.push(step(
            "purge-standby",
            "Purgar RAM en caché (standby)",
            "failed",
            Some(error),
        )),
    }

    match clear_cache_directories() {
        Ok(freed) => steps.push(step(
            "clear-cache",
            "Limpiar cachés temporales y de shaders",
            "ok",
            Some(format!("Liberados {} en disco.", format_bytes_short(freed))),
        )),
        Err(error) => steps.push(step(
            "clear-cache",
            "Limpiar cachés temporales y de shaders",
            "failed",
            Some(error),
        )),
    }

    match reset_nvidia_gpu() {
        Ok(()) => steps.push(step("gpu-reset", "Resetear GPU NVIDIA", "ok", None)),
        Err(error) => steps.push(step(
            "gpu-reset",
            "Resetear GPU NVIDIA",
            "skipped",
            Some(error),
        )),
    }

    let after = snapshot_metrics();

    CleanScriptResult {
        steps,
        closed_apps,
        before,
        after,
    }
}

#[cfg(windows)]
fn is_elevated() -> bool {
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::Security::{
        GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
    };
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    unsafe {
        let mut token = HANDLE::default();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
            return false;
        }

        let mut elevation = TOKEN_ELEVATION::default();
        let mut return_length = 0u32;
        let ok = GetTokenInformation(
            token,
            TokenElevation,
            Some(&mut elevation as *mut _ as *mut _),
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut return_length,
        )
        .is_ok();
        let _ = CloseHandle(token);
        ok && elevation.TokenIsElevated != 0
    }
}

#[cfg(windows)]
fn run_elevated_worker(exe: &Path, output_path: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::WAIT_TIMEOUT;
    use windows::Win32::System::Threading::WaitForSingleObject;
    use windows::Win32::UI::Shell::{ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW};
    use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;
    use windows_core::w;

    let parameters = format!(
        "{CLEAN_WORKER_FLAG} {CLEAN_OUTPUT_PREFIX}\"{}\"",
        output_path.display()
    );

    let exe_wide: Vec<u16> = exe.as_os_str().encode_wide().chain([0]).collect();
    let params_wide: Vec<u16> = parameters.encode_utf16().chain([0]).collect();

    let mut info = SHELLEXECUTEINFOW::default();
    info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
    info.fMask = SEE_MASK_NOCLOSEPROCESS;
    info.lpVerb = w!("runas");
    info.lpFile = PCWSTR(exe_wide.as_ptr());
    info.lpParameters = PCWSTR(params_wide.as_ptr());
    info.nShow = SW_HIDE.0 as i32;

    unsafe {
        ShellExecuteExW(&mut info)
            .map_err(|_| "Se canceló la elevación de permisos.".to_string())?;
        if info.hProcess.0.is_null() {
            return Err("Se canceló la elevación de permisos.".into());
        }

        let wait = WaitForSingleObject(info.hProcess, 120_000);
        let _ = windows::Win32::Foundation::CloseHandle(info.hProcess);

        if wait == WAIT_TIMEOUT {
            return Err("La limpieza tardó demasiado.".into());
        }
    }

    Ok(())
}

#[cfg(windows)]
fn wait_for_output_file(path: &Path, timeout: Duration) -> Result<(), String> {
    let started = Instant::now();
    while started.elapsed() < timeout {
        if path.exists() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(200));
    }
    Err("No se recibió el resultado de la limpieza.".into())
}

pub fn run_clean_worker_to_file(output_path: &Path) -> Result<(), String> {
    let result = perform_clean();
    let json = serde_json::to_string(&result)
        .map_err(|e| format!("No se pudo serializar el resultado: {e}"))?;
    fs::write(output_path, json).map_err(|e| format!("No se pudo escribir el resultado: {e}"))
}

#[tauri::command]
pub fn run_clean_script() -> Result<CleanScriptResult, String> {
    #[cfg(not(windows))]
    {
        return Err("Clean solo está disponible en Windows.".into());
    }

    #[cfg(windows)]
    {
        if is_elevated() {
            return Ok(perform_clean());
        }

        let output_path =
            std::env::temp_dir().join(format!("p5-clean-{}.json", system_time_now_millis()));
        let _ = fs::remove_file(&output_path);

        let exe = std::env::current_exe()
            .map_err(|e| format!("No se pudo obtener la ruta del ejecutable: {e}"))?;

        run_elevated_worker(&exe, &output_path)?;
        wait_for_output_file(&output_path, Duration::from_secs(120))?;

        let contents = fs::read_to_string(&output_path)
            .map_err(|e| format!("No se pudo leer el resultado: {e}"))?;
        let _ = fs::remove_file(&output_path);

        serde_json::from_str(&contents).map_err(|e| format!("Resultado de limpieza inválido: {e}"))
    }
}

fn system_time_now_millis() -> u128 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn target_process_matching_is_case_insensitive() {
        assert!(is_target_process("chrome.exe"));
        assert!(is_target_process("CHROME.EXE"));
        assert!(!is_target_process("notepad.exe"));
    }

    #[test]
    fn cache_candidates_include_expected_paths() {
        let dirs = cache_directory_candidates();
        #[cfg(windows)]
        assert!(!dirs.is_empty());
        #[cfg(not(windows))]
        {
            // Windows TEMP/LOCALAPPDATA paths — empty on Linux hosts.
            let _ = dirs;
        }
    }

    #[test]
    fn rejects_paths_outside_allowed_roots() {
        let roots = vec![PathBuf::from("C:\\Users\\test\\AppData\\Local")];
        assert!(!is_safe_cache_path(
            Path::new("C:\\Windows\\System32"),
            &roots
        ));
    }
}
