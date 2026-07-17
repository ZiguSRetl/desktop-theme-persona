import { useT } from "../../i18n";
import styles from "./LauncherAddTile.module.css";

interface LauncherAddTileProps {
  label?: string;
  onClick: () => void;
}

export function LauncherAddTile({ label, onClick }: LauncherAddTileProps) {
  const t = useT();
  const resolvedLabel = label ?? t("launcher.add");

  return (
    <button type="button" className={styles.addTile} onClick={onClick} aria-label={resolvedLabel}>
      <span className={styles.icon} aria-hidden="true">
        +
      </span>
      <span className={styles.label}>{resolvedLabel}</span>
    </button>
  );
}
