import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PersistedDesktopState } from "../../types/desktop";
import { makeLauncherItem, makeSettings } from "../../test/factories";
import { DEFAULT_SETTINGS } from "./persistence";

const loadFullState = vi.fn();
const saveFullState = vi.fn();
const applyNativeSettings = vi.fn();
const applyWindowSettings = vi.fn();
const openDialog = vi.fn();
const readTextFile = vi.fn();

vi.mock("./persistence", async () => {
  const actual = await vi.importActual<typeof import("./persistence")>("./persistence");
  return {
    ...actual,
    loadFullState: (...args: unknown[]) => loadFullState(...args),
    saveFullState: (...args: unknown[]) => saveFullState(...args),
  };
});

vi.mock("../settings/nativeSettings", () => ({
  applyNativeSettings: (...args: unknown[]) => applyNativeSettings(...args),
}));

vi.mock("../settings/monitorWindowsService", () => ({
  isPrimaryWindow: () => true,
}));

vi.mock("../settings/windowService", () => ({
  applyWindowSettings: (...args: unknown[]) => applyWindowSettings(...args),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => openDialog(...args),
  save: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: (...args: unknown[]) => readTextFile(...args),
  writeTextFile: vi.fn(),
}));

import { buildCurrentState, importConfig } from "./configTransfer";
import { useLauncherStore } from "./launcherStore";
import { useSettingsStore } from "../settings/settingsStore";

describe("buildCurrentState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLauncherStore.setState({
      items: [],
      status: "idle",
      error: null,
    });
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS },
      status: "idle",
    });
  });

  it("returns loaded persisted state when available", async () => {
    const loaded: PersistedDesktopState = {
      schemaVersion: 1,
      items: [makeLauncherItem({ id: "from-disk", name: "Disk" })],
      settings: makeSettings({ soundEnabled: false }),
    };
    loadFullState.mockResolvedValue(loaded);

    await expect(buildCurrentState()).resolves.toEqual(loaded);
  });

  it("builds from live stores when nothing is persisted", async () => {
    loadFullState.mockResolvedValue(null);
    const items = [makeLauncherItem({ id: "live", name: "Live" })];
    const settings = makeSettings({ windowMode: "fullscreen" });
    useLauncherStore.setState({ items, status: "ready", error: null });
    useSettingsStore.setState({ settings, status: "ready" });

    const state = await buildCurrentState();
    expect(state).toEqual({
      schemaVersion: 1,
      items,
      settings,
    });
  });
});

describe("importConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {},
      configurable: true,
    });
    useLauncherStore.setState({
      items: [makeLauncherItem({ id: "old" })],
      status: "ready",
      error: null,
    });
    useSettingsStore.setState({
      settings: makeSettings({ soundEnabled: true }),
      status: "ready",
    });
  });

  it("validates imported JSON, persists, hydrates stores, and applies native/window settings", async () => {
    const current: PersistedDesktopState = {
      schemaVersion: 1,
      items: useLauncherStore.getState().items,
      settings: useSettingsStore.getState().settings,
    };
    loadFullState.mockResolvedValue(current);
    saveFullState.mockResolvedValue(undefined);
    openDialog.mockResolvedValue("C:\\\\import\\\\config.json");

    const importedPayload = {
      schemaVersion: 1,
      items: [
        {
          id: "imported",
          name: "Imported App",
          type: "application",
          target: "imported.exe",
          category: "apps",
          favorite: true,
          order: 0,
        },
      ],
      settings: {
        soundEnabled: false,
        windowMode: "fullscreen",
        desktopMode: true,
      },
    };
    readTextFile.mockResolvedValue(JSON.stringify(importedPayload));
    applyNativeSettings.mockResolvedValue(undefined);
    applyWindowSettings.mockResolvedValue(undefined);

    const result = await importConfig();

    expect(result?.items[0]?.id).toBe("imported");
    expect(result?.settings.soundEnabled).toBe(false);
    expect(result?.settings.desktopMode).toBe(true);
    expect(useLauncherStore.getState().items[0]?.id).toBe("imported");
    expect(useSettingsStore.getState().settings.windowMode).toBe("fullscreen");
    expect(saveFullState).toHaveBeenCalled();
    expect(applyNativeSettings).toHaveBeenCalledWith(
      expect.objectContaining({ desktopMode: true, soundEnabled: false }),
    );
    expect(applyWindowSettings).toHaveBeenCalled();
  });
});
