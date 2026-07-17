import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  UPDATE_CHECK_INTERVAL_MS,
  markUpdateCheckDone,
  shouldAutoCheckUpdates,
} from "./updaterService";

const STORAGE_KEY = "p5-explorer:last-update-check";

describe("updaterService throttle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("allows auto-check when never checked", () => {
    expect(shouldAutoCheckUpdates(1_000_000)).toBe(true);
  });

  it("skips auto-check inside the interval", () => {
    const now = 10_000_000;
    markUpdateCheckDone(now);
    expect(shouldAutoCheckUpdates(now + UPDATE_CHECK_INTERVAL_MS - 1)).toBe(false);
  });

  it("allows auto-check after the interval", () => {
    const now = 10_000_000;
    markUpdateCheckDone(now);
    expect(shouldAutoCheckUpdates(now + UPDATE_CHECK_INTERVAL_MS)).toBe(true);
  });

  it("persists the last check timestamp", () => {
    markUpdateCheckDone(42);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("42");
  });
});
