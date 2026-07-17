import { create } from "zustand";
import { showLaunchError, showSuccess } from "../launcher/toastStore";
import {
  hasPartialSuccess,
  runCleanScript,
  summarizeCleanResult,
} from "./cleanService";
import { getScriptById, type ScriptId } from "./scriptRegistry";
import type { ScriptsState } from "./types";

export const useScriptsStore = create<ScriptsState>((set, get) => ({
  status: "idle",
  activeScriptId: null,
  lastResult: null,
  error: null,

  confirmScript: (scriptId) => {
    if (!getScriptById(scriptId as ScriptId)) return;
    set({ status: "confirming", activeScriptId: scriptId, error: null });
  },

  cancelConfirm: () => {
    set({ status: "idle", activeScriptId: null, error: null });
  },

  runScript: async (scriptId) => {
    const script = getScriptById(scriptId as ScriptId);
    if (!script) {
      set({ status: "error", error: "Script no encontrado." });
      return;
    }

    set({ status: "running", activeScriptId: scriptId, error: null, lastResult: null });

    try {
      if (script.id !== "clean") {
        throw new Error("Script no soportado.");
      }

      const result = await runCleanScript();
      set({ status: "success", lastResult: result, error: null });
      showSuccess(summarizeCleanResult(result));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo ejecutar el script.";
      const lastResult = get().lastResult;
      if (lastResult && hasPartialSuccess(lastResult)) {
        showSuccess(summarizeCleanResult(lastResult));
        set({ status: "success", error: message });
        return;
      }
      set({ status: "error", error: message });
      showLaunchError(error);
    }
  },

  reset: () => {
    set({ status: "idle", activeScriptId: null, lastResult: null, error: null });
  },
}));
