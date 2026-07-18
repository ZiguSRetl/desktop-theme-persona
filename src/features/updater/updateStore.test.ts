import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  checkForAppUpdate,
  clearPendingUpdateHandle,
  getAppVersion,
  markUpdateCheckDone,
  shouldAutoCheckUpdates,
} = vi.hoisted(() => ({
  checkForAppUpdate: vi.fn(),
  clearPendingUpdateHandle: vi.fn(),
  getAppVersion: vi.fn(),
  markUpdateCheckDone: vi.fn(),
  shouldAutoCheckUpdates: vi.fn(),
}));

vi.mock("./updaterService", async () => {
  const actual = await vi.importActual<typeof import("./updaterService")>("./updaterService");
  return {
    ...actual,
    checkForAppUpdate,
    clearPendingUpdateHandle,
    getAppVersion,
    markUpdateCheckDone,
    shouldAutoCheckUpdates,
  };
});

vi.mock("../launcher/toastStore", () => ({
  showLaunchError: vi.fn(),
  showSuccess: vi.fn(),
}));

import { useUpdateStore } from "./updateStore";

describe("useUpdateStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUpdateStore.setState({
      available: null,
      currentVersion: null,
      checking: false,
      installing: false,
      dialogOpen: false,
    });
  });

  it("loads current version once", async () => {
    getAppVersion.mockResolvedValue("0.1.5");

    await useUpdateStore.getState().loadCurrentVersion();
    await useUpdateStore.getState().loadCurrentVersion();

    expect(getAppVersion).toHaveBeenCalledOnce();
    expect(useUpdateStore.getState().currentVersion).toBe("0.1.5");
  });

  it("keeps available after dismissDialog", async () => {
    shouldAutoCheckUpdates.mockReturnValue(true);
    checkForAppUpdate.mockResolvedValue({
      version: "0.1.6",
      body: null,
      date: null,
    });

    await useUpdateStore.getState().checkForUpdates({ manual: true });
    expect(useUpdateStore.getState().available?.version).toBe("0.1.6");
    expect(useUpdateStore.getState().dialogOpen).toBe(true);

    useUpdateStore.getState().dismissDialog();

    expect(clearPendingUpdateHandle).toHaveBeenCalledOnce();
    expect(useUpdateStore.getState().dialogOpen).toBe(false);
    expect(useUpdateStore.getState().available?.version).toBe("0.1.6");
  });
});
