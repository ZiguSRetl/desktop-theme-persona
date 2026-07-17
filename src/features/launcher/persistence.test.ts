import { describe, expect, it } from "vitest";
import { makeLauncherItem } from "../../test/factories";
import { validatePersistedState, DEFAULT_SETTINGS } from "./persistence";

describe("validatePersistedState", () => {
  it("returns defaults for invalid payload", () => {
    const state = validatePersistedState(null);
    expect(state.schemaVersion).toBe(1);
    expect(state.settings.globalShortcut).toBe(DEFAULT_SETTINGS.globalShortcut);
    expect(state.items.length).toBeGreaterThan(0);
  });

  it("rejects unsupported schema versions", () => {
    expect(() =>
      validatePersistedState({ schemaVersion: 99, items: [], settings: {} }),
    ).toThrow(/99/);
  });

  it("drops corrupt items and seeds when none remain", () => {
    const state = validatePersistedState({
      schemaVersion: 1,
      items: [{ name: "", type: "application", target: "", category: "apps" }],
      settings: { windowMode: "invalid" },
    });

    expect(state.settings.windowMode).toBe("maximized");
    expect(state.items.length).toBeGreaterThan(0);
    expect(state.items.every((item) => item.name && item.target)).toBe(true);
  });

  it("keeps valid items and preserves optional fields", () => {
    const item = makeLauncherItem({
      id: "keep-me",
      name: "Steam",
      arguments: ["-silent"],
      icon: "data:image/png;base64,abc",
      accent: "#e60012",
    });

    const state = validatePersistedState({
      schemaVersion: 1,
      items: [item],
      settings: { soundEnabled: false, desktopMode: true },
    });

    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({
      id: "keep-me",
      arguments: ["-silent"],
      icon: "data:image/png;base64,abc",
      accent: "#e60012",
    });
    expect(state.settings.soundEnabled).toBe(false);
    expect(state.settings.desktopMode).toBe(true);
  });

  it("keeps valid wallpaper settings", () => {
    const state = validatePersistedState({
      schemaVersion: 1,
      items: [],
      settings: {
        wallpaper: {
          path: "C:\\\\app-data\\\\wallpaper.jpg",
          crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
        },
      },
    });

    expect(state.settings.wallpaper?.path).toContain("wallpaper.jpg");
    expect(state.settings.wallpaper?.crop.width).toBe(0.8);
  });

  it("keeps selectedGpuId when valid", () => {
    const state = validatePersistedState({
      schemaVersion: 1,
      items: [],
      settings: { selectedGpuId: "nvidia:GPU-abc" },
    });

    expect(state.settings.selectedGpuId).toBe("nvidia:GPU-abc");
  });

  it("drops empty selectedGpuId", () => {
    const state = validatePersistedState({
      schemaVersion: 1,
      items: [],
      settings: { selectedGpuId: "   " },
    });

    expect(state.settings.selectedGpuId).toBeUndefined();
  });

  it("defaults missing favoriteOrder from item index", () => {
    const state = validatePersistedState({
      schemaVersion: 1,
      items: [
        {
          id: "legacy",
          name: "Legacy",
          type: "application",
          target: "legacy.exe",
          category: "apps",
          favorite: true,
          order: 5,
        },
      ],
      settings: {},
    });

    expect(state.items[0]).toMatchObject({
      id: "legacy",
      favoriteOrder: 0,
      order: 5,
    });
  });

  it("keeps a supported language", () => {
    const state = validatePersistedState({
      schemaVersion: 1,
      items: [],
      settings: { language: "ja" },
    });

    expect(state.settings.language).toBe("ja");
  });

  it("falls back to en for unsupported language values", () => {
    const state = validatePersistedState({
      schemaVersion: 1,
      items: [],
      settings: { language: "pt-BR" },
    });

    expect(state.settings.language).toBe("en");
  });
});
