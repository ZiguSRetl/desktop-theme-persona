//! Cross-platform item launch (Windows vs Linux).

use std::path::Path;
use std::process::Command;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::app_search;

pub struct LaunchPayload {
    pub item_type: String,
    pub target: String,
    pub arguments: Option<Vec<String>>,
}

fn is_lnk(target: &str) -> bool {
    target.to_ascii_lowercase().ends_with(".lnk")
}

fn is_desktop_file(target: &str) -> bool {
    target.to_ascii_lowercase().ends_with(".desktop")
}

fn launch_protocol_target(app: &AppHandle, target: &str) -> Result<(), String> {
    let uri = app_search::normalize_protocol_target(target)
        .unwrap_or_else(|| target.trim().to_string());
    app.opener()
        .open_url(&uri, None::<&str>)
        .map_err(|e| format!("No se pudo abrir el URI: {e}"))
}

#[cfg(windows)]
fn launch_shell_app(target: &str) -> Result<(), String> {
    let path = app_search::normalize_shell_app_target(target);
    // explorer.exe reliably activates AppsFolder AUMIDs; cmd start mishandles `!`.
    Command::new("explorer")
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("No se pudo lanzar el acceso: {e}"))
}

#[cfg(windows)]
fn launch_folder(target: &str) -> Result<(), String> {
    if !Path::new(target).is_dir() {
        return Err(format!("La carpeta no existe: {target}"));
    }
    Command::new("explorer")
        .arg(target)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("No se pudo abrir la carpeta: {e}"))
}

#[cfg(windows)]
fn launch_application(app: &AppHandle, target: &str, args: &[String]) -> Result<(), String> {
    if app_search::is_protocol_target(target) {
        return launch_protocol_target(app, target);
    }

    if app_search::is_shell_app_target(target) {
        return launch_shell_app(target);
    }

    if is_lnk(target) || target.contains(' ') {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", "start", "", target]);
        return cmd
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("No se pudo lanzar el acceso: {e}"));
    }

    if !Path::new(target).exists() {
        return Err(format!("No se encontró la ruta: {target}"));
    }

    let mut cmd = Command::new(target);
    if !args.is_empty() {
        cmd.args(args);
    }
    cmd.spawn()
        .map(|_| ())
        .map_err(|e| format!("No se pudo lanzar la aplicación: {e}"))
}

#[cfg(not(windows))]
fn launch_folder(target: &str) -> Result<(), String> {
    if !Path::new(target).is_dir() {
        return Err(format!("La carpeta no existe: {target}"));
    }
    Command::new("xdg-open")
        .arg(target)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("No se pudo abrir la carpeta: {e}"))
}

#[cfg(not(windows))]
fn launch_desktop_file(target: &str) -> Result<(), String> {
    let path = Path::new(target);
    if !path.is_file() {
        return Err(format!("No se encontró el acceso .desktop: {target}"));
    }

    // Prefer gtk-launch with the desktop id (basename without path) when possible.
    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
        let id = file_name
            .strip_suffix(".desktop")
            .unwrap_or(file_name);
        if Command::new("gtk-launch")
            .arg(id)
            .spawn()
            .map(|_| ())
            .is_ok()
        {
            return Ok(());
        }
    }

    Command::new("xdg-open")
        .arg(target)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("No se pudo lanzar el acceso .desktop: {e}"))
}

#[cfg(not(windows))]
fn launch_application(app: &AppHandle, target: &str, args: &[String]) -> Result<(), String> {
    if app_search::is_protocol_target(target) {
        return launch_protocol_target(app, target);
    }

    if is_desktop_file(target) {
        return launch_desktop_file(target);
    }

    if !Path::new(target).exists() {
        return Err(format!("No se encontró la ruta: {target}"));
    }

    let mut cmd = Command::new(target);
    if !args.is_empty() {
        cmd.args(args);
    }
    cmd.spawn()
        .map(|_| ())
        .map_err(|e| format!("No se pudo lanzar la aplicación: {e}"))
}

pub fn launch_item(app: &AppHandle, payload: LaunchPayload) -> Result<(), String> {
    let item_type = payload.item_type.as_str();
    let target = payload.target.trim();
    let args = payload.arguments.unwrap_or_default();

    if target.is_empty() {
        return Err("El destino está vacío.".into());
    }

    match item_type {
        "url" => launch_protocol_target(app, target),
        "folder" => launch_folder(target),
        "application" | "game" => launch_application(app, target, &args),
        other => Err(format!("Tipo de acceso no soportado: {other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::{is_desktop_file, is_lnk};

    #[test]
    fn detects_shortcut_extensions() {
        assert!(is_lnk(r"C:\Apps\Foo.lnk"));
        assert!(is_desktop_file("/usr/share/applications/firefox.desktop"));
        assert!(!is_desktop_file("/usr/bin/firefox"));
    }
}
