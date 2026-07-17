import { Loader2 } from "lucide-react";
import type { CSSProperties } from "react";
import { SpeedLines } from "../../components/comic/SpeedLines";
import type { ScriptDefinition } from "./scriptRegistry";
import styles from "./ScriptTile.module.css";

interface ScriptTileProps {
  script: ScriptDefinition;
  selected?: boolean;
  running?: boolean;
  onSelect: () => void;
}

export function ScriptTile({ script, selected = false, running = false, onSelect }: ScriptTileProps) {
  const Icon = script.icon;

  return (
    <button
      type="button"
      className={`${styles.tile} ${selected ? styles.selected : ""} ${running ? styles.running : ""}`}
      aria-pressed={selected}
      aria-busy={running}
      aria-label={script.name}
      onClick={onSelect}
      disabled={running}
      style={{ "--script-accent": script.accent } as CSSProperties}
    >
      <SpeedLines className={styles.speedLines} visible direction="diagonal-right" intensity="low" />
      <span className={styles.iconWrap} aria-hidden="true">
        {running ? <Loader2 className={styles.spinner} size={32} /> : <Icon size={32} />}
      </span>
      <span className={styles.name}>{script.name}</span>
    </button>
  );
}
