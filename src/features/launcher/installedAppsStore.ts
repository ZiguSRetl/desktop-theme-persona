import { create } from "zustand";
import {
  listInstalledApps,
  startInstalledAppsScan,
  subscribeInstalledAppsScan,
  type InstalledAppResult,
} from "./appSearchService";

interface InstalledAppsState {
  apps: InstalledAppResult[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  ensureLoaded: () => Promise<void>;
}

let ensureLoadedInFlight: Promise<void> | null = null;
let scanUnlisten: (() => void) | null = null;

export const useInstalledAppsStore = create<InstalledAppsState>((set, get) => ({
  apps: [],
  status: "idle",
  error: null,

  ensureLoaded: async () => {
    if (get().status === "ready") return;
    if (ensureLoadedInFlight) return ensureLoadedInFlight;

    ensureLoadedInFlight = (async () => {
      set({ status: "loading", error: null });
      try {
        scanUnlisten ??= await subscribeInstalledAppsScan({
          onUpdated: (apps) => {
            const current = get();
            if (current.status !== "ready" && apps.length >= current.apps.length) {
              set({ apps, status: "loading", error: null });
            }
          },
          onReady: (apps) => set({ apps, status: "ready", error: null }),
        });

        const cached = await listInstalledApps();
        const current = get();
        if (current.status !== "ready" && cached.length > current.apps.length) {
          set({ apps: cached });
        }
        await startInstalledAppsScan();
      } catch (error) {
        if (get().status !== "ready") {
          const message = error instanceof Error ? error.message : error;
          set({
            status: "error",
            error: typeof message === "string" ? message : "Failed to load apps",
          });
        }
      } finally {
        ensureLoadedInFlight = null;
      }
    })();

    return ensureLoadedInFlight;
  },
}));

export function __resetInstalledAppsScanForTests() {
  scanUnlisten?.();
  scanUnlisten = null;
  ensureLoadedInFlight = null;
}
