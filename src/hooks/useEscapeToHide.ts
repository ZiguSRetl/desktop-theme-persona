import { useEffect } from "react";
import { showLaunchError } from "../features/launcher/toastStore";
import { hideMainWindow } from "../features/settings/windowService";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function useEscapeToHide() {
  useEffect(() => {
    if (!isTauri()) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;

      const target = event.target instanceof HTMLElement ? event.target : null;
      const isTypingField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable ||
        target?.closest("dialog[open]");

      if (isTypingField) return;

      event.preventDefault();
      void hideMainWindow().catch((error: unknown) =>
        showLaunchError(typeof error === "string" ? new Error(error) : error),
      );
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
