import { useState } from "react";
import {
  capacityTone,
  temperatureTone,
  worstTone,
  type MetricTone,
} from "../../../features/system/metricAlerts";
import {
  formatDiskSecondary,
  formatMemorySecondary,
  formatPercent,
  formatTemperature,
  normalizePercent,
} from "../../../features/system/formatMetrics";
import type { SystemMetrics, SystemMonitorStatus } from "../../../features/system/types";
import { useSettingsStore } from "../../../features/settings/settingsStore";
import { getLocaleTag, useT } from "../../../i18n";
import { GpuMetric } from "./GpuMetric";
import { NetworkMetric } from "./NetworkMetric";
import { SystemMetric } from "./SystemMetric";
import styles from "./SystemMonitor.module.css";

export interface SystemMonitorProps {
  metrics: SystemMetrics | null;
  status: SystemMonitorStatus;
  error?: string | null;
}

const CPU_HIGH_AT = 90;
const CPU_HIGH_STREAK = 3;

function metricStatus(
  overall: SystemMonitorStatus,
  hasData: boolean,
): SystemMonitorStatus {
  if (overall === "loading" || overall === "error" || overall === "unavailable") {
    return overall;
  }
  return hasData ? "ready" : "unavailable";
}

function formatCpuPrimary(
  usagePercent: number,
  temperatureCelsius: number | null,
  locale: string,
): string {
  const usage = formatPercent(usagePercent, locale);
  if (temperatureCelsius === null) return usage;
  return `${usage} · ${formatTemperature(temperatureCelsius, locale)}`;
}

export function SystemMonitor({ metrics, status, error = null }: SystemMonitorProps) {
  const t = useT();
  const language = useSettingsStore((state) => state.settings.language);
  const locale = getLocaleTag(language);
  const sampleTs = status === "ready" && metrics ? metrics.timestamp : null;
  const [cpuAlert, setCpuAlert] = useState<{
    timestamp: number | null;
    streak: number;
    tone: MetricTone;
  }>({ timestamp: null, streak: 0, tone: "normal" });

  if (sampleTs !== cpuAlert.timestamp) {
    if (sampleTs === null || !metrics) {
      setCpuAlert({ timestamp: null, streak: 0, tone: "normal" });
    } else {
      const usage = normalizePercent(metrics.cpu.usagePercent);
      const streak = usage >= CPU_HIGH_AT ? cpuAlert.streak + 1 : 0;
      setCpuAlert({
        timestamp: sampleTs,
        streak,
        tone: streak >= CPU_HIGH_STREAK ? "critical" : "normal",
      });
    }
  }

  const cpuPercent = metrics ? normalizePercent(metrics.cpu.usagePercent) : null;
  const cpuTemp = metrics?.cpu.temperatureCelsius ?? null;
  const cpuTone =
    cpuTemp !== null
      ? worstTone(cpuAlert.tone, temperatureTone(cpuTemp))
      : cpuAlert.tone;
  const memoryPercent = metrics ? normalizePercent(metrics.memory.usagePercent) : null;
  const diskPercent = metrics?.disk ? normalizePercent(metrics.disk.usagePercent) : null;
  const gpu = metrics?.gpu ?? null;

  return (
    <section
      className={styles.monitor}
      aria-label={t("system.monitor.aria")}
      aria-live="polite"
    >
      <SystemMetric
        label={t("system.metrics.cpu")}
        status={metricStatus(status, cpuPercent !== null)}
        percent={cpuPercent}
        primary={
          cpuPercent !== null ? formatCpuPrimary(cpuPercent, cpuTemp, locale) : "--"
        }
        tone={cpuTone}
        error={error}
      />
      <SystemMetric
        label={t("system.metrics.ram")}
        status={metricStatus(status, memoryPercent !== null)}
        percent={memoryPercent}
        primary={memoryPercent !== null ? formatPercent(memoryPercent, locale) : "--"}
        secondary={
          metrics
            ? formatMemorySecondary(metrics.memory.usedBytes, metrics.memory.totalBytes, locale)
            : null
        }
        tone={memoryPercent !== null ? capacityTone(memoryPercent) : "normal"}
        error={error}
      />
      <SystemMetric
        label={t("system.metrics.disk")}
        status={metricStatus(status, Boolean(metrics?.disk))}
        percent={diskPercent}
        primary={diskPercent !== null ? formatPercent(diskPercent, locale) : "--"}
        secondary={
          metrics?.disk
            ? formatDiskSecondary(metrics.disk.usedBytes, metrics.disk.totalBytes, locale)
            : null
        }
        tone={diskPercent !== null ? capacityTone(diskPercent) : "normal"}
        error={error}
      />
      <GpuMetric
        status={metricStatus(status, Boolean(gpu))}
        name={gpu?.name ?? null}
        usagePercentValue={gpu?.usagePercent ?? null}
        vramUsedBytes={gpu?.vramUsedBytes ?? null}
        vramTotalBytes={gpu?.vramTotalBytes ?? null}
        temperatureCelsius={gpu?.temperatureCelsius ?? null}
        error={error}
      />
      <NetworkMetric
        status={metricStatus(status, Boolean(metrics?.network))}
        downloadBytesPerSecond={metrics?.network?.downloadBytesPerSecond ?? null}
        uploadBytesPerSecond={metrics?.network?.uploadBytesPerSecond ?? null}
        error={error}
      />
    </section>
  );
}
