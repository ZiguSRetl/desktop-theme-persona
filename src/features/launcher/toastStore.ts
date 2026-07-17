import { create } from "zustand";
import { playUiSound } from "../audio/soundService";

interface ToastState {
  message: string | null;
  variant: "error" | "success";
  show: (message: string, variant?: "error" | "success") => void;
  clear: () => void;
}

let hideTimer: number | undefined;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  variant: "error",
  show: (message, variant = "error") => {
    if (hideTimer) window.clearTimeout(hideTimer);
    set({ message, variant });
    hideTimer = window.setTimeout(() => set({ message: null }), 4000);
  },
  clear: () => {
    if (hideTimer) window.clearTimeout(hideTimer);
    set({ message: null });
  },
}));

export function showLaunchError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "No se pudo lanzar el acceso.";
  playUiSound("error");
  useToastStore.getState().show(message, "error");
}

export function showSuccess(message: string) {
  playUiSound("confirm");
  useToastStore.getState().show(message, "success");
}
