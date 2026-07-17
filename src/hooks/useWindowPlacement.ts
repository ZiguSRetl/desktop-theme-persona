import { useEffect } from "react";
import { useSettingsStore } from "../features/settings/settingsStore";
import { saveWindowPlacement } from "../features/settings/windowService";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function useWindowPlacement() {
  useEffect(() => {
    if (!isTauri()) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      const settings = useSettingsStore.getState().settings;
      void saveWindowPlacement(settings).then((next) => {
        useSettingsStore.getState().hydrate(next);
      });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);
}
