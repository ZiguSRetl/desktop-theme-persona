import type { LauncherItem } from "../../types/desktop";
import type { InstalledAppResult } from "./appSearchService";

export function filterInstalledApps(
  apps: InstalledAppResult[],
  query: string,
): InstalledAppResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return apps;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return apps;

  return apps.filter((app) => {
    const haystack = `${app.name} ${app.path} ${app.source}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

export function normalizeLauncherTarget(target: string): string {
  return target.trim().replace(/\//g, "\\").toLowerCase();
}

export function findLauncherItemByTarget(
  items: LauncherItem[],
  target: string,
): LauncherItem | undefined {
  const needle = normalizeLauncherTarget(target);
  if (!needle) return undefined;
  return items.find((item) => normalizeLauncherTarget(item.target) === needle);
}

export function catalogAppCategory(app: InstalledAppResult): LauncherItem["category"] {
  const path = app.path.trim().toLowerCase();
  if (
    path.startsWith("steam:") ||
    path.startsWith("uplay:") ||
    path.startsWith("com.epicgames.launcher:") ||
    path.startsWith("origin:") ||
    path.startsWith("xbox:")
  ) {
    return "games";
  }
  return "apps";
}
