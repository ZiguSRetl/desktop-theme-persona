import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InstalledAppResult } from "./appSearchService";
import {
  __resetInstalledAppsScanForTests,
  useInstalledAppsStore,
} from "./installedAppsStore";

const { listInstalledApps, startInstalledAppsScan, subscribeInstalledAppsScan } =
  vi.hoisted(() => ({
    listInstalledApps: vi.fn(async (): Promise<InstalledAppResult[]> => []),
    startInstalledAppsScan: vi.fn(async () => undefined),
    subscribeInstalledAppsScan: vi.fn(
      async (_handlers: {
        onUpdated: (apps: InstalledAppResult[]) => void;
        onReady: (apps: InstalledAppResult[]) => void;
      }) => () => undefined,
    ),
  }));

vi.mock("./appSearchService", () => ({
  listInstalledApps,
  startInstalledAppsScan,
  subscribeInstalledAppsScan,
}));

const sampleApps = [
  { name: "Chrome", path: "C:\\Chrome.lnk", source: "Start menu" },
  { name: "Firefox", path: "C:\\Firefox.lnk", source: "Desktop" },
];

describe("useInstalledAppsStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetInstalledAppsScanForTests();
    useInstalledAppsStore.setState({ apps: [], status: "idle", error: null });
  });

  it("shares concurrent requests and displays cached apps while scanning", async () => {
    listInstalledApps.mockResolvedValueOnce(sampleApps);
    const { ensureLoaded } = useInstalledAppsStore.getState();

    await Promise.all([ensureLoaded(), ensureLoaded()]);

    expect(subscribeInstalledAppsScan).toHaveBeenCalledTimes(1);
    expect(startInstalledAppsScan).toHaveBeenCalledTimes(1);
    expect(useInstalledAppsStore.getState()).toMatchObject({
      apps: sampleApps,
      status: "loading",
    });
  });

  it("applies progressive updates and keeps the completed catalog", async () => {
    const { ensureLoaded } = useInstalledAppsStore.getState();
    await ensureLoaded();
    const [{ onUpdated, onReady }] = subscribeInstalledAppsScan.mock.calls[0];

    onUpdated([sampleApps[0]]);
    expect(useInstalledAppsStore.getState()).toMatchObject({
      apps: [sampleApps[0]],
      status: "loading",
    });

    onReady(sampleApps);
    onUpdated([sampleApps[0]]);
    await ensureLoaded();
    expect(useInstalledAppsStore.getState()).toMatchObject({
      apps: sampleApps,
      status: "ready",
    });
    expect(startInstalledAppsScan).toHaveBeenCalledTimes(1);
  });

  it("keeps cached apps when the scan fails to start", async () => {
    listInstalledApps.mockResolvedValueOnce(sampleApps);
    startInstalledAppsScan.mockRejectedValueOnce(new Error("Scan unavailable"));

    await useInstalledAppsStore.getState().ensureLoaded();

    expect(useInstalledAppsStore.getState()).toMatchObject({
      apps: sampleApps,
      status: "error",
      error: "Scan unavailable",
    });
  });
});
