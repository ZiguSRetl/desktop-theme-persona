import { AlertTriangle } from "lucide-react";
import type { SystemMonitorStatus } from "../../../features/system/types";
import { formatNetworkPair } from "../../../features/system/formatMetrics";
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
  const loading = status === "loading";
  const unavailable =
    status === "unavailable" ||
    status === "error" ||
    downloadBytesPerSecond === null ||
    uploadBytesPerSecond === null;

  const pair =
    !unavailable && downloadBytesPerSecond !== null && uploadBytesPerSecond !== null
      ? formatNetworkPair(downloadBytesPerSecond, uploadBytesPerSecond)
      : null;

  const ariaLabel = loading
    ? "Red: cargando"
    : pair
      ? `Red: ${pair.ariaLabel}`
      : "Red: no disponible";

  return (
    <div className={styles.metric} aria-label={ariaLabel}>
      <div className={styles.metricHead}>
        <span className={styles.metricLabel}>RED</span>
        {status === "error" ? (
          <span className={styles.errorIcon} title={error ?? "Error al leer métrica"}>
            <AlertTriangle size={12} aria-hidden="true" />
            <span className={styles.visuallyHidden}>{error ?? "Error al leer métrica"}</span>
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
