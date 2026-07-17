import { SystemMonitor } from "../SystemMonitor";
import { useSystemStats } from "../../../features/system/useSystemStats";
import { useT } from "../../../i18n";
import styles from "./ShellFooter.module.css";

export function ShellFooter() {
  const t = useT();
  const { metrics, status, error } = useSystemStats();

  return (
    <footer className={styles.footer} aria-label={t("system.footer.aria")}>
      <SystemMonitor metrics={metrics} status={status} error={error} />
    </footer>
  );
}
