import { describe, expect, it } from "vitest";
import {
  formatByteRate,
  formatBytes,
  formatPercent,
  formatTemperature,
  normalizePercent,
  usagePercent,
} from "./formatMetrics";

describe("formatMetrics", () => {
  it("formats bytes with es-ES separators", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1024 ** 3)).toBe("1 GB");
    expect(formatBytes(21.4 * 1024 ** 3)).toMatch(/21[,.]4 GB/);
  });

  it("formats percent", () => {
    expect(formatPercent(42.6)).toBe("43%");
    expect(formatPercent(-5)).toBe("0%");
    expect(formatPercent(150)).toBe("100%");
  });

  it("formats network rates across units", () => {
    expect(formatByteRate(0)).toBe("0 B/s");
    expect(formatByteRate(512)).toBe("512 B/s");
    expect(formatByteRate(12.4 * 1024 ** 2)).toMatch(/12[,.]4 MB\/s/);
    expect(formatByteRate(1.2 * 1024 ** 2)).toMatch(/1[,.]2 MB\/s/);
  });

  it("formats temperature", () => {
    expect(formatTemperature(61.4)).toBe("61 °C");
    expect(formatTemperature(Number.NaN)).toBe("--");
  });

  it("computes usage percent with zero total and out-of-range values", () => {
    expect(usagePercent(10, 0)).toBe(0);
    expect(usagePercent(50, 100)).toBe(50);
    expect(normalizePercent(Number.NaN)).toBe(0);
    expect(normalizePercent(-10)).toBe(0);
    expect(normalizePercent(120)).toBe(100);
  });
});
