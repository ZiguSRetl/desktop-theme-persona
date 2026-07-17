import styles from "./SystemMonitor.module.css";

interface MetricBarProps {
  percent: number | null;
  tone?: "normal" | "warn" | "critical";
  loading?: boolean;
  label: string;
}

export function MetricBar({
  percent,
  tone = "normal",
  loading = false,
  label,
}: MetricBarProps) {
  const value =
    percent === null || !Number.isFinite(percent)
      ? null
      : Math.min(100, Math.max(0, percent));

  return (
    <div
      className={`${styles.barTrack} ${loading ? styles.barTrackLoading : ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value === null ? "Sin datos" : `${Math.round(value)} por ciento`}
    >
      <div
        className={`${styles.barFill} ${styles[`barFill_${tone}`]} ${loading ? styles.barFillLoading : ""}`}
        style={{ width: loading ? "40%" : `${value ?? 0}%` }}
      />
    </div>
  );
}
