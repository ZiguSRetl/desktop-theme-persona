import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { PersistedDesktopState } from "../../types/desktop";
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
    throw new Error("La exportación solo está disponible en la app de escritorio.");
  }

  const state = await buildCurrentState();
  const path = await save({
    defaultPath: "persona5-explorer-config.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
    title: "Exportar configuración",
  });

  if (!path) return null;

  await writeTextFile(path, JSON.stringify(state, null, 2));
  return path;
}

export async function importConfig(): Promise<PersistedDesktopState | null> {
  if (!isTauri()) {
    throw new Error("La importación solo está disponible en la app de escritorio.");
  }

  const current = await buildCurrentState();
  await saveFullState(current);

  const path = await open({
    multiple: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
    title: "Importar configuración",
  });

  if (!path || typeof path !== "string") return null;

  const raw = await readTextFile(path);
  const parsed = validatePersistedState(JSON.parse(raw));

  await saveFullState(parsed);
  useLauncherStore.getState().hydrate(parsed.items);
  useSettingsStore.getState().hydrate(parsed.settings);

  if (isPrimaryWindow()) {
    await applyNativeSettings(parsed.settings);
  }
  await applyWindowSettings(parsed.settings);

  return parsed;
}

export { validatePersistedState };
