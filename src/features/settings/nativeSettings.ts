import { invoke } from "@tauri-apps/api/core";
import type { DesktopSettings } from "../../types/desktop";
import { showLaunchError } from "../launcher/toastStore";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function applyNativeSettings(settings: DesktopSettings): Promise<void> {
  if (!isTauriRuntime()) return;

  try {
    await invoke("sync_native_settings", { settings });
  } catch (error) {
    showLaunchError(error);
  }
}

export async function exitAppCompletely(): Promise<void> {
  if (!isTauriRuntime()) return;

  try {
    await invoke("exit_app");
  } catch (error) {
    showLaunchError(error);
  }
}

export function isValidGlobalShortcut(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  const parts = trimmed.split("+").map((part) => part.trim());
  if (parts.length < 2) return false;

  const modifiers = new Set(["Ctrl", "Control", "Alt", "Shift"]);
  const hasModifier = parts.some((part) =>
    modifiers.has(part) || modifiers.has(part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()),
  );

  if (!hasModifier) return false;

  return parts.every((part) => {
    if (/^(Ctrl|Control|Alt|Shift)$/i.test(part)) return true;
    return /^[A-Za-z0-9]$/.test(part) || /^[A-Z][a-zA-Z0-9]+$/.test(part);
  });
}
