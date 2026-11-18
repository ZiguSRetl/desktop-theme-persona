import { beforeEach, describe, expect, it, vi } from "vitest";

const { runCleanScript } = vi.hoisted(() => ({
  runCleanScript: vi.fn(),
}));

vi.mock("./cleanService", async () => {
  const actual = await vi.importActual<typeof import("./cleanService")>("./cleanService");
  return {
    ...actual,
    runCleanScript,
  };
});

import { useScriptsStore } from "./scriptsStore";

const sampleResult = {
  steps: [{ id: "power-plan", label: "Plan", status: "ok" as const }],
  closedApps: ["chrome.exe"],
  before: { memoryUsedBytes: 8_000_000_000, vramUsedBytes: 2_000_000_000 },
  after: { memoryUsedBytes: 6_000_000_000, vramUsedBytes: 500_000_000 },
};

describe("useScriptsStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useScriptsStore.getState().reset();
  });

  it("moves idle → confirming → running → success", async () => {
    runCleanScript.mockResolvedValueOnce(sampleResult);

    useScriptsStore.getState().confirmScript("clean");
    expect(useScriptsStore.getState().status).toBe("confirming");

    await useScriptsStore.getState().runScript("clean");

    expect(runCleanScript).toHaveBeenCalledOnce();
    expect(useScriptsStore.getState().status).toBe("success");
    expect(useScriptsStore.getState().lastResult).toEqual(sampleResult);
  });

  it("stores error on failure", async () => {
    runCleanScript.mockRejectedValueOnce(new Error("UAC cancelado"));

    useScriptsStore.getState().confirmScript("clean");
    await useScriptsStore.getState().runScript("clean");

    expect(useScriptsStore.getState().status).toBe("error");
    expect(useScriptsStore.getState().error).toBe("UAC cancelado");
  });

  it("cannot run a script after canceling its confirmation", async () => {
    const store = useScriptsStore.getState();
    store.confirmScript("clean");
    store.cancelConfirm();
    await store.runScript("clean");
    expect(runCleanScript).not.toHaveBeenCalled();
    expect(useScriptsStore.getState().status).toBe("idle");
  });
});
