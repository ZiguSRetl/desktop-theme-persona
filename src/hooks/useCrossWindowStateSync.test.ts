import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  loadFullState,
  applyWindowMode,
  applyWallpaperPassthrough,
  hydrateLauncher,
  hydrateSettings,
} = vi.hoisted(() => ({
  loadFullState: vi.fn(),
  applyWindowMode: vi.fn(async () => undefined),
  applyWallpaperPassthrough: vi.fn(async () => undefined),
  hydrateLauncher: vi.fn(),
  hydrateSettings: vi.fn(),
}));

vi.mock("../features/launcher/persistence", () => ({
  loadFullState,
}));

vi.mock("../features/launcher/launcherStore", () => ({
  useLauncherStore: {
    getState: () => ({ hydrate: hydrateLauncher }),
  },
}));

vi.mock("../features/settings/settingsStore", () => ({
  useSettingsStore: {
    getState: () => ({
      settings: { windowMode: "maximized", desktopMode: true },
      hydrate: hydrateSettings,
    }),
  },
}));

vi.mock("../features/settings/windowService", () => ({
  applyWindowMode,
  applyWallpaperPassthrough,
}));

vi.mock("../features/settings/monitorWindowsService", () => ({
  getWindowLabel: () => "main",
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => undefined),
}));

import { hydrateFromRemotePersist } from "./useCrossWindowStateSync";

describe("hydrateFromRemotePersist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates launcher and settings from disk", async () => {
    loadFullState.mockResolvedValue({
      schemaVersion: 1,
      items: [
        {
          id: "a",
          name: "A",
          type: "url",
          target: "https://a.test",
          category: "apps",
          favorite: false,
          order: 0,
          favoriteOrder: 0,
        },
      ],
      settings: {
        globalShortcut: "Ctrl+Space",
        launchOnStartup: true,
        soundEnabled: true,
        animationIntensity: "normal",
        closeBehavior: "hide",
        windowMode: "maximized",
        desktopMode: true,
        wallpaperPassthrough: true,
      },
    });

    await hydrateFromRemotePersist();

    expect(hydrateLauncher).toHaveBeenCalled();
    expect(hydrateSettings).toHaveBeenCalled();
    expect(applyWallpaperPassthrough).toHaveBeenCalledWith(true);
    expect(applyWindowMode).not.toHaveBeenCalled();
  });

  it("does not apply window mode while desktopMode is on", async () => {
    loadFullState.mockResolvedValue({
      schemaVersion: 1,
      items: [],
      settings: {
        globalShortcut: "Ctrl+Space",
        launchOnStartup: true,
        soundEnabled: true,
        animationIntensity: "normal",
        closeBehavior: "hide",
        windowMode: "fullscreen",
        desktopMode: true,
        wallpaperPassthrough: false,
      },
    });

    await hydrateFromRemotePersist();

    expect(applyWallpaperPassthrough).toHaveBeenCalledWith(false);
    expect(applyWindowMode).not.toHaveBeenCalled();
  });
});
