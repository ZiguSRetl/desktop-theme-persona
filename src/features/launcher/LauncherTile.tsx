import { GripVertical } from "lucide-react";
import { tt, useT } from "../../i18n";
import type { LauncherItemType } from "../../types/desktop";
import { SpeedLines } from "../../components/comic/SpeedLines";
import { LauncherItemIcon } from "./LauncherItemIcon";
import styles from "./LauncherTile.module.css";

export function tileDisplayName(name: string, target?: string): string {
  const trimmed = name.trim();
  if (trimmed) return trimmed;
  if (target) {
    const segment = target.replace(/[/\\]+$/, "").split(/[/\\]/).pop();
    if (segment) return segment;
  }
  return tt("launcher.unnamed");
}

interface LauncherTileProps {
  name: string;
  target?: string;
  type: LauncherItemType;
  icon?: string;
  selected?: boolean;
  dragging?: boolean;
  sortable?: boolean;
  dragHandleProps?: Record<string, unknown>;
  tabIndex?: number;
  onSelect: () => void;
  onLaunch?: () => void;
  onRemove?: () => void;
}

export function LauncherTile({
  name,
  target,
  type,
  icon,
  selected = false,
  dragging = false,
  sortable = false,
  dragHandleProps,
  tabIndex = 0,
  onSelect,
  onLaunch,
  onRemove,
}: LauncherTileProps) {
  const t = useT();
  const displayName = tileDisplayName(name, target);

  return (
    <button
      type="button"
      className={`${styles.tile} ${selected ? styles.selected : ""} ${dragging ? styles.dragging : ""}`}
      aria-pressed={selected}
      aria-label={displayName}
      tabIndex={tabIndex}
      onClick={onSelect}
      onDoubleClick={(event) => {
        event.preventDefault();
        onLaunch?.();
      }}
      onContextMenu={(event) => {
        if (!onRemove) return;
        event.preventDefault();
        onSelect();
        onRemove();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && onLaunch) {
          event.preventDefault();
          onLaunch();
        }
        if (event.key === "Delete" && onRemove) {
          event.preventDefault();
          onRemove();
        }
      }}
    >
      {sortable && dragHandleProps ? (
        <span
          className={styles.dragHandle}
          aria-label={t("launcher.tile.reorderAria", { name: displayName })}
          {...dragHandleProps}
          onClick={(event) => event.stopPropagation()}
        >
          <GripVertical size={14} aria-hidden="true" />
        </span>
      ) : null}

      {selected ? (
        <div className={styles.speedLines} aria-hidden="true">
          <SpeedLines visible direction="diagonal-right" intensity="medium" />
        </div>
      ) : null}
      <LauncherItemIcon type={type} icon={icon} className={styles.iconWrap} />
      <span className={styles.name}>{displayName}</span>
    </button>
  );
}
