import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import {
  formatFreedMemory,
  hasPartialSuccess,
  runCleanScript,
  summarizeCleanResult,
} from "./cleanService";

describe("cleanService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("__TAURI_INTERNALS__", {});
  });

  it("throws outside Tauri", async () => {
    vi.unstubAllGlobals();
    await expect(runCleanScript()).rejects.toThrow(/escritorio/);
  });

  it("invokes run_clean_script in Tauri", async () => {
    const payload = {
      steps: [],
      closedApps: [],
      before: { memoryUsedBytes: 1 },
      after: { memoryUsedBytes: 1 },
    };
    vi.mocked(invoke).mockResolvedValueOnce(payload);

    await expect(runCleanScript()).resolves.toEqual(payload);
    expect(invoke).toHaveBeenCalledWith("run_clean_script");
  });

  it("summarizes freed memory", () => {
    expect(formatFreedMemory(4_000_000_000, 2_500_000_000)).toMatch(/GB/);
    expect(
      summarizeCleanResult({
        steps: [{ id: "a", label: "A", status: "ok" }],
        closedApps: [],
        before: { memoryUsedBytes: 2_000_000_000 },
        after: { memoryUsedBytes: 1_000_000_000 },
      }),
    ).toMatch(/paso/);
  });

  it("detects partial success", () => {
    expect(
      hasPartialSuccess({
        steps: [{ id: "a", label: "A", status: "failed" }],
        closedApps: [],
        before: { memoryUsedBytes: 1 },
        after: { memoryUsedBytes: 1 },
      }),
    ).toBe(false);
    expect(
      hasPartialSuccess({
        steps: [{ id: "a", label: "A", status: "ok" }],
        closedApps: [],
        before: { memoryUsedBytes: 1 },
        after: { memoryUsedBytes: 1 },
      }),
    ).toBe(true);
  });
});
