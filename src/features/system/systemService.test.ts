import { describe, expect, it } from "vitest";
import { formatBytes, formatPercent, toSystemMetrics } from "./systemService";
import type { SystemStats } from "../../types/desktop";

describe("systemService", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1024 ** 3)).toBe("1 GB");
  });

  it("formats percent", () => {
    expect(formatPercent(42.6)).toBe("43%");
  });

  it("maps SystemStats to SystemMetrics and null optional fields", () => {
    const stats: SystemStats = {
      cpuUsagePercent: 12,
      memoryUsedBytes: 4 * 1024 ** 3,
      memoryTotalBytes: 8 * 1024 ** 3,
      osName: "Windows",
      hostName: "PC",
      disk: null,
      network: null,
      gpu: null,
      timestamp: 123,
    };

    expect(toSystemMetrics(stats)).toEqual({
      timestamp: 123,
      cpu: { usagePercent: 12, temperatureCelsius: null },
      memory: {
        usagePercent: 50,
        usedBytes: 4 * 1024 ** 3,
        totalBytes: 8 * 1024 ** 3,
      },
      disk: null,
      network: null,
      gpu: null,
    });
  });

  it("maps CPU temperature when present", () => {
    const stats: SystemStats = {
      cpuUsagePercent: 20,
      cpuTemperatureCelsius: 58.4,
      memoryUsedBytes: 1,
      memoryTotalBytes: 2,
      osName: "Windows",
      hostName: "PC",
      timestamp: 1,
    };

    expect(toSystemMetrics(stats).cpu).toEqual({
      usagePercent: 20,
      temperatureCelsius: 58.4,
    });
  });

  it("maps GPU metrics when present", () => {
    const stats: SystemStats = {
      cpuUsagePercent: 10,
      memoryUsedBytes: 1,
      memoryTotalBytes: 2,
      osName: "Windows",
      hostName: "PC",
      gpu: {
        id: "nvidia:GPU-1",
        name: "RTX 4070",
        usagePercent: 42,
        vramUsedBytes: 1024,
        vramTotalBytes: 2048,
        temperatureCelsius: 61,
      },
      timestamp: 1,
    };

    expect(toSystemMetrics(stats).gpu).toEqual({
      id: "nvidia:GPU-1",
      name: "RTX 4070",
      usagePercent: 42,
      vramUsedBytes: 1024,
      vramTotalBytes: 2048,
      temperatureCelsius: 61,
    });
  });
});
