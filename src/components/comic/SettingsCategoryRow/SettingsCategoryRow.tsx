import { ComicPanel } from "../ComicPanel";
import styles from "./SettingsCategoryRow.module.css";

interface SettingsCategoryRowProps {
  label: string;
  onClick: () => void;
  rotation?: number;
}

export function SettingsCategoryRow({
  label,
  onClick,
  rotation = 0,
}: SettingsCategoryRowProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={styles.row}
      onClick={onClick}
      aria-label={label}
    >
      <ComicPanel
        variant="white"
        shadowColor="black"
        rotation={rotation}
        className={styles.panel}
      >
        <div className={styles.content}>
          <p className={styles.label}>{label}</p>
          <span className={styles.chevron} aria-hidden="true">
            ›
          </span>
        </div>
      </ComicPanel>
    </button>
  );
}
