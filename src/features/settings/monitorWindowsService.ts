import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

const MAIN_WINDOW_LABEL = "main";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function isPrimaryWindow(): boolean {
  if (!isTauri()) return true;
  try {
    return getCurrentWindow().label === MAIN_WINDOW_LABEL;
  } catch {
    return true;
  }
}

export function getWindowLabel(): string {
  if (!isTauri()) return MAIN_WINDOW_LABEL;
  try {
    return getCurrentWindow().label;
  } catch {
    return MAIN_WINDOW_LABEL;
  }
}

export async function syncMonitorWindows(): Promise<void> {
  if (!isTauri() || !isPrimaryWindow()) return;
  await invoke("sync_monitor_windows");
}
