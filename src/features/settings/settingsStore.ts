import { create } from "zustand";
import type { DesktopSettings } from "../../types/desktop";
import { createDefaultSettings, mergeAndSaveState } from "../launcher/persistence";
import { isPrimaryWindow } from "./monitorWindowsService";
import { applyNativeSettings } from "./nativeSettings";
import { applyWindowMode, applyWindowSettings } from "./windowService";
import { deleteStoredWallpaper } from "./wallpaperService";

const NATIVE_SETTING_KEYS = new Set<keyof DesktopSettings>([
  "globalShortcut",
  "launchOnStartup",
  "closeBehavior",
  "desktopMode",
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

  hydrate: (settings) => set({ settings: { ...settings }, status: "ready" }),

  updateSetting: async (key, value) => {
    let next = { ...get().settings, [key]: value };

    if (key === "desktopMode" && value === true) {
      next = { ...next, launchOnStartup: true };
    }

    await mergeAndSaveState({ settings: next });
    set({ settings: next });

    if (NATIVE_SETTING_KEYS.has(key) && isPrimaryWindow()) {
      await applyNativeSettings(next);
    }

    if (WINDOW_SETTING_KEYS.has(key)) {
      await applyWindowMode(next.windowMode);
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
