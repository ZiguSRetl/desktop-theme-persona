import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { WallpaperSettings } from "../../types/desktop";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const IMAGE_FILTERS = [{ name: "Imágenes", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"] }];

const dataUrlCache = new Map<string, string>();

export async function pickWallpaperImagePath(): Promise<string | null> {
  if (!isTauri()) {
    throw new Error("El fondo personalizado solo está disponible en la app de escritorio.");
  }

  const selected = await open({
    multiple: false,
    filters: IMAGE_FILTERS,
    title: "Elegir imagen de fondo",
  });

  if (!selected || typeof selected !== "string") return null;
  return selected;
}

export async function storeWallpaperImage(sourcePath: string): Promise<string> {
  const storedPath = await invoke<string>("save_wallpaper", { sourcePath });
  dataUrlCache.delete(sourcePath);
  dataUrlCache.delete(storedPath);
  return storedPath;
}

export async function deleteStoredWallpaper(): Promise<void> {
  if (!isTauri()) return;
  await invoke("remove_wallpaper");
  dataUrlCache.clear();
}

/** Load a local image path as a data URL usable in <img> / CSS backgrounds. */
export async function loadWallpaperDataUrl(path: string): Promise<string> {
  if (!path) return "";
  if (path.startsWith("data:") || path.startsWith("blob:") || path.startsWith("http")) {
    return path;
  }

  const cached = dataUrlCache.get(path);
  if (cached) return cached;

  if (!isTauri()) {
    throw new Error("El fondo personalizado solo está disponible en la app de escritorio.");
  }

  const dataUrl = await invoke<string>("load_image_data_url", { path });
  dataUrlCache.set(path, dataUrl);
  return dataUrl;
}

export function clearWallpaperDataUrlCache(path?: string): void {
  if (path) {
    dataUrlCache.delete(path);
    return;
  }
  dataUrlCache.clear();
}

export function isWallpaperConfigured(
  wallpaper: WallpaperSettings | undefined,
): wallpaper is WallpaperSettings {
  return Boolean(wallpaper?.path && wallpaper.crop);
}
