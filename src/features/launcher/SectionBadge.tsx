import { Star } from "lucide-react";
import styles from "./SectionBadge.module.css";

interface SectionBadgeProps {
  label: string;
  showStar?: boolean;
}

export function SectionBadge({ label, showStar = false }: SectionBadgeProps) {
  return (
    <div className={styles.badge}>
      {showStar ? <Star className={styles.badgeIcon} size={16} fill="currentColor" aria-hidden="true" /> : null}
      <span className={styles.badgeText}>{label}</span>
    </div>
  );
}
