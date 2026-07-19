export type LauncherItemType = "application" | "game" | "folder" | "url";

export interface LauncherItem {
  id: string;
  name: string;
  type: LauncherItemType;
  target: string;
  arguments?: string[];
  icon?: string;
  accent?: string;
  category: "apps" | "games" | "system";
  favorite: boolean;
  order: number;
  /** Sort position among favorites (Inicio); independent of category `order`. */
  favoriteOrder: number;
}

export type WindowMode = "window" | "maximized" | "fullscreen";

export type { AppLanguage } from "../i18n/types";
import type { AppLanguage } from "../i18n/types";

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Normalized crop region (0–1) relative to the source image. */
export interface WallpaperCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WallpaperSettings {
  path: string;
  crop: WallpaperCrop;
}

export interface DesktopSettings {
  globalShortcut: string;
  launchOnStartup: boolean;
  soundEnabled: boolean;
  animationIntensity: "reduced" | "normal" | "high";
  closeBehavior: "hide" | "exit";
  windowMode: WindowMode;
  /**
   * Desktop overlay shell. Forced on for Windows; always off on Linux/macOS
   * (WorkerW embed is Windows-only).
   */
  desktopMode: boolean;
  /**
   * Transparent window so the OS / Wallpaper Engine desktop shows through.
   * Disables in-app comic/custom wallpaper.
   */
  wallpaperPassthrough: boolean;
  /** UI language; initial value from OS, unsupported locales → `en`. */
  language: AppLanguage;
  /** Stable GPU id from `list_gpus`; omit/`undefined` = auto (prefer dedicated with metrics). */
  selectedGpuId?: string;
  lastMonitorIndex?: number;
  windowBounds?: WindowBounds;
  wallpaper?: WallpaperSettings;
}

export interface PersistedDesktopState {
  schemaVersion: 1;
  items: LauncherItem[];
  settings: DesktopSettings;
}

export interface SystemStats {
  cpuUsagePercent: number;
  cpuTemperatureCelsius?: number;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  osName: string;
  hostName: string;
  gpuName?: string;
  gpu?: {
    id: string;
    name: string;
    usagePercent?: number;
    vramUsedBytes?: number;
    vramTotalBytes?: number;
    temperatureCelsius?: number;
  } | null;
  timestamp?: number;
  disk?: {
    usagePercent: number;
    usedBytes: number;
    totalBytes: number;
    mountPoint: string;
  } | null;
  network?: {
    downloadBytesPerSecond: number;
    uploadBytesPerSecond: number;
  } | null;
}

export interface GpuDevice {
  id: string;
  name: string;
  vendor: string;
  supportsMetrics: boolean;
}
