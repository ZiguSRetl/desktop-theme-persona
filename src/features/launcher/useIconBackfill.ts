import { useEffect, useRef } from "react";
import { fetchFileIcon, itemNeedsIcon } from "./iconService";
import { useLauncherStore } from "./launcherStore";

export function useIconBackfill() {
  const status = useLauncherStore((state) => state.status);
  const items = useLauncherStore((state) => state.items);
  const updateItem = useLauncherStore((state) => state.updateItem);
  const inFlight = useRef(new Set<string>());
  const failed = useRef(new Set<string>());

  useEffect(() => {
    if (status !== "ready") return;

    for (const item of items) {
      if (!itemNeedsIcon(item)) continue;
      if (inFlight.current.has(item.id) || failed.current.has(item.id)) continue;

      inFlight.current.add(item.id);

      void (async () => {
        try {
          const icon = await fetchFileIcon(item.target);
          if (!icon) {
            failed.current.add(item.id);
            return;
          }

          const current = useLauncherStore.getState().items.find((entry) => entry.id === item.id);
          if (!current || !itemNeedsIcon(current)) return;

          await updateItem(item.id, { icon });
          failed.current.delete(item.id);
        } finally {
          inFlight.current.delete(item.id);
        }
      })();
    }
  }, [items, status, updateItem]);
}
