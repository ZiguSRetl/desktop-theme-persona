import { AlertTriangle } from "lucide-react";
import {
  capacityTone,
  temperatureTone,
  worstTone,
  type MetricTone,
} from "../../../features/system/metricAlerts";
import {
  formatGpuVram,
  formatPercent,
  formatTemperature,
  normalizePercent,
  usagePercent,
} from "../../../features/system/formatMetrics";
import type { SystemMonitorStatus } from "../../../features/system/types";
import { useSettingsStore } from "../../../features/settings/settingsStore";
import { getLocaleTag, useT } from "../../../i18n";
import styles from "./SystemMonitor.module.css";

interface GpuMetricProps {
  status: SystemMonitorStatus;
  name: string | null;
  usagePercentValue: number | null;
  vramUsedBytes: number | null;
  vramTotalBytes: number | null;
  temperatureCelsius: number | null;
  error?: string | null;
}

function gpuTone(
  usage: number | null,
  vramUsed: number | null,
  vramTotal: number | null,
  temperature: number | null,
): MetricTone {
  const tones: MetricTone[] = ["normal"];
  if (usage !== null) tones.push(capacityTone(usage));
  if (vramUsed !== null && vramTotal !== null && vramTotal > 0) {
    tones.push(capacityTone(usagePercent(vramUsed, vramTotal)));
  }
  if (temperature !== null) tones.push(temperatureTone(temperature));
  return worstTone(...tones);
}

export function GpuMetric({
  status,
  name,
  usagePercentValue,
  vramUsedBytes,
  vramTotalBytes,
  temperatureCelsius,
  error,
}: GpuMetricProps) {
  const t = useT();
  const language = useSettingsStore((state) => state.settings.language);
  const locale = getLocaleTag(language);
  const loading = status === "loading";
  const hasAnyMetric =
    usagePercentValue !== null ||
    (vramUsedBytes !== null && vramTotalBytes !== null) ||
    temperatureCelsius !== null;
  const unavailable =
    status === "unavailable" || status === "error" || (!loading && !hasAnyMetric && !name);

  const usage =
    usagePercentValue !== null ? normalizePercent(usagePercentValue) : null;
  const vramLabel = formatGpuVram(vramUsedBytes, vramTotalBytes, locale);
  const tempLabel =
    temperatureCelsius !== null ? formatTemperature(temperatureCelsius, locale) : null;
  const tone =
    status === "ready"
      ? gpuTone(usage, vramUsedBytes, vramTotalBytes, temperatureCelsius)
      : "normal";

  const gpuLabel = t("system.metrics.gpu");
  const ariaParts: string[] = [];
  if (name) ariaParts.push(name);
  if (usage !== null) ariaParts.push(t("system.aria.gpuUsage", { percent: formatPercent(usage, locale) }));
  if (vramLabel) ariaParts.push(`${t("system.gpu.vram")} ${vramLabel}`);
  if (tempLabel) ariaParts.push(t("system.aria.gpuTemp", { temp: tempLabel }));

  const ariaLabel = loading
    ? t("system.aria.gpuLoading")
    : unavailable && !name
      ? t("system.aria.gpuUnavailable")
      : ariaParts.length > 0
        ? `${gpuLabel}: ${ariaParts.join(", ")}`
        : t("system.aria.gpuNoSensors");

  const metricError = error ?? t("system.aria.metricError");

  return (
    <div className={styles.metric} data-tone={tone} aria-label={ariaLabel}>
      <div className={styles.metricHead}>
        <span className={styles.metricLabel}>{gpuLabel}</span>
        {status === "error" ? (
          <span className={styles.errorIcon} title={metricError}>
            <AlertTriangle size={12} aria-hidden="true" />
            <span className={styles.visuallyHidden}>{metricError}</span>
          </span>
        ) : null}
      </div>

      <div className={styles.gpuBody}>
        {loading ? (
          <span className={styles.metricPrimary}>…</span>
        ) : hasAnyMetric ? (
          <>
            <span className={styles.gpuStat}>
              <span className={styles.gpuStatLabel}>{t("system.gpu.usage")}</span>
              <span className={styles.gpuStatValue}>
                {usage !== null ? formatPercent(usage, locale) : "--"}
              </span>
            </span>
            <span className={styles.gpuStat}>
              <span className={styles.gpuStatLabel}>{t("system.gpu.vram")}</span>
              <span className={styles.gpuStatValue}>{vramLabel ?? "--"}</span>
            </span>
            <span className={styles.gpuStat}>
              <span className={styles.gpuStatLabel}>{t("system.gpu.temp")}</span>
              <span className={styles.gpuStatValue}>{tempLabel ?? "--"}</span>
            </span>
          </>
        ) : (
          <span className={styles.metricPrimary} title={name ?? undefined}>
            {name ? t("system.gpu.noSensors") : "--"}
          </span>
        )}
      </div>
    </div>
  );
}
