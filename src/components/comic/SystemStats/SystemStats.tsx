import { Cpu, Gpu, HardDrive, Monitor, Server } from "lucide-react";
import type { SystemStatsStatus } from "../../../features/system/useSystemStats";
import { formatBytes, formatPercent } from "../../../features/system/systemService";
import type { SystemStats as SystemStatsData } from "../../../types/desktop";
import { ComicPanel } from "../ComicPanel";
import styles from "./SystemStats.module.css";

interface SystemStatsProps {
  stats: SystemStatsData | null;
  status: SystemStatsStatus;
  error: string | null;
}

function StatBar({
  label,
  value,
  percent,
  icon: Icon,
}: {
  label: string;
  value: string;
  percent: number;
  icon: typeof Cpu;
}) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div className={styles.stat}>
      <div className={styles.statHeader}>
        <span className={styles.statLabel}>
          <Icon size={16} aria-hidden="true" />
          {label}
        </span>
        <span className={styles.statValue}>{value}</span>
      </div>
      <div className={styles.barTrack} aria-hidden="true">
        <div className={styles.barFill} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function StatusMessage({ status, error }: { status: SystemStatsStatus; error: string | null }) {
  if (status === "loading" || status === "idle") {
    return <p className={styles.message}>Leyendo estadísticas del sistema…</p>;
  }

  if (status === "unavailable") {
    return (
      <p className={styles.message}>
        Estadísticas disponibles solo en la app de escritorio (Tauri).
      </p>
    );
  }

  if (status === "error") {
    return <p className={styles.messageError}>{error ?? "Error al leer estadísticas."}</p>;
  }

  return null;
}

export function SystemStats({ stats, status, error }: SystemStatsProps) {
  const memoryPercent =
    stats && stats.memoryTotalBytes > 0
      ? (stats.memoryUsedBytes / stats.memoryTotalBytes) * 100
      : 0;

  return (
    <section className={styles.section} aria-label="Estadísticas del sistema">
      <ComicPanel variant="white" rotation={-1} shadowColor="red" className={styles.panel}>
        {stats ? (
          <div className={styles.content}>
            <div className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <Server size={18} aria-hidden="true" />
                <div>
                  <p className={styles.metaLabel}>Equipo</p>
                  <p className={styles.metaValue}>{stats.hostName}</p>
                </div>
              </div>
              <div className={styles.metaItem}>
                <Monitor size={18} aria-hidden="true" />
                <div>
                  <p className={styles.metaLabel}>Sistema</p>
                  <p className={styles.metaValue}>{stats.osName}</p>
                </div>
              </div>
              {stats.gpuName ? (
                <div className={styles.metaItem}>
                  <Gpu size={18} aria-hidden="true" />
                  <div>
                    <p className={styles.metaLabel}>GPU</p>
                    <p className={styles.metaValue}>{stats.gpuName}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={styles.bars}>
              <StatBar
                label="CPU"
                value={formatPercent(stats.cpuUsagePercent)}
                percent={stats.cpuUsagePercent}
                icon={Cpu}
              />
              <StatBar
                label="RAM"
                value={`${formatBytes(stats.memoryUsedBytes)} / ${formatBytes(stats.memoryTotalBytes)}`}
                percent={memoryPercent}
                icon={HardDrive}
              />
            </div>

            <p className={styles.hint}>Actualización cada 2 s · se pausa al ocultar la ventana</p>
          </div>
        ) : (
          <StatusMessage status={status} error={error} />
        )}
      </ComicPanel>
    </section>
  );
}
