import styles from "./LauncherAddTile.module.css";

interface LauncherAddTileProps {
  label?: string;
  onClick: () => void;
}

export function LauncherAddTile({ label = "Añadir", onClick }: LauncherAddTileProps) {
  return (
    <button type="button" className={styles.addTile} onClick={onClick} aria-label={label}>
      <span className={styles.icon} aria-hidden="true">
        +
      </span>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
