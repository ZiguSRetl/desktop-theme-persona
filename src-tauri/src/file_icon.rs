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
pub fn get_file_icon(path: &str) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use image::codecs::png::PngEncoder;
    use image::{ExtendedColorType, ImageEncoder};
    use std::io::Cursor;

    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("La ruta está vacía.".into());
    }

    if !Path::new(trimmed).exists() {
        return Err(format!("No se encontró la ruta: {trimmed}"));
    }

    let candidates = icon_candidates(trimmed);
    let mut best: Option<(u64, RgbaImage)> = None;
    let mut last_error: Option<String> = None;

    for candidate in candidates {
        match extract_normalized_icon(&candidate) {
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
fn extract_normalized_icon(path: &Path) -> Result<RgbaImage, String> {
    let image = extract_shell_icon(path, TARGET_SIZE)?;
    let cropped = trim_transparent(image, ALPHA_THRESHOLD);
    Ok(fit_icon_to_canvas(cropped, TARGET_SIZE))
}

#[cfg(windows)]
fn icon_candidates(path: &str) -> Vec<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
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
            let hbitmap = factory
                .GetImage(
                    SIZE {
                        cx: size as i32,
                        cy: size as i32,
                    },
                    flags,
                )
                .map_err(|error| format!("No se pudo extraer el icono: {error}"))?;

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
pub fn get_file_icon(_path: &str) -> Result<String, String> {
    Err("Los iconos de archivo solo están disponibles en Windows.".into())
}
