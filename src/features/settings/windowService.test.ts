import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSettings } from "../../test/factories";

const {
  setDecorations,
  setFullscreen,
  maximize,
  unmaximize,
  setSize,
  setPosition,
  setBackgroundColor,
  setWebviewBackgroundColor,
  outerPosition,
  outerSize,
  currentMonitor,
  availableMonitors,
  mergeAndSaveState,
  isPrimaryWindow,
  PhysicalSize,
  PhysicalPosition,
} = vi.hoisted(() => {
  class PhysicalSize {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
  }
  class PhysicalPosition {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  }

  return {
    setDecorations: vi.fn(async () => undefined),
    setFullscreen: vi.fn(async () => undefined),
    maximize: vi.fn(async () => undefined),
    unmaximize: vi.fn(async () => undefined),
    setSize: vi.fn(async () => undefined),
    setPosition: vi.fn(async () => undefined),
    setBackgroundColor: vi.fn(async () => undefined),
    setWebviewBackgroundColor: vi.fn(async () => undefined),
    outerPosition: vi.fn(async () => ({ x: 100, y: 80 })),
    outerSize: vi.fn(async () => ({ width: 1280, height: 720 })),
    currentMonitor: vi.fn(),
    availableMonitors: vi.fn(),
    mergeAndSaveState: vi.fn(async () => undefined),
    isPrimaryWindow: vi.fn(() => true),
    PhysicalSize,
    PhysicalPosition,
  };
});

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setDecorations,
    setFullscreen,
    maximize,
    unmaximize,
    setSize,
    setPosition,
    outerPosition,
    outerSize,
    setBackgroundColor,
  }),
  currentMonitor,
  availableMonitors,
  PhysicalSize,
  PhysicalPosition,
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    setBackgroundColor: setWebviewBackgroundColor,
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
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

vi.mock("./monitorWindowsService", () => ({
  isPrimaryWindow,
}));

vi.mock("../system/platform", async () => {
  const actual = await vi.importActual<typeof import("../system/platform")>(
    "../system/platform",
  );
  return {
    ...actual,
    isLinuxHost: vi.fn(() => false),
  };
});

import {
  applyWallpaperPassthrough,
  applyWindowMode,
  applyWindowSettings,
  saveWindowPlacement,
} from "./windowService";
import { isLinuxHost } from "../system/platform";

const MONITOR = {
  name: "Display 1",
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
  workArea: {
    position: { x: 0, y: 32 },
    size: { width: 1920, height: 980 },
  },
  scaleFactor: 1,
};

describe("windowService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as unknown as { __TAURI_INTERNALS__: object }).__TAURI_INTERNALS__ = {};
    currentMonitor.mockResolvedValue(MONITOR);
    availableMonitors.mockResolvedValue([MONITOR]);
    isPrimaryWindow.mockReturnValue(true);
    vi.mocked(isLinuxHost).mockReturnValue(false);
  });

  it("fullscreen unmaximizes before setFullscreen and does not pre-size", async () => {
    await applyWindowMode("fullscreen");

    expect(setDecorations).toHaveBeenCalledWith(false);
    expect(unmaximize).toHaveBeenCalled();
    expect(setFullscreen).toHaveBeenCalledWith(true);
    expect(setSize).not.toHaveBeenCalled();
    expect(maximize).not.toHaveBeenCalled();
    const unmaximizeOrder = unmaximize.mock.invocationCallOrder[0];
    const fullscreenOrder = setFullscreen.mock.invocationCallOrder[0];
    expect(unmaximizeOrder).toBeLessThan(fullscreenOrder);
  });

  it("Linux fullscreen maximizes via compositor instead of setFullscreen/setSize", async () => {
    vi.mocked(isLinuxHost).mockReturnValue(true);

    await applyWindowMode("fullscreen");

    expect(setFullscreen).toHaveBeenCalledWith(false);
    expect(unmaximize).toHaveBeenCalled();
    expect(maximize).toHaveBeenCalled();
    expect(setSize).not.toHaveBeenCalled();
    expect(setPosition).not.toHaveBeenCalled();
  });

  it("maximized only maximizes without full-monitor setSize", async () => {
    await applyWindowMode("maximized");

    expect(setFullscreen).toHaveBeenCalledWith(false);
    expect(maximize).toHaveBeenCalled();
    expect(setSize).not.toHaveBeenCalled();
    expect(setPosition).not.toHaveBeenCalled();
  });

  it("window mode clears fullscreen/maximize then centers physical size", async () => {
    await applyWindowMode("window");

    expect(setFullscreen).toHaveBeenCalledWith(false);
    expect(unmaximize).toHaveBeenCalled();
    expect(setSize).toHaveBeenCalledWith(expect.objectContaining({ width: 1280, height: 720 }));
    expect(setPosition).toHaveBeenCalledWith(
      expect.objectContaining({
        x: Math.floor((1920 - 1280) / 2),
        y: Math.floor((1080 - 720) / 2),
      }),
    );
  });

  it("applyWindowSettings no-ops when desktopMode is on", async () => {
    await applyWindowSettings(makeSettings({ desktopMode: true, windowMode: "window" }));

    expect(setFullscreen).not.toHaveBeenCalled();
    expect(maximize).not.toHaveBeenCalled();
    expect(setSize).not.toHaveBeenCalled();
    expect(setBackgroundColor).toHaveBeenCalled();
  });

  it("applyWallpaperPassthrough sets transparent document and clear colors", async () => {
    await applyWallpaperPassthrough(true);

    expect(document.documentElement.dataset.wallpaperPassthrough).toBe("true");
    expect(setBackgroundColor).toHaveBeenCalledWith({
      red: 0,
      green: 0,
      blue: 0,
      alpha: 0,
    });
    expect(setWebviewBackgroundColor).toHaveBeenCalledWith({
      red: 0,
      green: 0,
      blue: 0,
      alpha: 0,
    });
  });

  it("applyWallpaperPassthrough restores opaque shell colors when off", async () => {
    await applyWallpaperPassthrough(false);

    expect(document.documentElement.dataset.wallpaperPassthrough).toBe("false");
    expect(setBackgroundColor).toHaveBeenCalledWith({
      red: 5,
      green: 5,
      blue: 5,
      alpha: 255,
    });
  });

  it("saveWindowPlacement skips when not in window mode", async () => {
    const settings = makeSettings({ windowMode: "maximized" });
    const next = await saveWindowPlacement(settings);

    expect(next).toBe(settings);
    expect(mergeAndSaveState).not.toHaveBeenCalled();
    expect(outerPosition).not.toHaveBeenCalled();
  });

  it("saveWindowPlacement persists bounds only in window mode", async () => {
    const settings = makeSettings({ windowMode: "window" });
    const next = await saveWindowPlacement(settings);

    expect(mergeAndSaveState).toHaveBeenCalledWith({
      settings: expect.objectContaining({
        windowBounds: { x: 100, y: 80, width: 1280, height: 720 },
        lastMonitorIndex: 0,
      }),
    });
    expect(next.windowBounds).toEqual({ x: 100, y: 80, width: 1280, height: 720 });
  });
});
