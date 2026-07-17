use std::fs;
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use tauri::{AppHandle, Manager};

const WALLPAPER_BASENAME: &str = "wallpaper";
const MAX_IMAGE_BYTES: u64 = 30 * 1024 * 1024;

fn wallpaper_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No se pudo obtener el directorio de datos: {e}"))?;

    fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear el directorio de datos: {e}"))?;
    Ok(dir)
}

fn is_supported_image(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            matches!(
                ext.to_ascii_lowercase().as_str(),
                "png" | "jpg" | "jpeg" | "webp" | "bmp" | "gif"
            )
        })
        .unwrap_or(false)
}

fn remove_existing_wallpapers(dir: &Path) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("No se pudo leer el directorio: {e}"))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("No se pudo leer una entrada: {e}"))?;
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy();

        if name.starts_with(WALLPAPER_BASENAME) {
            fs::remove_file(entry.path())
                .map_err(|e| format!("No se pudo eliminar el fondo anterior: {e}"))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn save_wallpaper(app: AppHandle, source_path: String) -> Result<String, String> {
    let source = source_path.trim();
    if source.is_empty() {
        return Err("La ruta de la imagen está vacía.".into());
    }

    let source_path = PathBuf::from(source);
    if !source_path.is_file() {
        return Err(format!("No se encontró la imagen: {source}"));
    }

    if !is_supported_image(&source_path) {
        return Err("Formato no soportado. Usa PNG, JPG, WEBP, BMP o GIF.".into());
    }

    let dir = wallpaper_dir(&app)?;
    remove_existing_wallpapers(&dir)?;

    let extension = source_path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_else(|| "jpg".to_string());

    let dest = dir.join(format!("{WALLPAPER_BASENAME}.{extension}"));
    fs::copy(&source_path, &dest).map_err(|e| format!("No se pudo copiar la imagen: {e}"))?;

    Ok(dest.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn remove_wallpaper(app: AppHandle) -> Result<(), String> {
    let dir = wallpaper_dir(&app)?;
    if dir.exists() {
        remove_existing_wallpapers(&dir)?;
    }
    Ok(())
}

fn mime_for_image(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("bmp") => "image/bmp",
        _ => "image/jpeg",
    }
}

/// Reads a local image into a data URL so the webview can display it
/// without relying on the asset protocol scope.
#[tauri::command]
pub fn load_image_data_url(path: String) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("La ruta de la imagen está vacía.".into());
    }

    let path = PathBuf::from(trimmed);
    if !path.is_file() {
        return Err(format!("No se encontró la imagen: {trimmed}"));
    }

    if !is_supported_image(&path) {
        return Err("Formato no soportado. Usa PNG, JPG, WEBP, BMP o GIF.".into());
    }

    let meta = fs::metadata(&path).map_err(|e| format!("No se pudo leer la imagen: {e}"))?;
    if meta.len() > MAX_IMAGE_BYTES {
        return Err("La imagen supera el límite de 30 MB.".into());
    }

    let bytes = fs::read(&path).map_err(|e| format!("No se pudo leer la imagen: {e}"))?;
    let mime = mime_for_image(&path);
    Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}
