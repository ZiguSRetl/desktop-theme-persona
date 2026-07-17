import { describe, expect, it } from "vitest";
import { bytesPerSecond } from "./networkRate";

describe("networkRate", () => {
  it("computes rate from elapsed totals", () => {
    expect(bytesPerSecond(1000, 3000, 2)).toBe(1000);
  });

  it("returns 0 when counters reset or decrease", () => {
    expect(bytesPerSecond(5000, 100, 1)).toBe(0);
  });

  it("returns 0 for non-positive elapsed time", () => {
    expect(bytesPerSecond(0, 1000, 0)).toBe(0);
    expect(bytesPerSecond(0, 1000, -1)).toBe(0);
  });
});
