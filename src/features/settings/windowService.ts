import {
  availableMonitors,
  currentMonitor,
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize,
} from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { invoke } from "@tauri-apps/api/core";
import type { DesktopSettings, WindowBounds, WindowMode } from "../../types/desktop";
import { mergeAndSaveState } from "../launcher/persistence";
import { isLinuxHost } from "../system/platform";
import { isPrimaryWindow } from "./monitorWindowsService";
import { centeredLogicalWindowOnMonitor, resolveRestorePosition } from "./windowPlacement";

/** Matches `--color-black` when the shell is opaque. */
const OPAQUE_SHELL_COLOR = { red: 5, green: 5, blue: 5, alpha: 255 };
const TRANSPARENT_SHELL_COLOR = { red: 0, green: 0, blue: 0, alpha: 0 };

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function setDocumentPassthrough(enabled: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.wallpaperPassthrough = enabled ? "true" : "false";
}

/** Toggle CSS + native clear color so Wallpaper Engine / desktop shows through. */
export async function applyWallpaperPassthrough(enabled: boolean): Promise<void> {
  setDocumentPassthrough(enabled);

  if (!isTauri()) return;

  const color = enabled ? TRANSPARENT_SHELL_COLOR : OPAQUE_SHELL_COLOR;
  const window = getCurrentWindow();
  const webview = getCurrentWebview();

  try {
    await window.setBackgroundColor(color);
  } catch {
    // Older runtimes may lack the API; CSS still covers the common case.
  }

  try {
    await webview.setBackgroundColor(color);
  } catch {
    // Same as window — non-fatal when transparency APIs are unavailable.
  }
}

/**
 * Linux/Wayland: avoid Tauri `setFullscreen` (letterboxes / covers the dock).
 * Ask the compositor to maximize — that respects GNOME struts (top bar + dock).
 * Manual workArea setSize is unreliable on Ubuntu Dock/Wayland.
 */
async function applyLinuxCompositorMaximize(
  window: ReturnType<typeof getCurrentWindow>,
): Promise<void> {
  await window.setFullscreen(false);
  // Reset then maximize so a previous full-monitor setSize does not stick.
  await window.unmaximize();
  await window.maximize();
}

export async function applyWindowMode(mode: WindowMode): Promise<void> {
  if (!isTauri()) return;

  const window = getCurrentWindow();
  await window.setDecorations(false);

  const monitor = (await currentMonitor()) ?? (await availableMonitors())[0];
  if (!monitor) return;

  if (mode === "fullscreen") {
    if (isLinuxHost()) {
      await applyLinuxCompositorMaximize(window);
      return;
    }
    await window.unmaximize();
    await window.setFullscreen(true);
    return;
  }

  await window.setFullscreen(false);

  if (mode === "maximized") {
    if (isLinuxHost()) {
      await applyLinuxCompositorMaximize(window);
      return;
    }
    await window.maximize();
    return;
  }

  await window.unmaximize();
  const bounds = centeredLogicalWindowOnMonitor(monitor);
  await window.setSize(new PhysicalSize(bounds.width, bounds.height));
  await window.setPosition(new PhysicalPosition(bounds.x, bounds.y));
}

export async function saveWindowPlacement(settings: DesktopSettings): Promise<DesktopSettings> {
  if (!isTauri() || !isPrimaryWindow()) return settings;
  if (settings.windowMode !== "window") return settings;

  const window = getCurrentWindow();
  const monitor = await currentMonitor();
  const monitors = await availableMonitors();
  const position = await window.outerPosition();
  const size = await window.outerSize();

  const monitorIndex = monitor
    ? monitors.findIndex((entry) => entry.name === monitor.name)
    : settings.lastMonitorIndex ?? -1;

  const windowBounds: WindowBounds = {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
  };

  const next = {
    ...settings,
    lastMonitorIndex: monitorIndex >= 0 ? monitorIndex : settings.lastMonitorIndex,
    windowBounds,
  };

  await mergeAndSaveState({ settings: next });
  return next;
}

export async function restoreWindowPlacement(settings: DesktopSettings): Promise<void> {
  if (!isTauri()) return;

  const window = getCurrentWindow();

  if (
    isPrimaryWindow() &&
    settings.lastMonitorIndex !== undefined &&
    settings.lastMonitorIndex >= 0 &&
    settings.windowBounds &&
    settings.windowMode === "window"
  ) {
    const { x, y } = resolveRestorePosition(settings.windowBounds);
    await window.setFullscreen(false);
    await window.unmaximize();
    await window.setSize(
      new PhysicalSize(settings.windowBounds.width, settings.windowBounds.height),
    );
    await window.setPosition(new PhysicalPosition(x, y));
    return;
  }

  await applyWindowMode(settings.windowMode);
}

export async function hideMainWindow(): Promise<void> {
  if (!isTauri()) return;
  await invoke("hide_launcher_windows");
}

export async function applyWindowSettings(settings: DesktopSettings): Promise<void> {
  await applyWallpaperPassthrough(settings.wallpaperPassthrough);
  if (!isTauri() || settings.desktopMode) return;
  await restoreWindowPlacement(settings);
}
