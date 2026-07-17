import { Cpu, Gpu, HardDrive, Monitor, Server } from "lucide-react";
import type { SystemStatsStatus } from "../../../features/system/useSystemStats";
import { formatBytes, formatPercent } from "../../../features/system/systemService";
import type { SystemStats as SystemStatsData } from "../../../types/desktop";
import { useSettingsStore } from "../../../features/settings/settingsStore";
import { getLocaleTag, useT } from "../../../i18n";
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
  const t = useT();

  if (status === "loading" || status === "idle") {
    return <p className={styles.message}>{t("system.stats.loading")}</p>;
  }

  if (status === "unavailable") {
    return <p className={styles.message}>{t("system.stats.unavailable")}</p>;
  }

  if (status === "error") {
    return <p className={styles.messageError}>{error ?? t("system.stats.error")}</p>;
  }

  return null;
}

export function SystemStats({ stats, status, error }: SystemStatsProps) {
  const t = useT();
  const language = useSettingsStore((state) => state.settings.language);
  const locale = getLocaleTag(language);
  const memoryPercent =
    stats && stats.memoryTotalBytes > 0
      ? (stats.memoryUsedBytes / stats.memoryTotalBytes) * 100
      : 0;

  return (
    <section className={styles.section} aria-label={t("system.stats.aria")}>
      <ComicPanel variant="white" rotation={-1} shadowColor="red" className={styles.panel}>
        {stats ? (
          <div className={styles.content}>
            <div className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <Server size={18} aria-hidden="true" />
                <div>
                  <p className={styles.metaLabel}>{t("system.stats.host")}</p>
                  <p className={styles.metaValue}>{stats.hostName}</p>
                </div>
              </div>
              <div className={styles.metaItem}>
                <Monitor size={18} aria-hidden="true" />
                <div>
                  <p className={styles.metaLabel}>{t("system.stats.os")}</p>
                  <p className={styles.metaValue}>{stats.osName}</p>
                </div>
              </div>
              {stats.gpuName ? (
                <div className={styles.metaItem}>
                  <Gpu size={18} aria-hidden="true" />
                  <div>
                    <p className={styles.metaLabel}>{t("system.stats.gpu")}</p>
                    <p className={styles.metaValue}>{stats.gpuName}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={styles.bars}>
              <StatBar
                label={t("system.metrics.cpu")}
                value={formatPercent(stats.cpuUsagePercent, locale)}
                percent={stats.cpuUsagePercent}
                icon={Cpu}
              />
              <StatBar
                label={t("system.metrics.ram")}
                value={`${formatBytes(stats.memoryUsedBytes, locale)} / ${formatBytes(stats.memoryTotalBytes, locale)}`}
                percent={memoryPercent}
                icon={HardDrive}
              />
            </div>

            <p className={styles.hint}>{t("system.stats.hint")}</p>
          </div>
        ) : (
          <StatusMessage status={status} error={error} />
        )}
      </ComicPanel>
    </section>
  );
}
