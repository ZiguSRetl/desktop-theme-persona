import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "../settings/settingsStore";
import { useLauncherStore } from "./launcherStore";
import { createInitialState, loadFullState, saveFullState } from "./persistence";
import { useDesktopInit } from "./useDesktopInit";

const { syncMonitorWindows, applyWindowSettings, showLaunchError } = vi.hoisted(() => ({
  syncMonitorWindows: vi.fn<() => Promise<void>>(),
  applyWindowSettings: vi.fn<() => Promise<void>>(),
  showLaunchError: vi.fn(),
}));

vi.mock("./persistence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./persistence")>()),
  loadFullState: vi.fn(),
  saveFullState: vi.fn(),
}));
vi.mock("./useIconBackfill", () => ({ useIconBackfill: vi.fn() }));
vi.mock("./toastStore", () => ({ showLaunchError }));
vi.mock("../settings/monitorWindowsService", () => ({
  isPrimaryWindow: () => true,
  syncMonitorWindows,
}));
vi.mock("../settings/nativeSettings", () => ({ applyNativeSettings: vi.fn() }));
vi.mock("../settings/windowService", () => ({ applyWindowSettings }));

describe("useDesktopInit", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useLauncherStore.setState(useLauncherStore.getInitialState());
    useSettingsStore.setState(useSettingsStore.getInitialState());
  });

  it("restores saved settings when there are no shortcuts", async () => {
    const saved = createInitialState();
    saved.settings.animationIntensity = "reduced";
    vi.mocked(loadFullState).mockResolvedValue(saved);

    renderHook(() => useDesktopInit());

    await waitFor(() => expect(syncMonitorWindows).toHaveBeenCalledOnce());
    expect(useLauncherStore.getState().status).toBe("ready");
    expect(useLauncherStore.getState().items).toEqual([]);
    expect(useSettingsStore.getState().settings.animationIntensity).toBe("reduced");
    expect(saveFullState).not.toHaveBeenCalled();
  });

  it("keeps the launcher ready after an error synchronizing monitors", async () => {
    vi.mocked(loadFullState).mockResolvedValue(null);
    syncMonitorWindows.mockRejectedValue("monitor enumeration failed");

    renderHook(() => useDesktopInit());

    await waitFor(() => expect(showLaunchError).toHaveBeenCalledOnce());
    expect(showLaunchError.mock.calls[0]?.[0].message).toContain("monitor enumeration failed");
    expect(useLauncherStore.getState().status).toBe("ready");
    expect(useSettingsStore.getState().status).toBe("ready");
  });
});
