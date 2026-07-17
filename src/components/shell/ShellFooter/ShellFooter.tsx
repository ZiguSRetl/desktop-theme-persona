import { SystemMonitor } from "../SystemMonitor";
import { useSystemStats } from "../../../features/system/useSystemStats";
import styles from "./ShellFooter.module.css";

export function ShellFooter() {
  const { metrics, status, error } = useSystemStats();

  return (
    <footer className={styles.footer} aria-label="Estado del sistema">
      <SystemMonitor metrics={metrics} status={status} error={error} />
    </footer>
  );
}
