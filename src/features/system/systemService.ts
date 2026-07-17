import { invoke } from "@tauri-apps/api/core";
import type { GpuDevice, SystemStats } from "../../types/desktop";
import { usagePercent } from "./formatMetrics";
import type { SystemMetrics } from "./types";

export {
  formatBytes,
  formatByteRate,
  formatPercent,
  formatTemperature,
  normalizePercent,
  usagePercent,
} from "./formatMetrics";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function optionalNumber(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function toSystemMetrics(stats: SystemStats): SystemMetrics {
  const memoryUsage = usagePercent(stats.memoryUsedBytes, stats.memoryTotalBytes);

  return {
    timestamp: stats.timestamp ?? Date.now(),
    cpu: {
      usagePercent: stats.cpuUsagePercent,
      temperatureCelsius: optionalNumber(stats.cpuTemperatureCelsius),
    },
    memory: {
      usagePercent: memoryUsage,
      usedBytes: stats.memoryUsedBytes,
      totalBytes: stats.memoryTotalBytes,
    },
    disk: stats.disk
      ? {
          usagePercent: usagePercent(stats.disk.usedBytes, stats.disk.totalBytes) || stats.disk.usagePercent,
          usedBytes: stats.disk.usedBytes,
          totalBytes: stats.disk.totalBytes,
          mountPoint: stats.disk.mountPoint,
        }
      : null,
    network: stats.network
      ? {
          downloadBytesPerSecond: stats.network.downloadBytesPerSecond,
          uploadBytesPerSecond: stats.network.uploadBytesPerSecond,
        }
      : null,
    gpu: stats.gpu
      ? {
          id: stats.gpu.id,
          name: stats.gpu.name,
          usagePercent: optionalNumber(stats.gpu.usagePercent),
          vramUsedBytes: optionalNumber(stats.gpu.vramUsedBytes),
          vramTotalBytes: optionalNumber(stats.gpu.vramTotalBytes),
          temperatureCelsius: optionalNumber(stats.gpu.temperatureCelsius),
        }
      : null,
  };
}

export async function fetchSystemStats(gpuId?: string | null): Promise<SystemStats | null> {
  if (!isTauriRuntime()) return null;

  return invoke<SystemStats>("get_system_stats", {
    gpuId: gpuId?.trim() ? gpuId.trim() : null,
  });
}

export async function fetchSystemMetrics(gpuId?: string | null): Promise<SystemMetrics | null> {
  const stats = await fetchSystemStats(gpuId);
  if (!stats) return null;
  return toSystemMetrics(stats);
}

export async function listGpus(): Promise<GpuDevice[]> {
  if (!isTauriRuntime()) return [];
  return invoke<GpuDevice[]>("list_gpus");
}
