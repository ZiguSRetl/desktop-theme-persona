import { invoke } from "@tauri-apps/api/core";

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
