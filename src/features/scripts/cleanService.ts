import { invoke } from "@tauri-apps/api/core";
import { tt } from "../../i18n";
import type { CleanScriptResult } from "./types";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function runCleanScript(): Promise<CleanScriptResult> {
  if (!isTauriRuntime()) {
    throw new Error(tt("scripts.errors.desktopOnly"));
  }

  return invoke<CleanScriptResult>("run_clean_script");
}

export function formatFreedMemory(beforeBytes: number, afterBytes: number): string {
  const freed = Math.max(0, beforeBytes - afterBytes);
  if (freed <= 0) {
    return tt("scripts.summary.noRamChange");
  }

  const gib = 1024 ** 3;
  const mib = 1024 ** 2;
  if (freed >= gib) {
    return tt("scripts.summary.freedGb", { n: (freed / gib).toFixed(1) });
  }
  return tt("scripts.summary.freedMb", { n: Math.round(freed / mib) });
}

export function summarizeCleanResult(result: CleanScriptResult): string {
  const memorySummary = formatFreedMemory(result.before.memoryUsedBytes, result.after.memoryUsedBytes);
  const okSteps = result.steps.filter((step) => step.status === "ok").length;
  return `${memorySummary} ${tt("scripts.summary.stepsDone", { n: okSteps })}`;
}

export function hasPartialSuccess(result: CleanScriptResult): boolean {
  return result.steps.some((step) => step.status === "ok");
}
