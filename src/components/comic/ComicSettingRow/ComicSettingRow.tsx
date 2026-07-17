import type { ReactNode } from "react";
import { ComicPanel } from "../ComicPanel";
import styles from "./ComicSettingRow.module.css";

interface ComicSettingRowProps {
  label: string;
  description?: string;
  badge?: string;
  children: ReactNode;
  rotation?: number;
}

export function ComicSettingRow({
  label,
  description,
  badge,
  children,
  rotation = 0,
}: ComicSettingRowProps) {
  return (
    <ComicPanel variant="white" shadowColor="black" rotation={rotation} className={styles.row}>
      <div className={styles.content}>
        <div className={styles.text}>
          <p className={styles.label}>{label}</p>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        <div className={styles.control}>{children}</div>
      </div>
      {badge ? <span className={styles.badge}>{badge}</span> : null}
    </ComicPanel>
  );
}
