import { useEffect, useRef } from "react";
import { tSystem } from "../../i18n";
import { useLauncherStore } from "../launcher/launcherStore";
import { createInitialState, loadFullState } from "../launcher/persistence";
import { useIconBackfill } from "../launcher/useIconBackfill";
import { applyNativeSettings } from "../settings/nativeSettings";
import { isPrimaryWindow, syncMonitorWindows } from "../settings/monitorWindowsService";
import { applyWindowSettings } from "../settings/windowService";
import { useSettingsStore } from "../settings/settingsStore";
import { showLaunchError } from "./toastStore";

function reportStartupError(error: unknown, fallback: string) {
  const detail = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  showLaunchError(new Error(detail ? `${fallback} ${detail}` : fallback));
}

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

      let persisted: Awaited<ReturnType<typeof loadFullState>>;
      try {
        persisted = await loadFullState();
      } catch (error) {
        launcher.setStatus(
          "error",
          typeof error === "string"
            ? error
            : error instanceof Error ? error.message : tSystem("services.desktopInit.loadFailed"),
        );
        settings.hydrate(useSettingsStore.getState().settings);
        return;
      }

      const state = persisted ?? createInitialState();
      launcher.hydrate(state.items);
      settings.hydrate(state.settings);

      try {
        // Give the main window usable geometry before attempting to embed it.
        await applyWindowSettings(
          primary ? { ...state.settings, desktopMode: false } : state.settings,
        );
      } catch (error) {
        reportStartupError(error, tSystem("services.desktopInit.windowFailed"));
      }

      if (primary) {
        await applyNativeSettings(useSettingsStore.getState().settings);
        try {
          await syncMonitorWindows();
        } catch (error) {
          reportStartupError(error, tSystem("services.desktopInit.monitorsFailed"));
        }
      }
    })();
  }, []);
}

/** @deprecated Use useDesktopInit */
export const useLauncherInit = useDesktopInit;
