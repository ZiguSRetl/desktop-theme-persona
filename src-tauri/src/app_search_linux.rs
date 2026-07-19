//! FreeDesktop `.desktop` application catalog for Linux.

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use super::{push_entry, AppEntry};

const PROGRESS_EVERY: usize = 120;

#[derive(Debug, Clone, PartialEq, Eq)]
struct DesktopEntry {
    name: String,
    exec: Option<String>,
    icon: Option<String>,
    categories: Option<String>,
    no_display: bool,
    hidden: bool,
    desktop_type: Option<String>,
}

/// Parse a `.desktop` file body. Prefers `Name[locale]` over bare `Name=`.
fn parse_desktop_file(content: &str, locale: &str) -> Option<DesktopEntry> {
    let (lang_country, lang) = locale_parts(locale);

    let mut name: Option<String> = None;
    let mut name_lang: Option<String> = None;
    let mut name_lang_country: Option<String> = None;
    let mut exec: Option<String> = None;
    let mut icon: Option<String> = None;
    let mut categories: Option<String> = None;
    let mut no_display = false;
    let mut hidden = false;
    let mut desktop_type: Option<String> = None;
    let mut in_desktop_entry = false;

    for raw_line in content.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        if line.starts_with('[') && line.ends_with(']') {
            in_desktop_entry = line.eq_ignore_ascii_case("[Desktop Entry]");
            continue;
        }

        if !in_desktop_entry {
            continue;
        }

        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let key = key.trim();
        let value = value.trim();

        if key.eq_ignore_ascii_case("Type") {
            desktop_type = Some(value.to_string());
        } else if key.eq_ignore_ascii_case("Name") {
            name = Some(value.to_string());
        } else if let Some(loc) = key
            .strip_prefix("Name[")
            .or_else(|| key.strip_prefix("name["))
            .and_then(|rest| rest.strip_suffix(']'))
        {
            if !lang_country.is_empty() && loc.eq_ignore_ascii_case(&lang_country) {
                name_lang_country = Some(value.to_string());
            } else if !lang.is_empty() && loc.eq_ignore_ascii_case(&lang) {
                name_lang = Some(value.to_string());
            }
        } else if key.eq_ignore_ascii_case("Exec") {
            exec = Some(value.to_string());
        } else if key.eq_ignore_ascii_case("Icon") {
            icon = Some(value.to_string());
        } else if key.eq_ignore_ascii_case("Categories") {
            categories = Some(value.to_string());
        } else if key.eq_ignore_ascii_case("NoDisplay") {
            no_display = desktop_bool(value);
        } else if key.eq_ignore_ascii_case("Hidden") {
            hidden = desktop_bool(value);
        }
    }

    let resolved_name = name_lang_country
        .or(name_lang)
        .or(name)
        .map(|n| n.trim().to_string())
        .filter(|n| !n.is_empty())?;

    Some(DesktopEntry {
        name: resolved_name,
        exec,
        icon,
        categories,
        no_display,
        hidden,
        desktop_type,
    })
}

fn desktop_bool(value: &str) -> bool {
    matches!(
        value.trim().to_ascii_lowercase().as_str(),
        "true" | "1" | "yes"
    )
}

fn locale_parts(locale: &str) -> (String, String) {
    let cleaned = locale
        .split('.')
        .next()
        .unwrap_or(locale)
        .split('@')
        .next()
        .unwrap_or(locale)
        .trim();
    if cleaned.is_empty() || cleaned.eq_ignore_ascii_case("C") || cleaned.eq_ignore_ascii_case("POSIX")
    {
        return (String::new(), String::new());
    }
    let lang_country = cleaned.replace('-', "_");
    let lang = lang_country
        .split('_')
        .next()
        .unwrap_or("")
        .to_string();
    (lang_country, lang)
}

fn current_locale() -> String {
    std::env::var("LC_MESSAGES")
        .or_else(|_| std::env::var("LANG"))
        .unwrap_or_default()
}

pub(super) fn read_desktop_icon_key(path: &Path) -> Option<String> {
    let content = fs::read_to_string(path).ok()?;
    let entry = parse_desktop_file(&content, &current_locale())?;
    entry
        .icon
        .map(|icon| icon.trim().to_string())
        .filter(|icon| !icon.is_empty())
}

fn is_application_entry(entry: &DesktopEntry) -> bool {
    !entry.no_display
        && !entry.hidden
        && entry
            .desktop_type
            .as_deref()
            .is_some_and(|t| t.eq_ignore_ascii_case("Application"))
}

fn source_for_path(path: &Path) -> &'static str {
    let lower = path.to_string_lossy().to_ascii_lowercase();
    if lower.contains("flatpak") {
        "Flatpak"
    } else {
        "Applications"
    }
}

fn application_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    let mut push = |path: PathBuf| {
        if path.is_dir() && !dirs.iter().any(|existing| existing == &path) {
            dirs.push(path);
        }
    };

    if let Some(xdg_data_home) = std::env::var_os("XDG_DATA_HOME") {
        push(PathBuf::from(xdg_data_home).join("applications"));
    } else if let Some(home) = std::env::var_os("HOME") {
        push(
            PathBuf::from(home)
                .join(".local")
                .join("share")
                .join("applications"),
        );
    }

    push(PathBuf::from("/usr/share/applications"));
    push(PathBuf::from("/usr/local/share/applications"));

    let xdg_data_dirs = std::env::var("XDG_DATA_DIRS")
        .unwrap_or_else(|_| "/usr/local/share:/usr/share".to_string());
    for part in xdg_data_dirs.split(':') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        push(PathBuf::from(part).join("applications"));
    }

    let flatpak = PathBuf::from("/var/lib/flatpak/exports/share/applications");
    if flatpak.is_dir() {
        push(flatpak);
    }

    dirs
}

fn walk_desktop_dir(
    root: &Path,
    entries: &mut Vec<AppEntry>,
    seen: &mut HashSet<String>,
    locale: &str,
    since_progress: &mut usize,
    on_progress: &mut dyn FnMut(&[AppEntry]),
) {
    let Ok(read_dir) = fs::read_dir(root) else {
        return;
    };

    for entry in read_dir.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk_desktop_dir(&path, entries, seen, locale, since_progress, on_progress);
            continue;
        }

        let is_desktop = path
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("desktop"));
        if !is_desktop || !path.is_file() {
            continue;
        }

        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        let Some(parsed) = parse_desktop_file(&content, locale) else {
            continue;
        };
        if !is_application_entry(&parsed) {
            continue;
        }

        let path_string = path.to_string_lossy().into_owned();
        let source = source_for_path(&path);
        if push_entry(
            entries,
            seen,
            parsed.name,
            path_string.clone(),
            source,
            path_string,
        ) {
            *since_progress += 1;
            if *since_progress >= PROGRESS_EVERY {
                *since_progress = 0;
                on_progress(entries);
            }
        }
    }
}

pub(super) fn build_linux_index_with_progress(
    mut on_progress: impl FnMut(&[AppEntry]),
) -> Vec<AppEntry> {
    let mut entries = Vec::new();
    let mut seen = HashSet::new();
    let locale = current_locale();
    let mut since_progress = 0usize;

    for dir in application_dirs() {
        walk_desktop_dir(
            &dir,
            &mut entries,
            &mut seen,
            &locale,
            &mut since_progress,
            &mut on_progress,
        );
        if !entries.is_empty() {
            on_progress(&entries);
        }
    }

    let mut snapshot = entries;
    snapshot.sort_by(|left, right| left.sort_key.cmp(&right.sort_key));
    snapshot
}

#[cfg(test)]
mod tests {
    use super::{parse_desktop_file, source_for_path, DesktopEntry};
    use std::path::Path;

    const SAMPLE: &str = r#"
[Desktop Entry]
Type=Application
Name=Firefox
Name[es]=Firefox Web
Name[fr]=Firefox Navigateur
Exec=firefox %u
Icon=firefox
Categories=Network;WebBrowser;
"#;

    #[test]
    fn parses_basic_desktop_entry() {
        let entry = parse_desktop_file(SAMPLE, "C").expect("parse");
        assert_eq!(
            entry,
            DesktopEntry {
                name: "Firefox".into(),
                exec: Some("firefox %u".into()),
                icon: Some("firefox".into()),
                categories: Some("Network;WebBrowser;".into()),
                no_display: false,
                hidden: false,
                desktop_type: Some("Application".into()),
            }
        );
    }

    #[test]
    fn prefers_locale_name() {
        let es = parse_desktop_file(SAMPLE, "es_ES.UTF-8").expect("parse es");
        assert_eq!(es.name, "Firefox Web");

        let fr = parse_desktop_file(SAMPLE, "fr_FR").expect("parse fr");
        assert_eq!(fr.name, "Firefox Navigateur");

        let de = parse_desktop_file(SAMPLE, "de_DE").expect("parse de");
        assert_eq!(de.name, "Firefox");
    }

    #[test]
    fn skips_hidden_and_nodisplay() {
        let hidden = parse_desktop_file(
            "[Desktop Entry]\nType=Application\nName=Hidden\nHidden=true\n",
            "C",
        )
        .expect("parse");
        assert!(hidden.hidden);

        let no_display = parse_desktop_file(
            "[Desktop Entry]\nType=Application\nName=NoShow\nNoDisplay=true\n",
            "C",
        )
        .expect("parse");
        assert!(no_display.no_display);
    }

    #[test]
    fn requires_name() {
        assert!(parse_desktop_file(
            "[Desktop Entry]\nType=Application\nExec=foo\n",
            "C"
        )
        .is_none());
    }

    #[test]
    fn ignores_non_desktop_entry_groups() {
        let content = r#"
[Desktop Action new-window]
Name=New Window

[Desktop Entry]
Type=Application
Name=Terminal
Exec=gnome-terminal
"#;
        let entry = parse_desktop_file(content, "C").expect("parse");
        assert_eq!(entry.name, "Terminal");
    }

    #[test]
    fn flatpak_source_from_path() {
        assert_eq!(
            source_for_path(Path::new(
                "/var/lib/flatpak/exports/share/applications/org.gimp.GIMP.desktop"
            )),
            "Flatpak"
        );
        assert_eq!(
            source_for_path(Path::new("/usr/share/applications/firefox.desktop")),
            "Applications"
        );
    }
}
