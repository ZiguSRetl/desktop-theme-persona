import { useEffect, useRef } from "react";
import { isPrimaryWindow } from "../settings/monitorWindowsService";
import { useUpdateStore } from "./updateStore";

/** Auto-check for updates once on the primary window after desktop init settles. */
export function useUpdateCheckOnStartup() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!isPrimaryWindow()) return;

    const timer = window.setTimeout(() => {
      void useUpdateStore.getState().checkForUpdates({ manual: false });
    }, 2500);

    return () => window.clearTimeout(timer);
  }, []);
}
