import { invoke } from "@tauri-apps/api/core";
import type { LauncherItem } from "../../types/desktop";
import { tt } from "../../i18n";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function launchItem(item: LauncherItem): Promise<void> {
  if (!isTauri()) {
    if (item.type === "url") {
      window.open(item.target, "_blank", "noopener,noreferrer");
      return;
    }
    throw new Error(tt("services.launch.desktopOnly"));
  }

  await invoke("launch_item", {
    payload: {
      itemType: item.type,
      target: item.target,
      arguments: item.arguments ?? null,
    },
  });
}
