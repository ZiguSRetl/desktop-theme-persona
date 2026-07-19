import { create } from "zustand";
import {
  listInstalledApps,
  startInstalledAppsScan,
  subscribeInstalledAppsScan,
  type InstalledAppResult,
} from "./appSearchService";
import { fetchFileIcon } from "./iconService";

export type InstalledAppsStatus = "idle" | "loading" | "ready" | "error";
export type CatalogLayoutMode = "grid" | "list" | "listSplit" | "listRail";

export const CATALOG_LAYOUT_STORAGE_KEY = "p5.appsCatalogLayout";

const MAX_ICON_CONCURRENCY = 5;
/** Tile-friendly size — faster decode/encode on Linux FreeDesktop lookups. */
export const CATALOG_ICON_SIZE = 64;
/** One attempt: missing/SVG icons should not be retried (expensive theme walks). */
const MAX_ICON_ATTEMPTS = 1;

const LAYOUT_MODES: readonly CatalogLayoutMode[] = ["grid", "list", "listSplit", "listRail"];

export function parseCatalogLayoutMode(value: unknown): CatalogLayoutMode {
  if (typeof value === "string" && (LAYOUT_MODES as readonly string[]).includes(value)) {
    return value as CatalogLayoutMode;
  }
  return "grid";
}

function readStoredLayoutMode(): CatalogLayoutMode {
  if (typeof localStorage === "undefined") return "grid";
  try {
    return parseCatalogLayoutMode(localStorage.getItem(CATALOG_LAYOUT_STORAGE_KEY));
  } catch {
    return "grid";
  }
}

function writeStoredLayoutMode(mode: CatalogLayoutMode): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CATALOG_LAYOUT_STORAGE_KEY, mode);
  } catch {
    // Ignore quota / private mode failures.
  }
}

interface InstalledAppsState {
  apps: InstalledAppResult[];
  status: InstalledAppsStatus;
  error: string | null;
  loadedOnce: boolean;
  filterQuery: string;
  layoutMode: CatalogLayoutMode;
  iconsByPath: Record<string, string>;
  ensureLoaded: () => Promise<void>;
  refreshFromOs: () => Promise<void>;
  setFilterQuery: (query: string) => void;
  setLayoutMode: (mode: CatalogLayoutMode) => void;
  requestIcons: (paths: string[]) => void;
}

let ensureLoadedInFlight: Promise<void> | null = null;
let refreshInFlight: Promise<void> | null = null;
let scanUnlisten: (() => void) | null = null;
let scanSubscribed = false;

const iconQueued = new Set<string>();
const iconInFlight = new Set<string>();
const iconAttempts = new Map<string, number>();
const iconWaitQueue: string[] = [];

function pumpIconQueue(
  get: () => InstalledAppsState,
  set: (
    partial:
      | Partial<InstalledAppsState>
      | ((state: InstalledAppsState) => Partial<InstalledAppsState>),
  ) => void,
) {
  while (iconInFlight.size < MAX_ICON_CONCURRENCY && iconWaitQueue.length > 0) {
    const path = iconWaitQueue.shift();
    if (!path) continue;
    const attempts = iconAttempts.get(path) ?? 0;
    if (get().iconsByPath[path] || iconInFlight.has(path) || attempts >= MAX_ICON_ATTEMPTS) {
      iconQueued.delete(path);
      continue;
    }

    iconInFlight.add(path);
    iconAttempts.set(path, attempts + 1);
    void (async () => {
      try {
        const icon = await fetchFileIcon(path, CATALOG_ICON_SIZE);
        if (icon) {
          set((state) => ({
            iconsByPath: { ...state.iconsByPath, [path]: icon },
          }));
        }
      } finally {
        iconInFlight.delete(path);
        iconQueued.delete(path);
        pumpIconQueue(get, set);
      }
    })();
  }
}

async function ensureScanSubscription(
  set: (
    partial:
      | Partial<InstalledAppsState>
      | ((state: InstalledAppsState) => Partial<InstalledAppsState>),
  ) => void,
) {
  if (scanSubscribed) return;
  scanSubscribed = true;

  scanUnlisten = await subscribeInstalledAppsScan({
    onUpdated: (apps) => {
      // Avoid thrashing React on every progressive chunk: only adopt larger snapshots
      // while scanning, then finalize on ready.
      set((state) => {
        if (state.status === "ready" && state.apps.length >= apps.length) {
          return {};
        }
        if (apps.length < state.apps.length && state.apps.length > 0) {
          return {};
        }
        return {
          apps,
          loadedOnce: apps.length > 0,
          error: null,
          status: "loading" as const,
        };
      });
    },
    onReady: (apps) => {
      set({
        apps,
        loadedOnce: true,
        error: null,
        status: "ready",
      });
    },
  });
}

export const useInstalledAppsStore = create<InstalledAppsState>((set, get) => ({
  apps: [],
  status: "idle",
  error: null,
  loadedOnce: false,
  filterQuery: "",
  layoutMode: readStoredLayoutMode(),
  iconsByPath: {},

  setFilterQuery: (query) => {
    set({ filterQuery: query });
  },

  setLayoutMode: (mode) => {
    const next = parseCatalogLayoutMode(mode);
    writeStoredLayoutMode(next);
    set({ layoutMode: next });
  },

  requestIcons: (paths) => {
    for (const path of paths) {
      const trimmed = path.trim();
      if (!trimmed) continue;
      if (get().iconsByPath[trimmed]) continue;
      const attempts = iconAttempts.get(trimmed) ?? 0;
      if (attempts >= MAX_ICON_ATTEMPTS) continue;
      if (iconQueued.has(trimmed) || iconInFlight.has(trimmed)) continue;
      iconQueued.add(trimmed);
      iconWaitQueue.push(trimmed);
    }
    pumpIconQueue(get, set);
  },

  ensureLoaded: async () => {
    if (get().status === "ready" && get().loadedOnce) return;
    if (ensureLoadedInFlight) return ensureLoadedInFlight;

    ensureLoadedInFlight = (async () => {
      set({ status: "loading", error: null });
      try {
        await ensureScanSubscription(set);

        const cached = await listInstalledApps();
        if (cached.length > 0) {
          set({
            apps: cached,
            loadedOnce: true,
            error: null,
            status: get().status === "ready" ? "ready" : "loading",
          });
        }

        await startInstalledAppsScan(false);
      } catch (error) {
        set({
          status: get().loadedOnce ? get().status : "error",
          error: error instanceof Error ? error.message : "Failed to load apps",
        });
      } finally {
        ensureLoadedInFlight = null;
      }
    })();

    return ensureLoadedInFlight;
  },

  refreshFromOs: async () => {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
      const hadCache = get().loadedOnce;
      set({ status: "loading", error: hadCache ? get().error : null });
      iconAttempts.clear();

      try {
        await ensureScanSubscription(set);
        await startInstalledAppsScan(true);
      } catch (error) {
        set({
          status: hadCache ? "ready" : "error",
          error: error instanceof Error ? error.message : "Failed to refresh apps",
        });
      } finally {
        refreshInFlight = null;
      }
    })();

    return refreshInFlight;
  },
}));

/** Test helper — reset module-level scan subscription state. */
export function __resetInstalledAppsScanForTests() {
  scanUnlisten?.();
  scanUnlisten = null;
  scanSubscribed = false;
  ensureLoadedInFlight = null;
  refreshInFlight = null;
  iconQueued.clear();
  iconInFlight.clear();
  iconAttempts.clear();
  iconWaitQueue.length = 0;
}
