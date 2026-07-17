import { invoke } from "@tauri-apps/api/core";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function revealItemInDir(target: string): Promise<void> {
  if (!isTauri()) {
    throw new Error("Abrir ubicación solo está disponible en la app de escritorio.");
  }

  await invoke("reveal_item_in_dir", { target });
}
