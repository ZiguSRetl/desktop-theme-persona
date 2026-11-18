import { useEffect, useRef } from "react";
import { tSystem } from "../../i18n";
import { useLauncherStore } from "../launcher/launcherStore";
import { createInitialState, loadFullState, mergeAndSaveState } from "../launcher/persistence";
import { useIconBackfill } from "../launcher/useIconBackfill";
import { applyNativeSettings } from "../settings/nativeSettings";
import { isPrimaryWindow, syncMonitorWindows } from "../settings/monitorWindowsService";
import { applyWallpaperPassthrough, applyWindowSettings } from "../settings/windowService";
import { useSettingsStore } from "../settings/settingsStore";
import { withDesktopMode } from "../system/platform";
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
        if (primary) {
          await applyWindowSettings({ ...state.settings, desktopMode: false });
        } else {
          await applyWallpaperPassthrough(state.settings.desktopMode && state.settings.wallpaperPassthrough);
        }
      } catch (error) {
        reportStartupError(error, tSystem("services.desktopInit.windowFailed"));
      }

      if (primary) {
        const current = useSettingsStore.getState().settings;
        const actual = await applyNativeSettings(current);
        if (current.desktopMode) {
          const resolved = withDesktopMode(useSettingsStore.getState().settings, actual ?? true);
          settings.hydrate(resolved);
          await applyWindowSettings(resolved).catch((error: unknown) =>
            reportStartupError(error, tSystem("services.desktopInit.windowFailed")),
          );
          if (!resolved.desktopMode) {
            await mergeAndSaveState({
              settings: { desktopMode: false, desktopModeOptIn: undefined },
            }).catch((error: unknown) => console.warn("Could not save desktop mode recovery", error));
          }
        }
        try {
          await syncMonitorWindows();
        } catch (error) {
          reportStartupError(error, tSystem("services.desktopInit.monitorsFailed"));
        }
      }
    })();
  }, []);
}
