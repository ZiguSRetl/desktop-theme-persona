import { invoke } from "@tauri-apps/api/core";
import type { LauncherItem, LauncherItemType } from "../../types/desktop";

/** Bump when native icon extraction quality changes to force backfill. */
export const ICON_QUALITY = 3;

const ICON_DATA_PREFIX = `data:image/png;p5q=${ICON_QUALITY};base64,`;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function toIconDataUrl(base64: string): string {
  if (base64.startsWith(ICON_DATA_PREFIX)) return base64;
  if (base64.startsWith("data:image/png;p5q=")) {
    const raw = base64.replace(/^data:image\/png;p5q=\d+;base64,/, "");
    return `${ICON_DATA_PREFIX}${raw}`;
  }
  if (base64.startsWith("data:image/png;base64,")) {
    return `${ICON_DATA_PREFIX}${base64.slice("data:image/png;base64,".length)}`;
  }
  if (base64.startsWith("data:")) return base64;
  return `${ICON_DATA_PREFIX}${base64}`;
}

/** Strip quality params so <img> gets a standard data URL. */
export function displayIconUrl(icon: string): string {
  return icon.replace(/^data:image\/png;p5q=\d+;base64,/, "data:image/png;base64,");
}

export function isCurrentQualityIcon(icon?: string): boolean {
  return Boolean(icon?.startsWith(ICON_DATA_PREFIX));
}

export async function fetchFileIcon(
  target: string,
  size?: number,
): Promise<string | undefined> {
  const path = target.trim();
  if (!path || !isTauri()) return undefined;

  try {
    const base64 = await invoke<string>("get_file_icon", {
      target: path,
      size: size ?? null,
    });
    return toIconDataUrl(base64);
  } catch {
    return undefined;
  }
}

export function supportsFileIcon(type: LauncherItemType): boolean {
  return type !== "url";
}

export function itemNeedsIcon(item: LauncherItem): boolean {
  if (!supportsFileIcon(item.type) || !item.target.trim()) return false;
  if (!item.icon) return true;
  return !isCurrentQualityIcon(item.icon);
}

/** @deprecated Prefer isCurrentQualityIcon — kept for callers that checked length. */
export function isLegacyIcon(icon?: string): boolean {
  return Boolean(icon && !isCurrentQualityIcon(icon));
}
