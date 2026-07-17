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
      settings: { ...DEFAULT_SETTINGS, launchOnStartup: false, desktopMode: false },
      status: "ready",
    });
  });

  it("forces launchOnStartup when enabling desktopMode", async () => {
    await useSettingsStore.getState().updateSetting("desktopMode", true);

    const settings = useSettingsStore.getState().settings;
    expect(settings.desktopMode).toBe(true);
    expect(settings.launchOnStartup).toBe(true);
    expect(mergeAndSaveState).toHaveBeenCalledWith({
      settings: expect.objectContaining({ desktopMode: true, launchOnStartup: true }),
    });
    expect(applyNativeSettings).toHaveBeenCalledWith(
      expect.objectContaining({ desktopMode: true, launchOnStartup: true }),
    );
    expect(applyWindowMode).not.toHaveBeenCalled();
  });

  it("applies window mode only for windowMode updates", async () => {
    await useSettingsStore.getState().updateSetting("windowMode", "fullscreen");

    expect(useSettingsStore.getState().settings.windowMode).toBe("fullscreen");
    expect(applyWindowMode).toHaveBeenCalledWith("fullscreen");
    expect(applyNativeSettings).not.toHaveBeenCalled();
  });

  it("does not apply window mode while desktopMode is active", async () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, desktopMode: true, launchOnStartup: true },
      status: "ready",
    });

    await useSettingsStore.getState().updateSetting("windowMode", "fullscreen");

    expect(useSettingsStore.getState().settings.windowMode).toBe("fullscreen");
    expect(applyWindowMode).not.toHaveBeenCalled();
  });

  it("re-applies window settings when leaving desktopMode", async () => {
    useSettingsStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        desktopMode: true,
        launchOnStartup: true,
        windowMode: "window",
      },
      status: "ready",
    });

    await useSettingsStore.getState().updateSetting("desktopMode", false);

    expect(applyNativeSettings).toHaveBeenCalledWith(
      expect.objectContaining({ desktopMode: false }),
    );
    expect(applyWindowSettings).toHaveBeenCalledWith(
      expect.objectContaining({ desktopMode: false, windowMode: "window" }),
    );
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
      expect.objectContaining({ language: "de" }),
    );
  });

  it("skips native sync when not the primary window", async () => {
    isPrimaryWindow.mockReturnValue(false);

    await useSettingsStore.getState().updateSetting("desktopMode", true);

    expect(applyNativeSettings).not.toHaveBeenCalled();
  });

  it("resets to defaults and clears wallpaper", async () => {
    useSettingsStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        soundEnabled: false,
        desktopMode: true,
        launchOnStartup: true,
      },
      status: "ready",
    });

    await useSettingsStore.getState().resetToDefaults();

    expect(deleteStoredWallpaper).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(applyNativeSettings).toHaveBeenCalledWith(DEFAULT_SETTINGS);
    expect(applyWindowSettings).toHaveBeenCalledWith(DEFAULT_SETTINGS);
  });
});
