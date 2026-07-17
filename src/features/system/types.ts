export type SystemMonitorStatus = "loading" | "ready" | "unavailable" | "error";

export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usagePercent: number;
    temperatureCelsius: number | null;
  };
  memory: {
    usagePercent: number;
    usedBytes: number;
    totalBytes: number;
  };
  disk: {
    usagePercent: number;
    usedBytes: number;
    totalBytes: number;
    mountPoint: string;
  } | null;
  network: {
    downloadBytesPerSecond: number;
    uploadBytesPerSecond: number;
  } | null;
  gpu: {
    id: string;
    name: string;
    usagePercent: number | null;
    vramUsedBytes: number | null;
    vramTotalBytes: number | null;
    temperatureCelsius: number | null;
  } | null;
}

/** Mock snapshot for visual/layout work outside Tauri. */
export const MOCK_SYSTEM_METRICS: SystemMetrics = {
  timestamp: Date.now(),
  cpu: { usagePercent: 25, temperatureCelsius: 58 },
  memory: {
    usagePercent: 69,
    usedBytes: 21.4 * 1024 ** 3,
    totalBytes: 31.9 * 1024 ** 3,
  },
  disk: {
    usagePercent: 62,
    usedBytes: 578 * 1024 ** 3,
    totalBytes: 931 * 1024 ** 3,
    mountPoint: "C:\\",
  },
  network: {
    downloadBytesPerSecond: 12.4 * 1024 ** 2,
    uploadBytesPerSecond: 1.2 * 1024 ** 2,
  },
  gpu: {
    id: "nvidia:GPU-mock",
    name: "NVIDIA GeForce RTX 4070",
    usagePercent: 34,
    vramUsedBytes: 3.2 * 1024 ** 3,
    vramTotalBytes: 12 * 1024 ** 3,
    temperatureCelsius: 62,
  },
};
