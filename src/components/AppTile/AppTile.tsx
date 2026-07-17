import type { CSSProperties } from "react";
import {
  AppWindow,
  ExternalLink,
  FolderOpen,
  Gamepad2,
  type LucideIcon,
} from "lucide-react";
import type { LauncherItemType } from "../../types/desktop";
import styles from "./AppTile.module.css";

const iconByType: Record<LauncherItemType, LucideIcon> = {
  application: AppWindow,
  game: Gamepad2,
  folder: FolderOpen,
  url: ExternalLink,
};

interface AppTileProps {
  name: string;
  type: LauncherItemType;
  accent?: string;
  selected?: boolean;
  tabIndex?: number;
  onSelect?: () => void;
}

export function AppTile({
  name,
  type,
  accent = "var(--color-red)",
  selected = false,
  tabIndex = 0,
  onSelect,
}: AppTileProps) {
  const Icon = iconByType[type];

  return (
    <button
      type="button"
      className={`${styles.tile} ${selected ? styles.selected : ""}`}
      style={{ "--tile-accent": accent } as CSSProperties}
      tabIndex={tabIndex}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className={styles.corner} aria-hidden="true" />
      <span className={styles.iconWrap} aria-hidden="true">
        <Icon size={24} />
      </span>
      <span className={styles.name}>{name}</span>
      <span className={styles.type}>{typeLabel(type)}</span>
    </button>
  );
}

function typeLabel(type: LauncherItemType): string {
  switch (type) {
    case "application":
      return "Aplicación";
    case "game":
      return "Juego";
    case "folder":
      return "Carpeta";
    case "url":
      return "Enlace";
  }
}
