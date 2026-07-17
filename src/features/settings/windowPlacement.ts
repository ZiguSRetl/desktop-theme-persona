import type { WindowBounds, WindowMode } from "../../types/desktop";

/** Minimal monitor geometry (physical coords) — avoids coupling to Tauri class types. */
export interface MonitorRect {
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/** Absolute outer position/size as saved — do not offset by monitor origin again. */
export function resolveRestorePosition(bounds: WindowBounds): { x: number; y: number } {
  return { x: bounds.x, y: bounds.y };
}

/** Place a 1280×720 window centered on the given monitor (physical coords). */
export function centeredWindowOnMonitor(
  monitor: MonitorRect,
  width = 1280,
  height = 720,
): WindowBounds {
  const x = monitor.position.x + Math.max(0, Math.floor((monitor.size.width - width) / 2));
  const y = monitor.position.y + Math.max(0, Math.floor((monitor.size.height - height) / 2));
  return { x, y, width, height };
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
