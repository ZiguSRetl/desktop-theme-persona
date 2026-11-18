import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { isPrimaryWindow } from "../features/settings/monitorWindowsService";
import { useSettingsStore } from "../features/settings/settingsStore";
import { applyWindowSettings, saveWindowPlacement } from "../features/settings/windowService";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function useWindowPlacement() {
  useEffect(() => {
    if (!isTauri() || !isPrimaryWindow()) return;
    const appWindow = getCurrentWindow();
    let timer: number | undefined;
    let disposed = false;
    const unlisteners: (() => void)[] = [];

    const savePlacement = () => {
      window.clearTimeout(timer);
      if (useSettingsStore.getState().status !== "ready") return;
      const current = useSettingsStore.getState().settings;
      void saveWindowPlacement(current).then((next) => {
        if (!disposed && next !== current) {
          useSettingsStore.setState(({ settings }) => ({
            settings: { ...settings, windowBounds: next.windowBounds, lastMonitorIndex: next.lastMonitorIndex },
          }));
        }
      }).catch((error) => console.warn("Could not save window placement", error));
    };

    const handleVisibilityChange = () => {
      if (document.hidden) savePlacement();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const scheduleSave = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(savePlacement, 180);
    };
    const onError = (error: unknown) => console.warn("Could not update window placement", error);
    for (const subscription of [
      appWindow.onMoved(scheduleSave),
      appWindow.onResized(scheduleSave),
      listen("monitor-layout-changed", () =>
        void applyWindowSettings(useSettingsStore.getState().settings).catch(onError)),
      listen("desktop-mode-changed", () =>
        void useSettingsStore.getState().updateSetting("desktopMode", false).catch(onError)),
    ]) {
      void subscription.then((unlisten) => {
        if (disposed) unlisten();
        else unlisteners.push(unlisten);
      }).catch(onError);
    }

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);
}
