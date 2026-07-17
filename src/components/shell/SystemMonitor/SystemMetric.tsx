import { AlertTriangle } from "lucide-react";
import type { SystemMonitorStatus } from "../../../features/system/types";
import type { MetricTone } from "../../../features/system/metricAlerts";
import { MetricBar } from "./MetricBar";
import styles from "./SystemMonitor.module.css";

interface SystemMetricProps {
  label: string;
  status: SystemMonitorStatus;
  percent: number | null;
  primary: string;
  secondary?: string | null;
  tone?: MetricTone;
  error?: string | null;
}

export function SystemMetric({
  label,
  status,
  percent,
  primary,
  secondary,
  tone = "normal",
  error,
}: SystemMetricProps) {
  const loading = status === "loading";
  const unavailable = status === "unavailable" || status === "error";
  const displayPrimary = loading ? "…" : unavailable ? "--" : primary;
  const showSecondary = Boolean(secondary) && status === "ready";

  return (
    <div
      className={styles.metric}
      data-tone={tone}
      aria-label={`${label}: ${unavailable ? "no disponible" : displayPrimary}${showSecondary ? ` · ${secondary}` : ""}`}
    >
      <div className={styles.metricHead}>
        <span className={styles.metricLabel}>{label}</span>
        {status === "error" ? (
          <span className={styles.errorIcon} title={error ?? "Error al leer métrica"}>
            <AlertTriangle size={12} aria-hidden="true" />
            <span className={styles.visuallyHidden}>{error ?? "Error al leer métrica"}</span>
          </span>
        ) : null}
      </div>

      <div className={styles.metricBody}>
        <MetricBar
          label={label}
          percent={status === "ready" ? percent : null}
          tone={tone}
          loading={loading}
        />
        <div className={styles.metricValues}>
          <span className={styles.metricPrimary}>{displayPrimary}</span>
          {showSecondary ? <span className={styles.metricSecondary}>{secondary}</span> : null}
        </div>
      </div>
    </div>
  );
}
