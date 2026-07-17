import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import { loadFullState } from "../features/launcher/persistence";
import { useLauncherStore } from "../features/launcher/launcherStore";
import { useSettingsStore } from "../features/settings/settingsStore";
import { getWindowLabel } from "../features/settings/monitorWindowsService";
import { applyWindowMode } from "../features/settings/windowService";

export const PERSISTED_STATE_EVENT = "persisted-state-changed";

export interface PersistedStateChangedPayload {
  origin: string;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Apply disk state from another launcher window without echoing native side-effects. */
export async function hydrateFromRemotePersist(): Promise<void> {
  const persisted = await loadFullState();
  if (!persisted) return;

  const previousWindowMode = useSettingsStore.getState().settings.windowMode;
  useLauncherStore.getState().hydrate(persisted.items);
  useSettingsStore.getState().hydrate(persisted.settings);

  if (
    !persisted.settings.desktopMode &&
    persisted.settings.windowMode !== previousWindowMode
  ) {
    await applyWindowMode(persisted.settings.windowMode);
  }
}

export function useCrossWindowStateSync() {
  const ready = useRef(false);

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;
    const ownLabel = getWindowLabel();

    void listen<PersistedStateChangedPayload>(PERSISTED_STATE_EVENT, (event) => {
      if (event.payload?.origin === ownLabel) return;
      void hydrateFromRemotePersist();
    }).then((dispose) => {
      unlisten = dispose;
      ready.current = true;
    });

    return () => {
      unlisten?.();
    };
  }, []);
}
