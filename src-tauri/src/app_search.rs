use serde::Serialize;
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use std::fs;
#[cfg(windows)]
use std::path::{Path, PathBuf};

#[cfg(not(windows))]
#[path = "app_search_linux.rs"]
mod linux;

#[cfg(not(windows))]
pub(crate) fn read_desktop_icon_key(path: &std::path::Path) -> Option<String> {
    linux::read_desktop_icon_key(path)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledAppResult {
    pub name: String,
    pub path: String,
    pub source: String,
}

#[derive(Debug, Clone)]
struct AppEntry {
    name: String,
    path: String,
    source: String,
    sort_key: String,
}

struct IndexState {
    apps: Vec<AppEntry>,
    ready: bool,
}

static INDEX: OnceLock<Mutex<IndexState>> = OnceLock::new();
static BUILDING: AtomicBool = AtomicBool::new(false);

fn index_lock() -> &'static Mutex<IndexState> {
    INDEX.get_or_init(|| {
        Mutex::new(IndexState {
            apps: Vec::new(),
            ready: false,
        })
    })
}

fn sorted_snapshot(entries: &[AppEntry]) -> Vec<AppEntry> {
    let mut snapshot = entries.to_vec();
    snapshot.sort_by(|left, right| left.sort_key.cmp(&right.sort_key));
    snapshot
}

fn publish_snapshot(entries: &[AppEntry], ready: bool) {
    let snapshot = sorted_snapshot(entries);
    if let Ok(mut guard) = index_lock().lock() {
        guard.apps = snapshot;
        guard.ready = ready;
    }
}

fn current_results() -> Vec<InstalledAppResult> {
    index_lock()
        .lock()
        .map(|guard| guard.apps.iter().map(entry_to_result).collect())
        .unwrap_or_default()
}

fn emit_apps_updated(app: &AppHandle, entries: &[AppEntry]) {
    let payload: Vec<InstalledAppResult> = sorted_snapshot(entries)
        .iter()
        .map(entry_to_result)
        .collect();
    let _ = app.emit("installed-apps-updated", payload);
}

fn emit_apps_ready(app: &AppHandle, entries: &[AppEntry]) {
    let payload: Vec<InstalledAppResult> = sorted_snapshot(entries)
        .iter()
        .map(entry_to_result)
        .collect();
    let _ = app.emit("installed-apps-ready", payload);
}

fn normalize_key(value: &str) -> String {
    value.replace('/', "\\").trim().to_lowercase()
}

fn is_braced_guid(value: &str) -> bool {
    // {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}
    if value.len() != 38 || !value.starts_with('{') || !value.ends_with('}') {
        return false;
    }
    let inner = &value[1..37];
    let parts: Vec<&str> = inner.split('-').collect();
    if parts.len() != 5 {
        return false;
    }
    let expected = [8, 4, 4, 4, 12];
    parts.iter().zip(expected).all(|(part, len)| {
        part.len() == len && part.chars().all(|c| c.is_ascii_hexdigit())
    })
}

fn is_unbraced_guid(value: &str) -> bool {
    if value.len() != 36 {
        return false;
    }
    let parts: Vec<&str> = value.split('-').collect();
    if parts.len() != 5 {
        return false;
    }
    let expected = [8, 4, 4, 4, 12];
    parts.iter().zip(expected).all(|(part, len)| {
        part.len() == len && part.chars().all(|c| c.is_ascii_hexdigit())
    })
}

fn is_windows_drive_path(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'\\' || bytes[2] == b'/')
}

/// Protocol / URI targets such as `steam://…`, `uplay:\\…`, `https:\\…`.
/// Requires a slash after the scheme so `shell:AppsFolder\…` is not treated as a URI.
pub fn is_protocol_target(path: &str) -> bool {
    let trimmed = path.trim();
    if trimmed.is_empty() || is_windows_drive_path(trimmed) {
        return false;
    }
    let Some(colon) = trimmed.find(':') else {
        return false;
    };
    // Single-letter schemes are drive letters, not protocols.
    if colon <= 1 {
        return false;
    }
    let scheme = &trimmed[..colon];
    if !scheme.chars().enumerate().all(|(i, c)| {
        if i == 0 {
            c.is_ascii_alphabetic()
        } else {
            c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.')
        }
    }) {
        return false;
    }
    trimmed
        .as_bytes()
        .get(colon + 1)
        .is_some_and(|b| *b == b'/' || *b == b'\\')
}

/// Normalize `steam:\\rungameid\2807960` → `steam://rungameid/2807960`.
pub fn normalize_protocol_target(path: &str) -> Option<String> {
    let trimmed = path.trim();
    if !is_protocol_target(trimmed) {
        return None;
    }
    let Some((scheme, rest)) = trimmed.split_once(':') else {
        return None;
    };
    let rest = rest.trim_start_matches(['\\', '/']);
    let path_part = rest.replace('\\', "/");
    Some(format!("{scheme}://{path_part}"))
}

/// Classic AUMID: `PackageFamilyName!AppId` (no path separators).
pub fn is_bare_aumid(path: &str) -> bool {
    let trimmed = path.trim();
    if trimmed.is_empty() || trimmed.contains(['/', '\\', ':']) {
        return false;
    }
    let Some((left, right)) = trimmed.split_once('!') else {
        return false;
    };
    !left.is_empty() && !right.is_empty() && !right.contains('!')
}

/// e.g. `Microsoft.AutoGenerated.{39F3B85B-63FB-0256-8A0A-AAC177410D28}`
fn is_autogenerated_shell_id(path: &str) -> bool {
    let trimmed = path.trim();
    if trimmed.contains(['/', '\\', ':']) {
        return false;
    }
    let Some(rest) = trimmed
        .strip_prefix("Microsoft.AutoGenerated.")
        .or_else(|| trimmed.strip_prefix("microsoft.autogenerated."))
    else {
        return false;
    };
    is_braced_guid(rest)
}

/// e.g. `{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\dfrgui.exe`
fn is_shell_guid_relative_path(path: &str) -> bool {
    let trimmed = path.trim().replace('/', "\\");
    let Some(close) = trimmed.find('}') else {
        return false;
    };
    if !is_braced_guid(&trimmed[..=close]) {
        return false;
    }
    trimmed
        .get(close + 1..)
        .is_some_and(|rest| rest.starts_with('\\') && rest.len() > 1)
}

/// e.g. `Microsoft.Windows.Shell.RunDialog`
fn is_dotted_shell_component_id(path: &str) -> bool {
    let trimmed = path.trim();
    if trimmed.is_empty() || trimmed.contains(['/', '\\', ':', ' ', '!']) {
        return false;
    }
    let lower = trimmed.to_ascii_lowercase();
    if lower.ends_with(".exe")
        || lower.ends_with(".lnk")
        || lower.ends_with(".bat")
        || lower.ends_with(".cmd")
        || lower.ends_with(".url")
        || lower.ends_with(".msc")
    {
        return false;
    }
    if !trimmed.contains('.') {
        return false;
    }
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
    {
        return false;
    }
    trimmed.split('.').filter(|part| !part.is_empty()).count() >= 2
        && !trimmed.starts_with('.')
        && !trimmed.ends_with('.')
}

/// Any AppsFolder item id that is not yet prefixed with `shell:AppsFolder\`.
pub fn is_apps_folder_item_id(path: &str) -> bool {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return false;
    }
    is_bare_aumid(trimmed)
        || is_autogenerated_shell_id(trimmed)
        || is_shell_guid_relative_path(trimmed)
        || is_unbraced_guid(trimmed)
        || is_dotted_shell_component_id(trimmed)
}

pub fn is_shell_app_target(path: &str) -> bool {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return false;
    }
    if trimmed
        .get(..6)
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case("shell:"))
    {
        return true;
    }
    is_apps_folder_item_id(trimmed)
}

/// Normalize AppsFolder / shell-namespace targets to `shell:AppsFolder\<id>`.
pub fn normalize_shell_app_target(path: &str) -> String {
    let trimmed = path.trim().replace('/', "\\");
    if trimmed.is_empty() {
        return trimmed;
    }

    let lower = trimmed.to_ascii_lowercase();
    if lower.starts_with("shell:appsfolder\\") {
        return trimmed;
    }
    if let Some(rest) = lower.strip_prefix("appsfolder\\") {
        let original_rest = &trimmed[trimmed.len() - rest.len()..];
        if is_apps_folder_item_id(original_rest) {
            return format!("shell:AppsFolder\\{original_rest}");
        }
    }
    if is_apps_folder_item_id(&trimmed) {
        return format!("shell:AppsFolder\\{trimmed}");
    }

    trimmed
}

fn should_skip_app(name: &str, path: &str) -> bool {
    let name_l = name.to_lowercase();
    let path_l = normalize_key(path);

    const NAME_BLOCKLIST: &[&str] = &[
        "uninstall",
        "desinstal",
        "uninst",
        "help",
        "ayuda",
        "readme",
        "release notes",
        "documentation",
        "eula",
        "license",
        "getting started",
        "enviar a",
        "send to",
        "tickler",
    ];

    if NAME_BLOCKLIST.iter().any(|token| name_l.contains(token)) {
        return true;
    }

    const PATH_BLOCKLIST: &[&str] = &[
        "\\administrative tools\\",
        "\\system tools\\",
        "\\windows kits\\",
        "\\windows nt\\",
        "\\accessibility\\",
        "\\startup\\",
        "\\maintenance\\",
    ];

    if PATH_BLOCKLIST.iter().any(|token| path_l.contains(token)) {
        return true;
    }

    matches!(
        name_l.as_str(),
        "app" | "application" | "aplicacion" | "aplicación"
    )
}

fn push_entry(
    entries: &mut Vec<AppEntry>,
    seen: &mut HashSet<String>,
    name: String,
    path: String,
    source: &str,
    dedupe_key: String,
) -> bool {
    let name = name.trim().to_string();
    let path = path.trim().to_string();
    if name.is_empty() || path.is_empty() {
        return false;
    }
    if should_skip_app(&name, &path) {
        return false;
    }

    let path_key = normalize_key(&dedupe_key);
    let name_key = format!("name:{}", name.to_lowercase());
    if path_key.is_empty() {
        return false;
    }
    if seen.contains(&path_key) || seen.contains(&name_key) {
        return false;
    }
    seen.insert(path_key);
    seen.insert(name_key);

    entries.push(AppEntry {
        sort_key: name.to_lowercase(),
        name,
        path,
        source: source.to_string(),
    });
    true
}

#[cfg(windows)]
fn pwstr_to_string(ptr: windows::core::PWSTR) -> Option<String> {
    if ptr.is_null() {
        return None;
    }
    unsafe {
        let value = ptr.to_string().ok();
        windows::Win32::System::Com::CoTaskMemFree(Some(ptr.0 as _));
        value.filter(|text| !text.trim().is_empty())
    }
}

#[cfg(windows)]
fn shell_display_name(path: &Path) -> Option<String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
    use windows::Win32::UI::Shell::{IShellItem, SHCreateItemFromParsingName, SIGDN_NORMALDISPLAY};

    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let com_init = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let should_uninit = com_init.is_ok();
        let result = (|| {
            let item: IShellItem =
                SHCreateItemFromParsingName(PCWSTR::from_raw(wide.as_ptr()), None).ok()?;
            let name = item.GetDisplayName(SIGDN_NORMALDISPLAY).ok()?;
            pwstr_to_string(name)
        })();
        if should_uninit {
            CoUninitialize();
        }
        result
    }
}

#[cfg(windows)]
fn resolve_shortcut_target(path: &Path) -> Option<PathBuf> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::{Interface, PCWSTR};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile, CLSCTX_INPROC_SERVER,
        COINIT_APARTMENTTHREADED, STGM_READ,
    };
    use windows::Win32::UI::Shell::{IShellLinkW, ShellLink};

    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let com_init = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let should_uninit = com_init.is_ok();
        let result = (|| {
            let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).ok()?;
            let persist: IPersistFile = link.cast().ok()?;
            persist
                .Load(PCWSTR::from_raw(wide.as_ptr()), STGM_READ)
                .ok()?;
            let mut target_buf = [0u16; 260];
            let _ = link.GetPath(&mut target_buf, std::ptr::null_mut(), 0);
            let len = target_buf.iter().position(|&c| c == 0).unwrap_or(0);
            if len == 0 {
                return None;
            }
            use std::os::windows::ffi::OsStringExt;
            Some(PathBuf::from(std::ffi::OsString::from_wide(
                &target_buf[..len],
            )))
        })();
        if should_uninit {
            CoUninitialize();
        }
        result
    }
}

#[cfg(windows)]
fn collect_apps_folder(
    entries: &mut Vec<AppEntry>,
    seen: &mut HashSet<String>,
    mut on_progress: impl FnMut(&[AppEntry]),
) {
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
    use windows::Win32::System::SystemServices::SFGAO_FOLDER;
    use windows::Win32::UI::Shell::{
        IEnumShellItems, IShellItem, BHID_EnumItems, SHCreateItemFromParsingName,
        SIGDN_DESKTOPABSOLUTEPARSING, SIGDN_NORMALDISPLAY, SIGDN_PARENTRELATIVEPARSING,
    };

    const PROGRESS_EVERY: usize = 24;

    unsafe {
        let com_init = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let should_uninit = com_init.is_ok();

        let result = (|| -> Result<(), ()> {
            let folder: IShellItem =
                SHCreateItemFromParsingName(windows::core::w!("shell:AppsFolder"), None)
                    .map_err(|_| ())?;
            let enumerator: IEnumShellItems = folder
                .BindToHandler(None, &BHID_EnumItems)
                .map_err(|_| ())?;

            let mut since_progress = 0usize;

            loop {
                let mut items: [Option<IShellItem>; 1] = [None];
                let mut fetched = 0u32;
                if enumerator.Next(&mut items, Some(&mut fetched)).is_err() || fetched == 0 {
                    break;
                }
                let Some(item) = items[0].take() else {
                    continue;
                };

                if let Ok(attrs) = item.GetAttributes(SFGAO_FOLDER) {
                    if attrs.0 != 0 {
                        continue;
                    }
                }

                let Some(name) = item
                    .GetDisplayName(SIGDN_NORMALDISPLAY)
                    .ok()
                    .and_then(pwstr_to_string)
                else {
                    continue;
                };
                let raw_path = item
                    .GetDisplayName(SIGDN_DESKTOPABSOLUTEPARSING)
                    .ok()
                    .and_then(pwstr_to_string)
                    .or_else(|| {
                        item.GetDisplayName(SIGDN_PARENTRELATIVEPARSING)
                            .ok()
                            .and_then(pwstr_to_string)
                    });
                let Some(raw_path) = raw_path else {
                    continue;
                };
                let path = normalize_shell_app_target(&raw_path);
                if path.is_empty() {
                    continue;
                }

                if push_entry(entries, seen, name, path.clone(), "Menú Inicio", path) {
                    since_progress += 1;
                    if since_progress >= PROGRESS_EVERY {
                        since_progress = 0;
                        on_progress(entries);
                    }
                }
            }

            Ok(())
        })();

        let _ = result;

        if should_uninit {
            CoUninitialize();
        }
    }
}

#[cfg(windows)]
fn display_name_from_path(path: &Path) -> String {
    if let Some(name) = shell_display_name(path) {
        return name;
    }

    path.file_stem()
        .and_then(|stem| stem.to_str())
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

#[cfg(windows)]
fn walk_shortcuts(
    root: &Path,
    entries: &mut Vec<AppEntry>,
    seen: &mut HashSet<String>,
    source: &str,
) {
    let Ok(read_dir) = fs::read_dir(root) else {
        return;
    };

    for entry in read_dir.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let dir_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("")
                .to_lowercase();
            if matches!(
                dir_name.as_str(),
                "administrative tools"
                    | "system tools"
                    | "windows kits"
                    | "windows nt"
                    | "accessibility"
                    | "startup"
                    | "maintenance"
            ) {
                continue;
            }
            walk_shortcuts(&path, entries, seen, source);
            continue;
        }

        let is_shortcut = path
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("lnk"));

        if !is_shortcut || !path.is_file() {
            continue;
        }

        let name = display_name_from_path(&path);
        let path_string = path.to_string_lossy().into_owned();

        let dedupe = resolve_shortcut_target(&path)
            .map(|target| target.to_string_lossy().into_owned())
            .unwrap_or_else(|| path_string.clone());

        let _ = push_entry(entries, seen, name, path_string, source, dedupe);
    }
}

#[cfg(windows)]
fn known_shortcut_roots() -> Vec<(PathBuf, &'static str)> {
    let mut roots = Vec::new();

    if let Some(program_data) = std::env::var_os("ProgramData") {
        roots.push((
            PathBuf::from(program_data)
                .join("Microsoft")
                .join("Windows")
                .join("Start Menu"),
            "Menú Inicio",
        ));
    }

    if let Some(app_data) = std::env::var_os("APPDATA") {
        roots.push((
            PathBuf::from(app_data)
                .join("Microsoft")
                .join("Windows")
                .join("Start Menu"),
            "Menú Inicio",
        ));
    }

    if let Some(user_profile) = std::env::var_os("USERPROFILE") {
        roots.push((PathBuf::from(user_profile).join("Desktop"), "Escritorio"));
    }

    if let Some(public) = std::env::var_os("PUBLIC") {
        roots.push((PathBuf::from(public).join("Desktop"), "Escritorio público"));
    }

    roots
}

#[cfg(windows)]
fn build_index_with_progress(mut on_progress: impl FnMut(&[AppEntry])) -> Vec<AppEntry> {
    let mut entries = Vec::new();
    let mut seen = HashSet::new();

    // Prefer Start Menu / Desktop .lnk first — filesystem paths extract icons reliably.
    for (root, source) in known_shortcut_roots() {
        if root.exists() {
            walk_shortcuts(&root, &mut entries, &mut seen, source);
            on_progress(&entries);
        }
    }

    collect_apps_folder(&mut entries, &mut seen, |snapshot| {
        on_progress(snapshot);
    });
    if !entries.is_empty() {
        on_progress(&entries);
    }

    sorted_snapshot(&entries)
}

#[cfg(not(windows))]
fn build_index_with_progress(on_progress: impl FnMut(&[AppEntry])) -> Vec<AppEntry> {
    linux::build_linux_index_with_progress(on_progress)
}

fn score_entry(entry: &AppEntry, tokens: &[&str]) -> i32 {
    let name = entry.name.to_lowercase();
    let path = entry.path.to_lowercase();

    let mut score = 0;

    for token in tokens {
        if name.starts_with(token) {
            score += 120;
        } else if name.contains(token) {
            score += 80;
        } else if path.contains(token) {
            score += 30;
        } else {
            return i32::MIN;
        }
    }

    if tokens.len() == 1 && name == tokens[0] {
        score += 200;
    }

    score -= (name.len() as i32).min(40);
    score
}

fn tokenize(query: &str) -> Vec<String> {
    query
        .split_whitespace()
        .map(|token| token.trim().to_lowercase())
        .filter(|token| !token.is_empty())
        .collect()
}

fn entry_to_result(entry: &AppEntry) -> InstalledAppResult {
    InstalledAppResult {
        name: entry.name.clone(),
        #[cfg(windows)]
        path: normalize_shell_app_target(&entry.path),
        #[cfg(not(windows))]
        path: entry.path.clone(),
        source: entry.source.clone(),
    }
}

fn run_scan_blocking(app: Option<&AppHandle>, force: bool) -> Vec<AppEntry> {
    if !force {
        if let Ok(guard) = index_lock().lock() {
            if guard.ready && !guard.apps.is_empty() {
                return guard.apps.clone();
            }
        }
    }

    if BUILDING
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        for _ in 0..200 {
            std::thread::sleep(std::time::Duration::from_millis(50));
            if let Ok(guard) = index_lock().lock() {
                if let Some(handle) = app {
                    if !guard.apps.is_empty() {
                        emit_apps_updated(handle, &guard.apps);
                    }
                }
                if guard.ready {
                    let apps = guard.apps.clone();
                    if let Some(handle) = app {
                        emit_apps_ready(handle, &apps);
                    }
                    return apps;
                }
            }
            if !BUILDING.load(Ordering::SeqCst) {
                break;
            }
        }
        return index_lock()
            .lock()
            .map(|guard| guard.apps.clone())
            .unwrap_or_default();
    }

    let apps = build_index_with_progress(|snapshot| {
        publish_snapshot(snapshot, false);
        if let Some(handle) = app {
            emit_apps_updated(handle, snapshot);
        }
    });

    publish_snapshot(&apps, true);
    BUILDING.store(false, Ordering::SeqCst);
    apps
}

/// Builds the app index on a background thread so the first search is cheap.
pub fn warm_installed_apps_index() {
    std::thread::Builder::new()
        .name("warm-app-search-index".into())
        .spawn(|| {
            let _ = run_scan_blocking(None, false);
        })
        .ok();
}

/// Progressive scan; emits `installed-apps-updated` and `installed-apps-ready`.
pub fn start_installed_apps_scan(app: AppHandle, force: bool) {
    std::thread::Builder::new()
        .name("scan-installed-apps".into())
        .spawn(move || {
            if !force {
                if let Ok(guard) = index_lock().lock() {
                    if guard.ready {
                        let apps = guard.apps.clone();
                        drop(guard);
                        emit_apps_updated(&app, &apps);
                        emit_apps_ready(&app, &apps);
                        return;
                    }
                }
            }

            let apps = run_scan_blocking(Some(&app), force);
            emit_apps_updated(&app, &apps);
            emit_apps_ready(&app, &apps);
        })
        .ok();
}

pub fn list_installed_apps() -> Result<Vec<InstalledAppResult>, String> {
    Ok(current_results())
}

pub fn search_installed_apps(query: &str, limit: usize) -> Result<Vec<InstalledAppResult>, String> {
    let _ = run_scan_blocking(None, false);
    let index = index_lock()
        .lock()
        .map_err(|_| "No se pudo acceder al índice de aplicaciones.".to_string())?;

    let tokens = tokenize(query);

    let results: Vec<(i32, &AppEntry)> = if tokens.is_empty() {
        index
            .apps
            .iter()
            .take(limit)
            .map(|entry| (0, entry))
            .collect()
    } else {
        let token_refs: Vec<&str> = tokens.iter().map(String::as_str).collect();
        let mut scored: Vec<(i32, &AppEntry)> = index
            .apps
            .iter()
            .filter_map(|entry| {
                let score = score_entry(entry, &token_refs);
                if score > i32::MIN {
                    Some((score, entry))
                } else {
                    None
                }
            })
            .collect();

        scored.sort_by(|left, right| {
            right
                .0
                .cmp(&left.0)
                .then_with(|| left.1.sort_key.cmp(&right.1.sort_key))
        });

        scored.truncate(limit);
        scored
    };

    Ok(results
        .into_iter()
        .map(|(_, entry)| entry_to_result(entry))
        .collect())
}

pub fn refresh_installed_apps_index() -> Result<usize, String> {
    let fresh = run_scan_blocking(None, true);
    Ok(fresh.len())
}

#[cfg(test)]
mod tests {
    use super::{
        is_apps_folder_item_id, is_bare_aumid, is_protocol_target, is_shell_app_target,
        normalize_protocol_target, normalize_shell_app_target,
    };

    #[test]
    fn detects_bare_aumid() {
        assert!(is_bare_aumid(
            "Agilebits.1Password_amwd9z03whsfe!Agilebits.OnePassword"
        ));
        assert!(!is_bare_aumid(
            r"shell:AppsFolder\Agilebits.1Password_amwd9z03whsfe!Agilebits.OnePassword"
        ));
        assert!(!is_bare_aumid(r"C:\Apps\1Password.lnk"));
        assert!(!is_bare_aumid(
            "Microsoft.AutoGenerated.{39F3B85B-63FB-0256-8A0A-AAC177410D28}"
        ));
    }

    #[test]
    fn detects_autogenerated_guid_and_dotted_shell_ids() {
        assert!(is_apps_folder_item_id(
            "Microsoft.AutoGenerated.{39F3B85B-63FB-0256-8A0A-AAC177410D28}"
        ));
        assert!(is_apps_folder_item_id(
            r"{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\dfrgui.exe"
        ));
        assert!(is_apps_folder_item_id(
            "Microsoft.Windows.Shell.RunDialog"
        ));
        assert!(is_apps_folder_item_id(
            "8a42fd47-d654-4028-8797-197fdf8d96e9"
        ));
        assert!(!is_apps_folder_item_id(r"C:\Windows\System32\dfrgui.exe"));
        assert!(!is_apps_folder_item_id("notepad.exe"));
    }

    #[test]
    fn normalizes_shell_item_ids_to_apps_folder() {
        assert_eq!(
            normalize_shell_app_target("Microsoft.Windows.Shell.RunDialog"),
            r"shell:AppsFolder\Microsoft.Windows.Shell.RunDialog"
        );
        assert_eq!(
            normalize_shell_app_target("8a42fd47-d654-4028-8797-197fdf8d96e9"),
            r"shell:AppsFolder\8a42fd47-d654-4028-8797-197fdf8d96e9"
        );
        assert!(is_shell_app_target("Microsoft.Windows.Shell.RunDialog"));
    }

    #[test]
    fn normalizes_protocol_targets_with_backslashes() {
        assert!(is_protocol_target(r"steam:\\rungameid\2807960"));
        assert!(is_protocol_target(r"uplay:\\launch\4932\0"));
        assert!(is_protocol_target(r"https:\\gitforwindows.org\faq"));
        assert!(!is_protocol_target(r"C:\Games\game.exe"));
        assert!(!is_protocol_target(
            r"shell:AppsFolder\Microsoft.Windows.Shell.RunDialog"
        ));

        assert_eq!(
            normalize_protocol_target(r"steam:\\rungameid\2807960").as_deref(),
            Some("steam://rungameid/2807960")
        );
        assert_eq!(
            normalize_protocol_target(r"uplay:\\launch\4932\0").as_deref(),
            Some("uplay://launch/4932/0")
        );
        assert_eq!(
            normalize_protocol_target(r"https:\\gitforwindows.org\faq").as_deref(),
            Some("https://gitforwindows.org/faq")
        );
    }
}
