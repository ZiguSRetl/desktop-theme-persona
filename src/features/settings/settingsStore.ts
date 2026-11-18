import { create } from "zustand";
import type { DesktopSettings } from "../../types/desktop";
import { createDefaultSettings, mergeAndSaveState } from "../launcher/persistence";
import { isWindowsHost, withDesktopMode, withPlatformDesktopMode } from "../system/platform";
import { isPrimaryWindow } from "./monitorWindowsService";
import { applyNativeSettings } from "./nativeSettings";
import {
  applyWallpaperPassthrough,
  applyWindowMode,
  applyWindowSettings,
} from "./windowService";
import { deleteStoredWallpaper } from "./wallpaperService";

const NATIVE_SETTING_KEYS = new Set<keyof DesktopSettings>([
  "globalShortcut",
  "launchOnStartup",
  "closeBehavior",
  "language",
]);

const WINDOW_SETTING_KEYS = new Set<keyof DesktopSettings>(["windowMode"]);

interface SettingsStore {
  settings: DesktopSettings;
  status: "idle" | "ready";
  hydrate: (settings: DesktopSettings) => void;
  updateSetting: <K extends keyof DesktopSettings>(
    key: K,
    value: DesktopSettings[K],
  ) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: createDefaultSettings(),
  status: "idle",

  hydrate: (settings) =>
    set({ settings: withPlatformDesktopMode(settings), status: "ready" }),

  updateSetting: async (key, value) => {
    const previous = get().settings;
    if (key === "desktopMode") {
      if (!isWindowsHost() || !isPrimaryWindow() || previous.desktopMode === value) return;
      const next = withDesktopMode(previous, Boolean(value));
      const actual = await applyNativeSettings(next);
      const resolved = withDesktopMode(get().settings, actual ?? next.desktopMode);
      try {
        await mergeAndSaveState({
          settings: { desktopMode: resolved.desktopMode, desktopModeOptIn: resolved.desktopModeOptIn },
        });
      } catch (error) {
        await applyNativeSettings(previous);
        await applyWindowSettings(previous);
        throw error;
      }
      set({ settings: withDesktopMode(get().settings, resolved.desktopMode) });
      await applyWindowSettings(get().settings);
      return;
    }

    const next = withPlatformDesktopMode({ ...previous, [key]: value });

    await mergeAndSaveState({ settings: { [key]: value } });
    set({ settings: withPlatformDesktopMode({ ...get().settings, [key]: value }) });

    if (NATIVE_SETTING_KEYS.has(key) && isPrimaryWindow()) {
      await applyNativeSettings(next);
    }

    // Window mode only applies outside desktop overlay.
    if (WINDOW_SETTING_KEYS.has(key) && !next.desktopMode) {
      if (next.windowMode === "window") await applyWindowSettings(next);
      else await applyWindowMode(next.windowMode);
    }

    if (key === "wallpaperPassthrough") {
      await applyWallpaperPassthrough(next.desktopMode && Boolean(value));
    }
  },

  resetToDefaults: async () => {
    const defaults = createDefaultSettings();
    await deleteStoredWallpaper();
    await mergeAndSaveState({ settings: defaults });
    set({ settings: defaults });
    if (isPrimaryWindow()) {
      await applyNativeSettings(defaults);
    }
    await applyWindowSettings(defaults);
  },
}));

export function useSetting<K extends keyof DesktopSettings>(key: K): DesktopSettings[K] {
  return useSettingsStore((state) => state.settings[key]);
}
