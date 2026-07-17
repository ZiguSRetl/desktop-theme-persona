use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

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
    path: PathBuf,
    source: String,
    sort_key: String,
}

static INDEX: OnceLock<Mutex<Vec<AppEntry>>> = OnceLock::new();

fn index_lock() -> &'static Mutex<Vec<AppEntry>> {
    INDEX.get_or_init(|| Mutex::new(build_index()))
}

fn normalize_key(path: &Path) -> String {
    path.to_string_lossy().replace('/', "\\").to_lowercase()
}

fn display_name_from_path(path: &Path) -> String {
    path.file_stem()
        .and_then(|stem| stem.to_str())
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

fn push_entry(
    entries: &mut Vec<AppEntry>,
    seen: &mut HashSet<String>,
    path: PathBuf,
    source: &str,
) {
    if !path.is_file() {
        return;
    }

    let key = normalize_key(&path);
    if !seen.insert(key) {
        return;
    }

    let name = display_name_from_path(&path);
    if name.is_empty() {
        return;
    }

    entries.push(AppEntry {
        sort_key: name.to_lowercase(),
        name,
        path,
        source: source.to_string(),
    });
}

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
            walk_shortcuts(&path, entries, seen, source);
            continue;
        }

        let is_shortcut = path
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("lnk"));

        if is_shortcut {
            push_entry(entries, seen, path, source);
        }
    }
}

fn known_roots() -> Vec<(PathBuf, &'static str)> {
    let mut roots = Vec::new();

    if let Some(program_data) = std::env::var_os("ProgramData") {
        roots.push((
            PathBuf::from(program_data)
                .join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs"),
            "Menú Inicio",
        ));
    }

    if let Some(app_data) = std::env::var_os("APPDATA") {
        roots.push((
            PathBuf::from(app_data)
                .join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs"),
            "Menú Inicio",
        ));
    }

    if let Some(user_profile) = std::env::var_os("USERPROFILE") {
        roots.push((PathBuf::from(&user_profile).join("Desktop"), "Escritorio"));
    }

    if let Some(public) = std::env::var_os("PUBLIC") {
        roots.push((PathBuf::from(public).join("Desktop"), "Escritorio público"));
    }

    roots
}

fn build_index() -> Vec<AppEntry> {
    let mut entries = Vec::new();
    let mut seen = HashSet::new();

    for (root, source) in known_roots() {
        if root.exists() {
            walk_shortcuts(&root, &mut entries, &mut seen, source);
        }
    }

    entries.sort_by(|left, right| left.sort_key.cmp(&right.sort_key));
    entries
}

fn score_entry(entry: &AppEntry, tokens: &[&str]) -> i32 {
    let name = entry.name.to_lowercase();
    let path = entry.path.to_string_lossy().to_lowercase();

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

/// Builds the app index on a background thread so the first search is cheap.
pub fn warm_installed_apps_index() {
    #[cfg(windows)]
    {
        std::thread::Builder::new()
            .name("warm-app-search-index".into())
            .spawn(|| {
                let _ = index_lock();
            })
            .ok();
    }
}

#[cfg(windows)]
pub fn search_installed_apps(query: &str, limit: usize) -> Result<Vec<InstalledAppResult>, String> {
    let index = index_lock()
        .lock()
        .map_err(|_| "No se pudo acceder al índice de aplicaciones.".to_string())?;

    let tokens = tokenize(query);

    let results: Vec<(i32, &AppEntry)> = if tokens.is_empty() {
        index.iter().take(limit).map(|entry| (0, entry)).collect()
    } else {
        let token_refs: Vec<&str> = tokens.iter().map(String::as_str).collect();
        let mut scored: Vec<(i32, &AppEntry)> = index
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
        .map(|(_, entry)| InstalledAppResult {
            name: entry.name.clone(),
            path: entry.path.to_string_lossy().into_owned(),
            source: entry.source.clone(),
        })
        .collect())
}

#[cfg(not(windows))]
pub fn search_installed_apps(
    _query: &str,
    _limit: usize,
) -> Result<Vec<InstalledAppResult>, String> {
    Ok(Vec::new())
}

pub fn refresh_installed_apps_index() -> Result<usize, String> {
    let fresh = build_index();
    let count = fresh.len();
    let mut index = index_lock()
        .lock()
        .map_err(|_| "No se pudo acceder al índice de aplicaciones.".to_string())?;
    *index = fresh;
    Ok(count)
}
