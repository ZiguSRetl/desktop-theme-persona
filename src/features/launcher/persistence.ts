import { invoke } from "@tauri-apps/api/core";
import { detectSystemLanguage } from "../../i18n/detectLanguage";
import { isAppLanguage } from "../../i18n/types";
import { tSystem } from "../../i18n/translate";
import type {
  AppLanguage,
  DesktopSettings,
  LauncherItem,
  LauncherItemType,
  PersistedDesktopState,
  WallpaperCrop,
  WallpaperSettings,
  WindowBounds,
  WindowMode,
} from "../../types/desktop";
const STORAGE_KEY = "persona5-explorer-launcher-state";
const VALID_TYPES: LauncherItemType[] = ["application", "game", "folder", "url"];
const VALID_CATEGORIES = ["apps", "games", "system"] as const;
const VALID_WINDOW_MODES: WindowMode[] = ["window", "maximized", "fullscreen"];
const VALID_ANIMATION = ["reduced", "normal", "high"] as const;
const VALID_CLOSE = ["hide", "exit"] as const;

export function createDefaultSettings(): DesktopSettings {
  return {
    globalShortcut: "Ctrl+Space",
    launchOnStartup: false,
    soundEnabled: true,
    animationIntensity: "normal",
    closeBehavior: "hide",
    windowMode: "maximized",
    desktopMode: false,
    language: detectSystemLanguage(),
  };
}

/** Snapshot at module load; prefer `createDefaultSettings()` for fresh defaults. */
export const DEFAULT_SETTINGS: DesktopSettings = createDefaultSettings();

function resolveLanguage(raw: unknown): AppLanguage {
  if (typeof raw !== "string" || !raw.trim()) {
    return detectSystemLanguage();
  }
  if (isAppLanguage(raw)) return raw;
  return "en";
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function validateWindowBounds(raw: unknown): WindowBounds | undefined {
  if (!isRecord(raw)) return undefined;
  const x = asNumber(raw.x, NaN);
  const y = asNumber(raw.y, NaN);
  const width = asNumber(raw.width, NaN);
  const height = asNumber(raw.height, NaN);
  if ([x, y, width, height].some((n) => Number.isNaN(n))) return undefined;
  return { x, y, width, height };
}

function validateWallpaperCrop(raw: unknown): WallpaperCrop | undefined {
  if (!isRecord(raw)) return undefined;

  const x = asNumber(raw.x, NaN);
  const y = asNumber(raw.y, NaN);
  const width = asNumber(raw.width, NaN);
  const height = asNumber(raw.height, NaN);

  if ([x, y, width, height].some((n) => Number.isNaN(n))) return undefined;
  if (width <= 0 || height <= 0 || width > 1 || height > 1) return undefined;
  if (x < 0 || y < 0 || x + width > 1.001 || y + height > 1.001) return undefined;

  return { x, y, width, height };
}

function validateWallpaper(raw: unknown): WallpaperSettings | undefined {
  if (!isRecord(raw)) return undefined;

  const path = asString(raw.path, "").trim();
  const crop = validateWallpaperCrop(raw.crop);
  if (!path || !crop) return undefined;

  return { path, crop };
}

function validateLauncherItem(raw: unknown, index: number): LauncherItem | null {
  if (!isRecord(raw)) return null;

  const type = raw.type;
  const category = raw.category;
  if (!VALID_TYPES.includes(type as LauncherItemType)) return null;
  if (!VALID_CATEGORIES.includes(category as LauncherItem["category"])) return null;

  const name = asString(raw.name, "").trim();
  const target = asString(raw.target, "").trim();
  if (!name || !target) return null;

  const id = asString(raw.id, "").trim() || `recovered-${index}-${crypto.randomUUID()}`;

  return {
    id,
    name,
    type: type as LauncherItemType,
    target,
    category: category as LauncherItem["category"],
    favorite: asBoolean(raw.favorite, false),
    order: asNumber(raw.order, index),
    favoriteOrder: asNumber(raw.favoriteOrder, index),
    accent: typeof raw.accent === "string" ? raw.accent : undefined,
    icon: typeof raw.icon === "string" ? raw.icon : undefined,
    arguments: Array.isArray(raw.arguments)
      ? raw.arguments.filter((arg): arg is string => typeof arg === "string")
      : undefined,
  };
}

export function validateSettings(raw: unknown): DesktopSettings {
  const defaults = createDefaultSettings();
  if (!isRecord(raw)) return defaults;

  const animationIntensity = raw.animationIntensity;
  const closeBehavior = raw.closeBehavior;
  const windowMode = raw.windowMode;

  return {
    globalShortcut: asString(raw.globalShortcut, defaults.globalShortcut),
    launchOnStartup: asBoolean(raw.launchOnStartup, defaults.launchOnStartup),
    soundEnabled: asBoolean(raw.soundEnabled, defaults.soundEnabled),
    animationIntensity: VALID_ANIMATION.includes(
      animationIntensity as (typeof VALID_ANIMATION)[number],
    )
      ? (animationIntensity as DesktopSettings["animationIntensity"])
      : defaults.animationIntensity,
    closeBehavior: VALID_CLOSE.includes(closeBehavior as (typeof VALID_CLOSE)[number])
      ? (closeBehavior as DesktopSettings["closeBehavior"])
      : defaults.closeBehavior,
    windowMode: VALID_WINDOW_MODES.includes(windowMode as WindowMode)
      ? (windowMode as WindowMode)
      : defaults.windowMode,
    desktopMode: asBoolean(raw.desktopMode, defaults.desktopMode),
    language: resolveLanguage(raw.language),
    selectedGpuId:
      typeof raw.selectedGpuId === "string" && raw.selectedGpuId.trim()
        ? raw.selectedGpuId.trim()
        : undefined,
    lastMonitorIndex:
      typeof raw.lastMonitorIndex === "number" && raw.lastMonitorIndex >= 0
        ? raw.lastMonitorIndex
        : undefined,
    windowBounds: validateWindowBounds(raw.windowBounds),
    wallpaper: validateWallpaper(raw.wallpaper),
  };
}

export function validatePersistedState(raw: unknown): PersistedDesktopState {
  if (!isRecord(raw)) {
    return createInitialState();
  }

  const schemaVersion = raw.schemaVersion;
  if (schemaVersion !== 1) {
    throw new Error(
      tSystem("services.persistence.unsupportedSchema", { version: String(schemaVersion) }),
    );
  }

  const settings = validateSettings(raw.settings);
  const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
  const items = itemsRaw
    .map((item, index) => validateLauncherItem(item, index))
    .filter((item): item is LauncherItem => item !== null);

  return {
    schemaVersion: 1,
    items,
    settings,
  };
}

export function createInitialState(
  items?: LauncherItem[],
  settings?: DesktopSettings,
): PersistedDesktopState {
  const resolvedSettings = settings ?? createDefaultSettings();
  return {
    schemaVersion: 1,
    items: items ?? [],
    settings: { ...resolvedSettings },
  };
}

/** @deprecated Use createInitialState or mergeAndSaveState */
export function createPersistedState(items: LauncherItem[]): PersistedDesktopState {
  return createInitialState(items);
}

export async function loadFullState(): Promise<PersistedDesktopState | null> {
  if (!isTauri()) {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return validatePersistedState(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  const loaded = await invoke<PersistedDesktopState | null>("load_launcher_state");
  if (!loaded) return null;

  try {
    return validatePersistedState(loaded);
  } catch {
    return null;
  }
}

export async function saveFullState(state: PersistedDesktopState): Promise<void> {
  const validated = validatePersistedState(state);

  if (!isTauri()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
    return;
  }

  await invoke("save_launcher_state", { state: validated });
  await notifyPersistedStateChanged();
}

async function notifyPersistedStateChanged(): Promise<void> {
  try {
    const { emit } = await import("@tauri-apps/api/event");
    const { getWindowLabel } = await import("../settings/monitorWindowsService");
    await emit("persisted-state-changed", { origin: getWindowLabel() });
  } catch {
    // Sync is best-effort; persistence already succeeded.
  }
}

export async function mergeAndSaveState(
  patch: Partial<Pick<PersistedDesktopState, "items" | "settings">>,
): Promise<PersistedDesktopState> {
  const current = (await loadFullState()) ?? createInitialState();
  const next: PersistedDesktopState = {
    schemaVersion: 1,
    items: patch.items ?? current.items,
    settings: patch.settings
      ? validateSettings({ ...current.settings, ...patch.settings })
      : current.settings,
  };

  await saveFullState(next);
  return next;
}

/** @deprecated Use loadFullState */
export const loadPersistedState = loadFullState;

/** @deprecated Use saveFullState */
export const savePersistedState = saveFullState;
