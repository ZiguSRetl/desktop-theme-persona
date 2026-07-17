import {
  availableMonitors,
  currentMonitor,
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
  PhysicalSize,
} from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import type { DesktopSettings, WindowBounds, WindowMode } from "../../types/desktop";
import { mergeAndSaveState } from "../launcher/persistence";
import { isPrimaryWindow } from "./monitorWindowsService";
import { centeredWindowOnMonitor, resolveRestorePosition } from "./windowPlacement";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function applyWindowMode(mode: WindowMode): Promise<void> {
  if (!isTauri()) return;

  const window = getCurrentWindow();
  await window.setDecorations(false);

  const monitor = (await currentMonitor()) ?? (await availableMonitors())[0];
  if (!monitor) return;

  if (mode === "fullscreen") {
    await window.setPosition(new PhysicalPosition(monitor.position.x, monitor.position.y));
    await window.setSize(new PhysicalSize(monitor.size.width, monitor.size.height));
    await window.setFullscreen(true);
    return;
  }

  await window.setFullscreen(false);

  if (mode === "maximized") {
    await window.setPosition(new PhysicalPosition(monitor.position.x, monitor.position.y));
    await window.setSize(new PhysicalSize(monitor.size.width, monitor.size.height));
    await window.maximize();
    return;
  }

  await window.unmaximize();
  const bounds = centeredWindowOnMonitor(monitor);
  await window.setSize(new LogicalSize(1280, 720));
  await window.setPosition(new PhysicalPosition(bounds.x, bounds.y));
}

export async function saveWindowPlacement(settings: DesktopSettings): Promise<DesktopSettings> {
  if (!isTauri() || !isPrimaryWindow()) return settings;

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
  if (!isTauri() || settings.desktopMode) return;
  await restoreWindowPlacement(settings);
}
