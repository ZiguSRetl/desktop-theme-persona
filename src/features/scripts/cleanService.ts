import { invoke } from "@tauri-apps/api/core";
import type { CleanScriptResult } from "./types";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function runCleanScript(): Promise<CleanScriptResult> {
  if (!isTauriRuntime()) {
    throw new Error("Clean solo está disponible en la aplicación de escritorio.");
  }

  return invoke<CleanScriptResult>("run_clean_script");
}

export function formatFreedMemory(beforeBytes: number, afterBytes: number): string {
  const freed = Math.max(0, beforeBytes - afterBytes);
  if (freed <= 0) {
    return "Sin cambio notable en RAM.";
  }

  const gib = 1024 ** 3;
  const mib = 1024 ** 2;
  if (freed >= gib) {
    return `Liberados ~${(freed / gib).toFixed(1)} GB de RAM.`;
  }
  return `Liberados ~${Math.round(freed / mib)} MB de RAM.`;
}

export function summarizeCleanResult(result: CleanScriptResult): string {
  const memorySummary = formatFreedMemory(result.before.memoryUsedBytes, result.after.memoryUsedBytes);
  const okSteps = result.steps.filter((step) => step.status === "ok").length;
  return `${memorySummary} ${okSteps} paso(s) completado(s).`;
}

export function hasPartialSuccess(result: CleanScriptResult): boolean {
  return result.steps.some((step) => step.status === "ok");
}
