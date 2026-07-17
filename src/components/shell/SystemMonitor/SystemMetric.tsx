import { AlertTriangle } from "lucide-react";
import type { SystemMonitorStatus } from "../../../features/system/types";
import type { MetricTone } from "../../../features/system/metricAlerts";
import { useT } from "../../../i18n";
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
  const t = useT();
  const loading = status === "loading";
  const unavailable = status === "unavailable" || status === "error";
  const displayPrimary = loading ? "…" : unavailable ? "--" : primary;
  const showSecondary = Boolean(secondary) && status === "ready";
  const metricError = error ?? t("system.aria.metricError");

  return (
    <div
      className={styles.metric}
      data-tone={tone}
      aria-label={`${label}: ${unavailable ? t("system.aria.unavailable") : displayPrimary}${showSecondary ? ` · ${secondary}` : ""}`}
    >
      <div className={styles.metricHead}>
        <span className={styles.metricLabel}>{label}</span>
        {status === "error" ? (
          <span className={styles.errorIcon} title={metricError}>
            <AlertTriangle size={12} aria-hidden="true" />
            <span className={styles.visuallyHidden}>{metricError}</span>
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
