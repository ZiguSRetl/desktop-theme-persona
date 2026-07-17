import { useEffect, useRef } from "react";
import { tSystem } from "../../i18n";
import { createSeedLauncherItems } from "../launcher/defaultItems";
import { useLauncherStore } from "../launcher/launcherStore";
import {
  createInitialState,
  loadFullState,
  saveFullState,
} from "../launcher/persistence";
import { useIconBackfill } from "../launcher/useIconBackfill";
import { applyNativeSettings } from "../settings/nativeSettings";
import { isPrimaryWindow, syncMonitorWindows } from "../settings/monitorWindowsService";
import { applyWindowSettings } from "../settings/windowService";
import { useSettingsStore } from "../settings/settingsStore";

export function useDesktopInit() {
  const started = useRef(false);
  useIconBackfill();

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      const launcher = useLauncherStore.getState();
      const settings = useSettingsStore.getState();
      const primary = isPrimaryWindow();

      if (launcher.status !== "idle" && settings.status === "ready") return;

      launcher.setStatus("loading");

      try {
        if (primary) {
          await syncMonitorWindows();
        }

        const persisted = await loadFullState();

        if (persisted?.items?.length) {
          launcher.hydrate(persisted.items);
          settings.hydrate(persisted.settings);
          if (primary) {
            await applyNativeSettings(persisted.settings);
          }
          await applyWindowSettings(persisted.settings);
          return;
        }

        const initial = createInitialState(createSeedLauncherItems());
        if (primary) {
          await saveFullState(initial);
        }
        launcher.hydrate(initial.items);
        settings.hydrate(initial.settings);
        if (primary) {
          await applyNativeSettings(initial.settings);
        }
        await applyWindowSettings(initial.settings);
      } catch (error) {
        launcher.setStatus(
          "error",
          error instanceof Error ? error.message : tSystem("services.desktopInit.loadFailed"),
        );
        settings.hydrate(useSettingsStore.getState().settings);
      }
    })();
  }, []);
}

/** @deprecated Use useDesktopInit */
export const useLauncherInit = useDesktopInit;
