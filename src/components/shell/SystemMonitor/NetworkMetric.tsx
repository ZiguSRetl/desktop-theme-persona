import { AlertTriangle } from "lucide-react";
import type { SystemMonitorStatus } from "../../../features/system/types";
import { formatNetworkPair } from "../../../features/system/formatMetrics";
import { useSettingsStore } from "../../../features/settings/settingsStore";
import { getLocaleTag, useT } from "../../../i18n";
import styles from "./SystemMonitor.module.css";

interface NetworkMetricProps {
  status: SystemMonitorStatus;
  downloadBytesPerSecond: number | null;
  uploadBytesPerSecond: number | null;
  error?: string | null;
}

export function NetworkMetric({
  status,
  downloadBytesPerSecond,
  uploadBytesPerSecond,
  error,
}: NetworkMetricProps) {
  const t = useT();
  const language = useSettingsStore((state) => state.settings.language);
  const locale = getLocaleTag(language);
  const loading = status === "loading";
  const unavailable =
    status === "unavailable" ||
    status === "error" ||
    downloadBytesPerSecond === null ||
    uploadBytesPerSecond === null;

  const pair =
    !unavailable && downloadBytesPerSecond !== null && uploadBytesPerSecond !== null
      ? formatNetworkPair(downloadBytesPerSecond, uploadBytesPerSecond, locale)
      : null;

  const ariaLabel = loading
    ? t("system.aria.networkLoading")
    : pair
      ? `${t("system.aria.networkLabel")}: ${t("system.aria.networkPair", { download: pair.download, upload: pair.upload })}`
      : t("system.aria.networkUnavailable");

  const metricError = error ?? t("system.aria.metricError");

  return (
    <div className={styles.metric} aria-label={ariaLabel}>
      <div className={styles.metricHead}>
        <span className={styles.metricLabel}>{t("system.metrics.network")}</span>
        {status === "error" ? (
          <span className={styles.errorIcon} title={metricError}>
            <AlertTriangle size={12} aria-hidden="true" />
            <span className={styles.visuallyHidden}>{metricError}</span>
          </span>
        ) : null}
      </div>

      <div className={styles.networkBody}>
        {loading ? (
          <span className={styles.metricPrimary}>…</span>
        ) : pair ? (
          <>
            <span className={styles.networkRate}>
              <span className={styles.networkArrow} aria-hidden="true">
                ↓
              </span>
              <span>{pair.download}</span>
            </span>
            <span className={styles.networkRate}>
              <span className={styles.networkArrow} aria-hidden="true">
                ↑
              </span>
              <span>{pair.upload}</span>
            </span>
          </>
        ) : (
          <span className={styles.metricPrimary}>--</span>
        )}
      </div>
    </div>
  );
}
