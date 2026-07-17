import type { WindowBounds, WindowMode } from "../../types/desktop";

/** Minimal monitor geometry (physical coords) — avoids coupling to Tauri class types. */
export interface MonitorRect {
  position: { x: number; y: number };
  size: { width: number; height: number };
  /** DPI scale; defaults to 1 when omitted (tests / callers without scale). */
  scaleFactor?: number;
}

/** Absolute outer position/size as saved — do not offset by monitor origin again. */
export function resolveRestorePosition(bounds: WindowBounds): { x: number; y: number } {
  return { x: bounds.x, y: bounds.y };
}

/** Place a window of the given physical size centered on the monitor (physical coords). */
export function centeredWindowOnMonitor(
  monitor: MonitorRect,
  width = 1280,
  height = 720,
): WindowBounds {
  const x = monitor.position.x + Math.max(0, Math.floor((monitor.size.width - width) / 2));
  const y = monitor.position.y + Math.max(0, Math.floor((monitor.size.height - height) / 2));
  return { x, y, width, height };
}

/**
 * Center a logical 1280×720 window using the monitor scale factor so
 * PhysicalSize/PhysicalPosition stay consistent on HiDPI displays.
 */
export function centeredLogicalWindowOnMonitor(
  monitor: MonitorRect,
  logicalWidth = 1280,
  logicalHeight = 720,
): WindowBounds {
  const scale = monitor.scaleFactor ?? 1;
  const width = Math.round(logicalWidth * scale);
  const height = Math.round(logicalHeight * scale);
  return centeredWindowOnMonitor(monitor, width, height);
}

export function shouldApplyWindowModeOnMonitor(mode: WindowMode): boolean {
  return mode === "window" || mode === "maximized" || mode === "fullscreen";
}

export function satelliteLabel(index: number): string {
  return `monitor-${index}`;
}

export function isPrimaryWindowLabel(label: string): boolean {
  return label === "main";
}
