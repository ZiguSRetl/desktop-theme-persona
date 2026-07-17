import { create } from "zustand";
import { showLaunchError, showSuccess } from "../launcher/toastStore";
import { tSystem } from "../../i18n";
import {
  type AvailableUpdate,
  checkForAppUpdate,
  clearPendingUpdateHandle,
  downloadAndInstallPendingUpdate,
  markUpdateCheckDone,
  shouldAutoCheckUpdates,
} from "./updaterService";

type CheckOutcome = "available" | "upToDate" | "skipped" | "error";

type UpdateStore = {
  available: AvailableUpdate | null;
  checking: boolean;
  installing: boolean;
  dialogOpen: boolean;
  checkForUpdates: (options?: { manual?: boolean }) => Promise<CheckOutcome>;
  installUpdate: () => Promise<void>;
  dismissDialog: () => void;
};

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  available: null,
  checking: false,
  installing: false,
  dialogOpen: false,

  checkForUpdates: async (options) => {
    const manual = options?.manual === true;
    if (get().checking || get().installing) return "skipped";

    if (!manual && !shouldAutoCheckUpdates()) {
      return "skipped";
    }

    set({ checking: true });
    try {
      const available = await checkForAppUpdate();
      markUpdateCheckDone();

      if (!available) {
        set({ available: null, dialogOpen: false, checking: false });
        if (manual) {
          showSuccess(tSystem("updater.toasts.upToDate"));
        }
        return "upToDate";
      }

      set({ available, dialogOpen: true, checking: false });
      return "available";
    } catch (error) {
      set({ checking: false });
      if (manual) {
        showLaunchError(error);
      }
      return "error";
    }
  },

  installUpdate: async () => {
    if (get().installing) return;
    set({ installing: true });
    try {
      await downloadAndInstallPendingUpdate();
    } catch (error) {
      set({ installing: false });
      showLaunchError(error);
    }
  },

  dismissDialog: () => {
    clearPendingUpdateHandle();
    set({ dialogOpen: false, available: null });
  },
}));
