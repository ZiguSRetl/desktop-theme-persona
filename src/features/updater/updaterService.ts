import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

const LAST_CHECK_KEY = "p5-explorer:last-update-check";
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type AvailableUpdate = {
  version: string;
  body: string | null;
  date: string | null;
};

let pendingUpdate: Update | null = null;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function shouldAutoCheckUpdates(
  now = Date.now(),
  intervalMs = UPDATE_CHECK_INTERVAL_MS,
): boolean {
  if (typeof localStorage === "undefined") return true;
  const raw = localStorage.getItem(LAST_CHECK_KEY);
  const last = raw ? Number(raw) : 0;
  if (!Number.isFinite(last) || last <= 0) return true;
  return now - last >= intervalMs;
}

export function markUpdateCheckDone(now = Date.now()): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LAST_CHECK_KEY, String(now));
}

export function getPendingUpdateHandle(): Update | null {
  return pendingUpdate;
}

export function clearPendingUpdateHandle(): void {
  pendingUpdate = null;
}

export async function checkForAppUpdate(): Promise<AvailableUpdate | null> {
  if (!isTauri()) {
    clearPendingUpdateHandle();
    return null;
  }

  const update = await check();
  if (!update) {
    clearPendingUpdateHandle();
    return null;
  }

  pendingUpdate = update;
  return {
    version: update.version,
    body: update.body ?? null,
    date: update.date ?? null,
  };
}

export async function downloadAndInstallPendingUpdate(): Promise<void> {
  if (!isTauri()) {
    throw new Error("Updater only runs in the desktop app.");
  }
  if (!pendingUpdate) {
    throw new Error("No pending update to install.");
  }

  await pendingUpdate.downloadAndInstall();
  clearPendingUpdateHandle();
  await relaunch();
}
