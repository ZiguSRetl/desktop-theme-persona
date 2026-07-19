#[cfg(windows)]
use image::RgbaImage;
#[cfg(windows)]
use std::path::{Path, PathBuf};
#[cfg(windows)]
use std::sync::Mutex;

#[cfg(windows)]
static SHELL_ICON_LOCK: Mutex<()> = Mutex::new(());

#[cfg(windows)]
const TARGET_SIZE: u32 = 256;
#[cfg(windows)]
const ALPHA_THRESHOLD: u8 = 12;
/// Minimum opaque pixels to prefer a candidate (filters soft upscales of tiny ICOs).
#[cfg(windows)]
const MIN_USEFUL_OPAQUE: u64 = 8_000;

#[cfg(windows)]
pub fn get_file_icon(path: &str, size: Option<u32>) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("La ruta está vacía.".into());
    }

    let target_size = size.unwrap_or(TARGET_SIZE).clamp(32, 256);

    if crate::app_search::is_protocol_target(trimmed) {
        if let Some(image) = try_protocol_icon(trimmed, target_size)? {
            return encode_icon_png_base64(&image);
        }
        return Err(format!(
            "No se pudo resolver un icono para el protocolo: {trimmed}"
        ));
    }

    let resolved = if crate::app_search::is_shell_app_target(trimmed) {
        crate::app_search::normalize_shell_app_target(trimmed)
    } else {
        trimmed.to_string()
    };
    let shell_item = is_shell_parsing_path(&resolved);

    if !shell_item && !Path::new(&resolved).exists() {
        return Err(format!("No se encontró la ruta: {resolved}"));
    }

    let candidates = icon_candidates(&resolved);
    let mut best: Option<(u64, RgbaImage)> = None;
    let mut last_error: Option<String> = None;

    for candidate in candidates {
        match extract_normalized_icon(&candidate, target_size) {
            Ok(image) => {
                let score = icon_quality_score(&image);
                if best
                    .as_ref()
                    .map_or(true, |(best_score, _)| score > *best_score)
                {
                    best = Some((score, image));
                }
            }
            Err(error) => last_error = Some(error),
        }
    }

    let Some((_score, image)) = best else {
        return Err(last_error.unwrap_or_else(|| {
            "No se pudo extraer un icono válido desde la ruta ni sus destinos.".into()
        }));
    };

    encode_icon_png_base64(&image)
}

#[cfg(windows)]
fn encode_icon_png_base64(image: &RgbaImage) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use image::codecs::png::PngEncoder;
    use image::{ExtendedColorType, ImageEncoder};
    use std::io::Cursor;

    let mut buffer = Cursor::new(Vec::new());
    PngEncoder::new(&mut buffer)
        .write_image(
            image.as_raw(),
            image.width(),
            image.height(),
            ExtendedColorType::Rgba8,
        )
        .map_err(|error| format!("No se pudo codificar el icono: {error}"))?;

    Ok(STANDARD.encode(buffer.into_inner()))
}

#[cfg(windows)]
fn try_protocol_icon(target: &str, size: u32) -> Result<Option<RgbaImage>, String> {
    if let Some(app_id) = parse_steam_app_id(target) {
        if let Some(image) = load_steam_app_icon(app_id, size)? {
            return Ok(Some(image));
        }
    }
    Ok(None)
}

#[cfg(windows)]
fn parse_steam_app_id(target: &str) -> Option<u32> {
    let normalized = crate::app_search::normalize_protocol_target(target)
        .unwrap_or_else(|| target.trim().replace('\\', "/"));
    let lower = normalized.to_ascii_lowercase();
    let rest = lower.strip_prefix("steam://rungameid/")?;
    let id = rest
        .split(|c| matches!(c, '/' | '?' | '#' | '&'))
        .next()
        .unwrap_or("");
    if id.is_empty() {
        return None;
    }
    id.parse().ok()
}

#[cfg(windows)]
fn steam_install_dirs() -> Vec<PathBuf> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    let mut dirs = Vec::new();

    let push_dir = |dirs: &mut Vec<PathBuf>, value: String| {
        let path = PathBuf::from(value.replace('/', "\\"));
        if path.is_dir() && !dirs.iter().any(|existing| paths_equal(existing, &path)) {
            dirs.push(path);
        }
    };

    if let Ok(key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey("Software\\Valve\\Steam") {
        if let Ok(path) = key.get_value::<String, _>("SteamPath") {
            push_dir(&mut dirs, path);
        }
    }

    for root in [
        RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey("SOFTWARE\\WOW6432Node\\Valve\\Steam"),
        RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey("SOFTWARE\\Valve\\Steam"),
    ]
    .into_iter()
    .flatten()
    {
        if let Ok(path) = root.get_value::<String, _>("InstallPath") {
            push_dir(&mut dirs, path);
        }
    }

    for env_key in ["ProgramFiles(x86)", "ProgramFiles"] {
        if let Ok(base) = std::env::var(env_key) {
            push_dir(&mut dirs, format!("{base}\\Steam"));
        }
    }

    dirs
}

#[cfg(windows)]
fn steam_library_cache_icon_paths(app_id: u32) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let id_prefix = format!("{app_id}_");
    let id_exact = format!("{app_id}.");
    let preferred = [
        format!("{app_id}_icon.jpg"),
        format!("{app_id}_icon.png"),
        format!("{app_id}_logo.png"),
        format!("{app_id}_header.jpg"),
        format!("{app_id}_library_600x900.jpg"),
        format!("{app_id}.jpg"),
    ];

    for steam_dir in steam_install_dirs() {
        let cache = steam_dir.join("appcache").join("librarycache");
        for name in &preferred {
            let candidate = cache.join(name);
            if candidate.is_file() {
                paths.push(candidate);
            }
        }

        if let Ok(entries) = std::fs::read_dir(&cache) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }
                let name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_ascii_lowercase();
                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_ascii_lowercase();
                if !matches!(ext.as_str(), "jpg" | "jpeg" | "png") {
                    continue;
                }
                if name.starts_with(&id_prefix) || name.starts_with(&id_exact) {
                    if !paths.iter().any(|existing| paths_equal(existing, &path)) {
                        paths.push(path);
                    }
                }
            }
        }

        // Newer Steam layouts nest hashed assets under librarycache\<appid>\.
        let nested = cache.join(app_id.to_string());
        if nested.is_dir() {
            if let Ok(entries) = std::fs::read_dir(&nested) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    let ext = path
                        .extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("")
                        .to_ascii_lowercase();
                    let name = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_ascii_lowercase();
                    if matches!(ext.as_str(), "jpg" | "jpeg" | "png")
                        && (name.contains("icon")
                            || name.contains("logo")
                            || name.contains("header")
                            || name.contains("library"))
                    {
                        paths.push(path);
                    }
                }
            }
        }
    }

    paths
}

#[cfg(windows)]
fn load_steam_app_icon(app_id: u32, size: u32) -> Result<Option<RgbaImage>, String> {
    let mut best: Option<(u64, RgbaImage)> = None;

    for path in steam_library_cache_icon_paths(app_id) {
        match load_raster_icon(&path, size) {
            Ok(image) => {
                let score = icon_quality_score(&image);
                // Prefer explicit *_icon.* files slightly by path name.
                let name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_ascii_lowercase();
                let bonus = if name.contains("icon") {
                    50_000
                } else if name.contains("logo") {
                    20_000
                } else {
                    0
                };
                let score = score.saturating_add(bonus);
                if best
                    .as_ref()
                    .map_or(true, |(best_score, _)| score > *best_score)
                {
                    best = Some((score, image));
                }
            }
            Err(_) => continue,
        }
    }

    Ok(best.map(|(_, image)| image))
}

#[cfg(windows)]
fn load_raster_icon(path: &Path, size: u32) -> Result<RgbaImage, String> {
    let image = image::open(path)
        .map_err(|error| format!("No se pudo leer la imagen de icono: {error}"))?
        .to_rgba8();
    let cropped = trim_transparent(image, ALPHA_THRESHOLD);
    Ok(fit_icon_to_canvas(cropped, size))
}

#[cfg(windows)]
fn is_shell_parsing_path(path: &str) -> bool {
    crate::app_search::is_shell_app_target(path)
        || path
            .get(..6)
            .is_some_and(|prefix| prefix.eq_ignore_ascii_case("shell:"))
}

#[cfg(windows)]
fn extract_normalized_icon(path: &Path, size: u32) -> Result<RgbaImage, String> {
    let image = extract_shell_icon(path, size)?;
    let cropped = trim_transparent(image, ALPHA_THRESHOLD);
    Ok(fit_icon_to_canvas(cropped, size))
}

#[cfg(windows)]
fn icon_candidates(path: &str) -> Vec<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if crate::app_search::is_shell_app_target(path) {
        let normalized = crate::app_search::normalize_shell_app_target(path);
        candidates.push(PathBuf::from(normalized));
        return candidates;
    }

    let root = PathBuf::from(path);
    push_unique(&mut candidates, root.clone());

    if is_lnk(&root) {
        if let Ok((target, icon_file)) = resolve_shortcut(&root) {
            // Prefer the resolved executable over a low-res IconLocation .ico.
            if let Some(target) = target {
                push_unique(&mut candidates, target);
            }
            if let Some(icon_file) = icon_file {
                push_unique(&mut candidates, icon_file);
            }
        }
    }

    candidates
}

#[cfg(windows)]
fn is_lnk(path: &Path) -> bool {
    path.extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("lnk"))
}

#[cfg(windows)]
fn push_unique(candidates: &mut Vec<PathBuf>, path: PathBuf) {
    if !path.exists() {
        return;
    }
    let already = candidates
        .iter()
        .any(|existing| paths_equal(existing, &path));
    if !already {
        candidates.push(path);
    }
}

#[cfg(windows)]
fn paths_equal(a: &Path, b: &Path) -> bool {
    a.to_string_lossy()
        .eq_ignore_ascii_case(&b.to_string_lossy())
}

#[cfg(windows)]
fn resolve_shortcut(path: &Path) -> Result<(Option<PathBuf>, Option<PathBuf>), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::{Interface, PCWSTR};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile, CLSCTX_INPROC_SERVER,
        COINIT_APARTMENTTHREADED, STGM_READ,
    };
    use windows::Win32::UI::Shell::{IShellLinkW, ShellLink};

    let _guard = SHELL_ICON_LOCK
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);

    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let com_init = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let should_uninit = com_init.is_ok();

        let result = (|| {
            let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)
                .map_err(|error| format!("No se pudo crear IShellLink: {error}"))?;

            let persist: IPersistFile = link
                .cast()
                .map_err(|error| format!("No se pudo obtener IPersistFile: {error}"))?;

            persist
                .Load(PCWSTR::from_raw(wide.as_ptr()), STGM_READ)
                .map_err(|error| format!("No se pudo leer el acceso directo: {error}"))?;

            let mut target_buf = [0u16; 260];
            let _ = link.GetPath(&mut target_buf, std::ptr::null_mut(), 0);
            let target = wide_to_path(&target_buf);

            let mut icon_buf = [0u16; 260];
            let mut icon_index = 0i32;
            let _ = link.GetIconLocation(&mut icon_buf, &mut icon_index);
            let icon_file = wide_to_path(&icon_buf);

            Ok((target, icon_file))
        })();

        if should_uninit {
            CoUninitialize();
        }

        result
    }
}

#[cfg(windows)]
fn wide_to_path(buf: &[u16]) -> Option<PathBuf> {
    use std::os::windows::ffi::OsStringExt;

    let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    if len == 0 {
        return None;
    }
    let os = std::ffi::OsString::from_wide(&buf[..len]);
    let path = PathBuf::from(os);
    if path.as_os_str().is_empty() {
        None
    } else {
        Some(path)
    }
}

#[cfg(windows)]
fn extract_shell_icon(path: &Path, size: u32) -> Result<RgbaImage, String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::{Interface, PCWSTR};
    use windows::Win32::Foundation::SIZE;
    use windows::Win32::Graphics::Gdi::{DeleteObject, HGDIOBJ};
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
    use windows::Win32::UI::Shell::{
        IShellItem, IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_ICONONLY,
        SIIGBF_RESIZETOFIT,
    };

    let _guard = SHELL_ICON_LOCK
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);

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
                SHCreateItemFromParsingName(PCWSTR::from_raw(wide.as_ptr()), None)
                    .map_err(|error| format!("No se pudo abrir el elemento del Shell: {error}"))?;

            let factory: IShellItemImageFactory = item
                .cast()
                .map_err(|error| format!("No se pudo obtener la fábrica de iconos: {error}"))?;

            let flags = SIIGBF_ICONONLY | SIIGBF_RESIZETOFIT;
            let hbitmap = match factory.GetImage(
                SIZE {
                    cx: size as i32,
                    cy: size as i32,
                },
                flags,
            ) {
                Ok(bitmap) => bitmap,
                Err(_) => factory
                    .GetImage(
                        SIZE {
                            cx: size as i32,
                            cy: size as i32,
                        },
                        SIIGBF_RESIZETOFIT,
                    )
                    .map_err(|error| format!("No se pudo extraer el icono: {error}"))?,
            };

            let image_result = hbitmap_to_rgba(hbitmap.0);
            let _ = DeleteObject(HGDIOBJ(hbitmap.0));
            image_result
        })();

        if should_uninit {
            CoUninitialize();
        }

        result
    }
}

#[cfg(windows)]
unsafe fn hbitmap_to_rgba(hbitmap: *mut std::ffi::c_void) -> Result<RgbaImage, String> {
    use std::mem::MaybeUninit;
    use windows::Win32::Graphics::Gdi::{
        GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO, BITMAPINFOHEADER, BI_RGB,
        DIB_RGB_COLORS, HBITMAP, HGDIOBJ,
    };

    let bitmap_size_i32 = i32::try_from(std::mem::size_of::<BITMAP>())
        .map_err(|_| "Tamaño de BITMAP inválido.".to_string())?;
    let biheader_size_u32 = u32::try_from(std::mem::size_of::<BITMAPINFOHEADER>())
        .map_err(|_| "Tamaño de BITMAPINFOHEADER inválido.".to_string())?;

    let mut bitmap = MaybeUninit::<BITMAP>::uninit();
    let got = unsafe {
        GetObjectW(
            HGDIOBJ(hbitmap),
            bitmap_size_i32,
            Some(bitmap.as_mut_ptr().cast()),
        )
    };
    if got != bitmap_size_i32 {
        return Err("No se pudo leer el mapa de bits del icono.".into());
    }
    let bitmap = unsafe { bitmap.assume_init() };

    let width = bitmap.bmWidth.unsigned_abs();
    let height = bitmap.bmHeight.unsigned_abs();
    if width == 0 || height == 0 {
        return Err("El icono tiene dimensiones inválidas.".into());
    }

    let pixel_count = (width as usize)
        .checked_mul(height as usize)
        .ok_or_else(|| "Desbordamiento al calcular el tamaño del icono.".to_string())?;
    let mut pixels = vec![0u32; pixel_count];

    let dc = unsafe { GetDC(None) };
    if dc.is_invalid() {
        return Err("No se pudo obtener un contexto de dispositivo.".into());
    }

    let mut bitmap_info = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: biheader_size_u32,
            biWidth: bitmap.bmWidth,
            biHeight: -bitmap.bmHeight,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            biSizeImage: 0,
            biXPelsPerMeter: 0,
            biYPelsPerMeter: 0,
            biClrUsed: 0,
            biClrImportant: 0,
        },
        bmiColors: [Default::default()],
    };

    let lines = unsafe {
        GetDIBits(
            dc,
            HBITMAP(hbitmap),
            0,
            height,
            Some(pixels.as_mut_ptr().cast()),
            &mut bitmap_info,
            DIB_RGB_COLORS,
        )
    };
    unsafe {
        ReleaseDC(None, dc);
    }

    if lines == 0 || lines as u32 != height {
        return Err("No se pudieron leer los píxeles del icono.".into());
    }

    let rgba = pixels
        .iter()
        .flat_map(|px| {
            let bytes = px.to_le_bytes();
            // Shell HBITMAPs are typically premultiplied BGRA.
            unpremultiply_bgra(bytes[2], bytes[1], bytes[0], bytes[3])
        })
        .collect::<Vec<_>>();

    RgbaImage::from_raw(width, height, rgba)
        .ok_or_else(|| "No se pudo construir la imagen del icono.".into())
}

#[cfg(windows)]
fn unpremultiply_bgra(r: u8, g: u8, b: u8, a: u8) -> [u8; 4] {
    if a == 0 {
        return [0, 0, 0, 0];
    }
    if a == 255 {
        return [r, g, b, a];
    }
    let af = f32::from(a);
    let ur = ((f32::from(r) * 255.0) / af).round().clamp(0.0, 255.0) as u8;
    let ug = ((f32::from(g) * 255.0) / af).round().clamp(0.0, 255.0) as u8;
    let ub = ((f32::from(b) * 255.0) / af).round().clamp(0.0, 255.0) as u8;
    [ur, ug, ub, a]
}

#[cfg(windows)]
fn trim_transparent(image: RgbaImage, alpha_threshold: u8) -> RgbaImage {
    let (width, height) = image.dimensions();
    if width == 0 || height == 0 {
        return image;
    }

    let mut min_x = width;
    let mut min_y = height;
    let mut max_x = 0;
    let mut max_y = 0;
    let mut found = false;

    for y in 0..height {
        for x in 0..width {
            if image.get_pixel(x, y)[3] > alpha_threshold {
                found = true;
                min_x = min_x.min(x);
                min_y = min_y.min(y);
                max_x = max_x.max(x);
                max_y = max_y.max(y);
            }
        }
    }

    if !found {
        return image;
    }

    let crop_width = max_x - min_x + 1;
    let crop_height = max_y - min_y + 1;

    image::imageops::crop_imm(&image, min_x, min_y, crop_width, crop_height).to_image()
}

/// Scale icon to fill a square canvas (up or down) so tiles are not letterboxed tiny.
#[cfg(windows)]
fn fit_icon_to_canvas(image: RgbaImage, target_size: u32) -> RgbaImage {
    use image::imageops::{self, FilterType};

    let (width, height) = image.dimensions();
    if width == 0 || height == 0 {
        return image;
    }

    let largest = width.max(height).max(1);
    let scale = target_size as f32 / largest as f32;
    let next_width = ((width as f32 * scale).round() as u32).max(1);
    let next_height = ((height as f32 * scale).round() as u32).max(1);

    let fitted = if next_width == width && next_height == height {
        image
    } else {
        imageops::resize(&image, next_width, next_height, FilterType::Lanczos3)
    };

    let (fw, fh) = fitted.dimensions();
    if fw == target_size && fh == target_size {
        return fitted;
    }

    let mut canvas = RgbaImage::new(target_size, target_size);
    let offset_x = i64::from((target_size - fw) / 2);
    let offset_y = i64::from((target_size - fh) / 2);
    imageops::overlay(&mut canvas, &fitted, offset_x, offset_y);
    canvas
}

#[cfg(windows)]
fn icon_quality_score(image: &RgbaImage) -> u64 {
    let (width, height) = image.dimensions();
    let mut opaque: u64 = 0;
    let mut min_x = width;
    let mut min_y = height;
    let mut max_x = 0u32;
    let mut max_y = 0u32;

    for y in 0..height {
        for x in 0..width {
            if image.get_pixel(x, y)[3] > ALPHA_THRESHOLD {
                opaque += 1;
                min_x = min_x.min(x);
                min_y = min_y.min(y);
                max_x = max_x.max(x);
                max_y = max_y.max(y);
            }
        }
    }

    if opaque == 0 {
        return 0;
    }

    let bbox_w = u64::from(max_x.saturating_sub(min_x) + 1);
    let bbox_h = u64::from(max_y.saturating_sub(min_y) + 1);
    let largest = bbox_w.max(bbox_h);

    // Heavy weight on opaque density so a soft upscaled 100px ICO loses to a real exe icon.
    let density_bonus = if opaque >= MIN_USEFUL_OPAQUE {
        50_000
    } else {
        0
    };
    opaque.saturating_mul(10) + largest.saturating_mul(largest) + density_bonus
}

#[cfg(not(windows))]
pub fn get_file_icon(path: &str, size: Option<u32>) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("La ruta está vacía.".into());
    }

    let target_size = size.unwrap_or(128).clamp(32, 256);
    let cache_key = format!("{trimmed}\0{target_size}");

    if let Some(cached) = icon_result_cache().lock().ok().and_then(|guard| guard.get(&cache_key).cloned())
    {
        return cached;
    }

    let result = resolve_file_icon(trimmed, target_size);
    if let Ok(mut guard) = icon_result_cache().lock() {
        // Bound cache growth in long sessions.
        if guard.len() > 512 {
            guard.clear();
        }
        guard.insert(cache_key, result.clone());
    }
    result
}

#[cfg(not(windows))]
fn resolve_file_icon(trimmed: &str, target_size: u32) -> Result<String, String> {
    let path_buf = std::path::PathBuf::from(trimmed);

    if is_desktop_path(&path_buf) {
        return icon_from_desktop_file(&path_buf, target_size);
    }

    if is_raster_image_path(&path_buf) {
        return load_and_encode_raster(&path_buf, target_size);
    }

    if is_svg_path(&path_buf) {
        if let Some(png_sibling) = sibling_png(&path_buf) {
            return load_and_encode_raster(&png_sibling, target_size);
        }
        return Err("Los iconos SVG no están soportados.".into());
    }

    Err(format!("No se encontró un icono para: {trimmed}"))
}

#[cfg(not(windows))]
fn icon_result_cache() -> &'static std::sync::Mutex<std::collections::HashMap<String, Result<String, String>>>
{
    use std::collections::HashMap;
    use std::sync::{Mutex, OnceLock};

    static CACHE: OnceLock<Mutex<HashMap<String, Result<String, String>>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[cfg(not(windows))]
fn theme_icon_path_cache()
-> &'static std::sync::Mutex<std::collections::HashMap<String, Option<std::path::PathBuf>>> {
    use std::collections::HashMap;
    use std::sync::{Mutex, OnceLock};

    static CACHE: OnceLock<Mutex<HashMap<String, Option<std::path::PathBuf>>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[cfg(not(windows))]
fn encode_icon_png_base64(image: &image::RgbaImage) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use image::codecs::png::PngEncoder;
    use image::{ExtendedColorType, ImageEncoder};
    use std::io::Cursor;

    let mut buffer = Cursor::new(Vec::new());
    PngEncoder::new(&mut buffer)
        .write_image(
            image.as_raw(),
            image.width(),
            image.height(),
            ExtendedColorType::Rgba8,
        )
        .map_err(|error| format!("No se pudo codificar el icono: {error}"))?;

    Ok(STANDARD.encode(buffer.into_inner()))
}

#[cfg(not(windows))]
fn is_desktop_path(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("desktop"))
}

#[cfg(not(windows))]
fn is_raster_image_path(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| {
            matches!(
                ext.to_ascii_lowercase().as_str(),
                "png" | "jpg" | "jpeg"
            )
        })
}

#[cfg(not(windows))]
fn is_svg_path(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("svg"))
}

#[cfg(not(windows))]
fn sibling_png(path: &std::path::Path) -> Option<std::path::PathBuf> {
    let png = path.with_extension("png");
    if png.is_file() {
        Some(png)
    } else {
        None
    }
}

#[cfg(not(windows))]
fn icon_from_desktop_file(path: &std::path::Path, size: u32) -> Result<String, String> {
    if !path.is_file() {
        return Err(format!("No se encontró la ruta: {}", path.display()));
    }

    let icon = crate::app_search::read_desktop_icon_key(path)
        .ok_or_else(|| format!("No se encontró la clave Icon= en {}", path.display()))?;

    resolve_icon_name_or_path(&icon, size)
}

#[cfg(not(windows))]
fn resolve_icon_name_or_path(icon: &str, size: u32) -> Result<String, String> {
    let icon = icon.trim();
    if icon.is_empty() {
        return Err("La clave Icon= está vacía.".into());
    }

    let as_path = std::path::Path::new(icon);
    if as_path.is_absolute() {
        if is_raster_image_path(as_path) {
            return load_and_encode_raster(as_path, size);
        }
        if is_svg_path(as_path) {
            if let Some(png_sibling) = sibling_png(as_path) {
                return load_and_encode_raster(&png_sibling, size);
            }
            return Err("Los iconos SVG no están soportados.".into());
        }
        return Err(format!("Formato de icono no soportado: {icon}"));
    }

    // Theme icon name — strip optional extension for lookup.
    let name = std::path::Path::new(icon)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(icon);

    if let Some(found) = find_theme_icon(name) {
        return load_and_encode_raster(&found, size);
    }

    Err(format!("No se encontró el icono de tema: {icon}"))
}

#[cfg(not(windows))]
fn icon_search_roots() -> &'static [std::path::PathBuf] {
    use std::path::PathBuf;
    use std::sync::OnceLock;

    static ROOTS: OnceLock<Vec<PathBuf>> = OnceLock::new();
    ROOTS.get_or_init(|| {
        let mut roots = Vec::new();
        let mut push = |path: PathBuf| {
            if path.is_dir() && !roots.iter().any(|existing| existing == &path) {
                roots.push(path);
            }
        };

        if let Some(xdg_data_home) = std::env::var_os("XDG_DATA_HOME") {
            push(PathBuf::from(xdg_data_home).join("icons"));
        } else if let Some(home) = std::env::var_os("HOME") {
            push(PathBuf::from(home).join(".local").join("share").join("icons"));
        }

        if let Some(home) = std::env::var_os("HOME") {
            push(PathBuf::from(home).join(".icons"));
        }

        push(PathBuf::from("/usr/share/icons"));
        push(PathBuf::from("/usr/local/share/icons"));
        push(PathBuf::from("/usr/share/pixmaps"));
        push(PathBuf::from("/usr/local/share/pixmaps"));

        roots
    })
}

#[cfg(not(windows))]
fn find_theme_icon(name: &str) -> Option<std::path::PathBuf> {
    if let Ok(guard) = theme_icon_path_cache().lock() {
        if let Some(cached) = guard.get(name) {
            return cached.clone();
        }
    }

    // Prefer catalog-sized PNGs; skip scalable/SVG-heavy theme slots.
    let relative_candidates = [
        format!("hicolor/128x128/apps/{name}.png"),
        format!("hicolor/64x64/apps/{name}.png"),
        format!("hicolor/48x48/apps/{name}.png"),
        format!("hicolor/256x256/apps/{name}.png"),
        format!("hicolor/32x32/apps/{name}.png"),
        format!("Adwaita/48x48/apps/{name}.png"),
        format!("{name}.png"),
    ];

    let mut found = None;
    for root in icon_search_roots() {
        for relative in &relative_candidates {
            let candidate = root.join(relative);
            if candidate.is_file() {
                found = Some(candidate);
                break;
            }
        }
        if found.is_some() {
            break;
        }

        if root.ends_with("pixmaps") {
            let flat = root.join(format!("{name}.png"));
            if flat.is_file() {
                found = Some(flat);
                break;
            }
        }
    }

    if let Ok(mut guard) = theme_icon_path_cache().lock() {
        if guard.len() > 1024 {
            guard.clear();
        }
        guard.insert(name.to_string(), found.clone());
    }

    found
}

#[cfg(not(windows))]
fn load_and_encode_raster(path: &std::path::Path, size: u32) -> Result<String, String> {
    if !path.is_file() {
        return Err(format!("No se encontró la ruta: {}", path.display()));
    }

    let image = image::open(path)
        .map_err(|error| format!("No se pudo leer la imagen de icono: {error}"))?
        .to_rgba8();

    let (width, height) = image.dimensions();
    let image = if width != size || height != size {
        use image::imageops::{self, FilterType};
        // Triangle is much cheaper than Lanczos3 for catalog tiles.
        let largest = width.max(height).max(1);
        let scale = size as f32 / largest as f32;
        let next_width = ((width as f32 * scale).round() as u32).max(1);
        let next_height = ((height as f32 * scale).round() as u32).max(1);
        let fitted = imageops::resize(&image, next_width, next_height, FilterType::Triangle);
        let (fw, fh) = fitted.dimensions();
        if fw == size && fh == size {
            fitted
        } else {
            let mut canvas = image::RgbaImage::new(size, size);
            let offset_x = i64::from((size - fw) / 2);
            let offset_y = i64::from((size - fh) / 2);
            imageops::overlay(&mut canvas, &fitted, offset_x, offset_y);
            canvas
        }
    } else {
        image
    };

    encode_icon_png_base64(&image)
}

#[cfg(all(test, windows))]
mod tests {
    use super::parse_steam_app_id;

    #[test]
    fn parses_steam_rungameid_targets() {
        assert_eq!(
            parse_steam_app_id(r"steam:\\rungameid\2807960"),
            Some(2807960)
        );
        assert_eq!(
            parse_steam_app_id("steam://rungameid/2807960"),
            Some(2807960)
        );
        assert_eq!(parse_steam_app_id("uplay://launch/1"), None);
    }
}
