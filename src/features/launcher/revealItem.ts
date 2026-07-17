import { invoke } from "@tauri-apps/api/core";
import { tt } from "../../i18n";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function revealItemInDir(target: string): Promise<void> {
  if (!isTauri()) {
    throw new Error(tt("services.reveal.desktopOnly"));
  }

  await invoke("reveal_item_in_dir", { target });
}
