import { SystemMonitor } from "../SystemMonitor";
import { useSystemStats } from "../../../features/system/useSystemStats";
import { useT } from "../../../i18n";
import styles from "./ShellFooter.module.css";

export const SYSTEM_WIDGET_ID = "desktop-system-widget";

export function ShellFooter({ desktop, expanded }: { desktop: boolean; expanded: boolean }) {
  const t = useT();
  const { metrics, status, error } = useSystemStats();

  return (
    <footer
      id={SYSTEM_WIDGET_ID}
      className={desktop ? styles.widget : styles.footer}
      data-expanded={expanded}
      aria-label={t("system.footer.aria")}
    >
      <SystemMonitor
        metrics={metrics}
        status={status}
        error={error}
        widget={desktop}
        compact={desktop && !expanded}
      />
    </footer>
  );
}
