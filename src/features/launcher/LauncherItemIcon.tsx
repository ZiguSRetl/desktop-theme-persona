import {
  AppWindow,
  ExternalLink,
  FolderOpen,
  Gamepad2,
  type LucideIcon,
} from "lucide-react";
import type { LauncherItemType } from "../../types/desktop";
import { displayIconUrl } from "./iconService";
import styles from "./LauncherItemIcon.module.css";

const iconByType: Record<LauncherItemType, LucideIcon> = {
  application: AppWindow,
  game: Gamepad2,
  folder: FolderOpen,
  url: ExternalLink,
};

interface LauncherItemIconProps {
  type: LauncherItemType;
  icon?: string;
  className?: string;
}

export function LauncherItemIcon({ type, icon, className }: LauncherItemIconProps) {
  const wrapClass = icon
    ? `${styles.wrap} ${styles.wrapHasImage}${className ? ` ${className}` : ""}`
    : className
      ? `${styles.wrap} ${className}`
      : styles.wrap;

  if (icon) {
    return (
      <span className={wrapClass} aria-hidden="true">
        <img className={styles.image} src={displayIconUrl(icon)} alt="" draggable={false} />
      </span>
    );
  }

  const Icon = iconByType[type];

  return (
    <span className={wrapClass} aria-hidden="true">
      <Icon className={styles.fallbackIcon} strokeWidth={2} />
    </span>
  );
}
