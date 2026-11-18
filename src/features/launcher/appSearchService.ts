import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface InstalledAppResult {
  name: string;
  path: string;
  source: string;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function searchInstalledApps(
  query: string,
  limit = 12,
): Promise<InstalledAppResult[]> {
  if (!isTauri()) return [];

  try {
    return await invoke<InstalledAppResult[]>("search_installed_apps", { query, limit });
  } catch {
    return [];
  }
}

export async function listInstalledApps(): Promise<InstalledAppResult[]> {
  if (!isTauri()) {
    throw new Error("Installed apps are only available in the desktop app.");
  }

  return invoke<InstalledAppResult[]>("list_installed_apps");
}

export async function startInstalledAppsScan(): Promise<void> {
  if (!isTauri()) {
    throw new Error("Installed apps are only available in the desktop app.");
  }

  await invoke("start_installed_apps_scan");
}

export async function subscribeInstalledAppsScan(handlers: {
  onUpdated: (apps: InstalledAppResult[]) => void;
  onReady: (apps: InstalledAppResult[]) => void;
}): Promise<() => void> {
  if (!isTauri()) {
    return () => undefined;
  }

  const stopUpdated = await listen<InstalledAppResult[]>("installed-apps-updated", (event) => {
    handlers.onUpdated(event.payload ?? []);
  });
  try {
    const stopReady = await listen<InstalledAppResult[]>("installed-apps-ready", (event) => {
      handlers.onReady(event.payload ?? []);
    });
    return () => {
      stopUpdated();
      stopReady();
    };
  } catch (error) {
    stopUpdated();
    throw error;
  }
}
