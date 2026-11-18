import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { PersistedDesktopState } from "../../types/desktop";
import { tt } from "../../i18n";
import { useLauncherStore } from "./launcherStore";
import {
  createInitialState,
  loadFullState,
  saveFullState,
  validatePersistedState,
} from "./persistence";
import { useSettingsStore } from "../settings/settingsStore";
import { applyNativeSettings } from "../settings/nativeSettings";
import { isPrimaryWindow } from "../settings/monitorWindowsService";
import { applyWindowSettings } from "../settings/windowService";
import { withDesktopMode } from "../system/platform";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function buildCurrentState(): Promise<PersistedDesktopState> {
  const loaded = await loadFullState();
  if (loaded) return loaded;

  const launcherItems = useLauncherStore.getState().items;
  const settings = useSettingsStore.getState().settings;
  return createInitialState(launcherItems, settings);
}

export async function exportConfig(): Promise<string | null> {
  if (!isTauri()) {
    throw new Error(tt("services.configTransfer.exportDesktopOnly"));
  }

  const state = await buildCurrentState();
  const path = await save({
    defaultPath: "persona5-explorer-config.json",
    filters: [{ name: tt("services.configTransfer.filterJson"), extensions: ["json"] }],
    title: tt("services.configTransfer.exportTitle"),
  });

  if (!path) return null;

  await writeTextFile(path, JSON.stringify(state, null, 2));
  return path;
}

export async function importConfig(): Promise<PersistedDesktopState | null> {
  if (!isTauri()) {
    throw new Error(tt("services.configTransfer.importDesktopOnly"));
  }

  const current = await buildCurrentState();
  await saveFullState(current);

  const path = await open({
    multiple: false,
    filters: [{ name: tt("services.configTransfer.filterJson"), extensions: ["json"] }],
    title: tt("services.configTransfer.importTitle"),
  });

  if (!path || typeof path !== "string") return null;

  const raw = await readTextFile(path);
  const parsed = validatePersistedState(JSON.parse(raw));
  const primary = isPrimaryWindow();
  const actual = primary ? await applyNativeSettings(parsed.settings) : undefined;
  parsed.settings = withDesktopMode(parsed.settings, actual ?? parsed.settings.desktopMode);
  try {
    await saveFullState(parsed);
  } catch (error) {
    if (primary) await applyNativeSettings(current.settings);
    await applyWindowSettings(current.settings);
    throw error;
  }
  useLauncherStore.getState().hydrate(parsed.items);
  useSettingsStore.getState().hydrate(parsed.settings);
  await applyWindowSettings(parsed.settings);

  return parsed;
}

export { validatePersistedState };
