import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../launcher/persistence";

const {
  mergeAndSaveState,
  applyNativeSettings,
  applyWindowMode,
  applyWindowSettings,
  applyWallpaperPassthrough,
  deleteStoredWallpaper,
  isPrimaryWindow,
} = vi.hoisted(() => ({
  mergeAndSaveState: vi.fn(async () => undefined),
  applyNativeSettings: vi.fn(async () => undefined),
  applyWindowMode: vi.fn(async () => undefined),
  applyWindowSettings: vi.fn(async () => undefined),
  applyWallpaperPassthrough: vi.fn(async () => undefined),
  deleteStoredWallpaper: vi.fn(async () => undefined),
  isPrimaryWindow: vi.fn(() => true),
}));

vi.mock("../launcher/persistence", async () => {
  const actual = await vi.importActual<typeof import("../launcher/persistence")>(
    "../launcher/persistence",
  );
  return {
    ...actual,
    mergeAndSaveState,
  };
});

vi.mock("./nativeSettings", () => ({
  applyNativeSettings,
}));

vi.mock("./windowService", () => ({
  applyWindowMode,
  applyWindowSettings,
  applyWallpaperPassthrough,
}));

vi.mock("./wallpaperService", () => ({
  deleteStoredWallpaper,
}));

vi.mock("./monitorWindowsService", () => ({
  isPrimaryWindow,
}));

import { useSettingsStore } from "./settingsStore";

describe("useSettingsStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPrimaryWindow.mockReturnValue(true);
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS },
      status: "ready",
    });
  });

  it("ignores attempts to change desktopMode", async () => {
    await useSettingsStore.getState().updateSetting("desktopMode", false);

    expect(useSettingsStore.getState().settings.desktopMode).toBe(true);
    expect(mergeAndSaveState).not.toHaveBeenCalled();
    expect(applyNativeSettings).not.toHaveBeenCalled();
  });

  it("hydrates with desktopMode forced on", () => {
    useSettingsStore.getState().hydrate({
      ...DEFAULT_SETTINGS,
      desktopMode: false,
      soundEnabled: false,
    });

    expect(useSettingsStore.getState().settings.desktopMode).toBe(true);
    expect(useSettingsStore.getState().settings.soundEnabled).toBe(false);
  });

  it("does not apply window mode while desktopMode is active", async () => {
    await useSettingsStore.getState().updateSetting("windowMode", "fullscreen");

    expect(useSettingsStore.getState().settings.windowMode).toBe("fullscreen");
    expect(applyWindowMode).not.toHaveBeenCalled();
  });

  it("does not sync native settings for soundEnabled", async () => {
    await useSettingsStore.getState().updateSetting("soundEnabled", false);

    expect(useSettingsStore.getState().settings.soundEnabled).toBe(false);
    expect(applyNativeSettings).not.toHaveBeenCalled();
    expect(applyWindowMode).not.toHaveBeenCalled();
    expect(mergeAndSaveState).toHaveBeenCalledTimes(1);
  });

  it("applies wallpaper passthrough when toggled", async () => {
    await useSettingsStore.getState().updateSetting("wallpaperPassthrough", true);

    expect(useSettingsStore.getState().settings.wallpaperPassthrough).toBe(true);
    expect(applyWallpaperPassthrough).toHaveBeenCalledWith(true);
    expect(applyNativeSettings).not.toHaveBeenCalled();
  });

  it("syncs native settings when language changes", async () => {
    await useSettingsStore.getState().updateSetting("language", "de");

    expect(useSettingsStore.getState().settings.language).toBe("de");
    expect(applyNativeSettings).toHaveBeenCalledWith(
      expect.objectContaining({ language: "de", desktopMode: true }),
    );
  });

  it("skips native sync when not the primary window", async () => {
    isPrimaryWindow.mockReturnValue(false);

    await useSettingsStore.getState().updateSetting("language", "fr");

    expect(applyNativeSettings).not.toHaveBeenCalled();
  });

  it("resets to defaults and clears wallpaper", async () => {
    useSettingsStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        soundEnabled: false,
      },
      status: "ready",
    });

    await useSettingsStore.getState().resetToDefaults();

    expect(deleteStoredWallpaper).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.desktopMode).toBe(true);
    expect(applyNativeSettings).toHaveBeenCalledWith(DEFAULT_SETTINGS);
    expect(applyWindowSettings).toHaveBeenCalledWith(DEFAULT_SETTINGS);
  });
});
