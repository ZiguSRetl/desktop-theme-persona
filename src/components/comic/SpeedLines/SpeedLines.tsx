import type { CSSProperties } from "react";
import { motion } from "motion/react";
import { useEffectiveReducedMotion } from "../../../features/settings/useAnimationProfile";
import styles from "./SpeedLines.module.css";

type SpeedDirection = "radial" | "diagonal-left" | "diagonal-right";

interface SpeedLinesProps {
  visible?: boolean;
  direction?: SpeedDirection;
  intensity?: "low" | "medium" | "high";
  className?: string;
}

export function SpeedLines({
  visible = false,
  direction = "diagonal-left",
  intensity = "medium",
  className = "",
}: SpeedLinesProps) {
  const reduceMotion = useEffectiveReducedMotion();

  if (reduceMotion || !visible) return null;

  const lineCount = intensity === "low" ? 4 : intensity === "high" ? 10 : 7;

  return (
    <motion.div
      className={`${styles.container} ${styles[direction]} ${styles[intensity]} ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      aria-hidden="true"
    >
      {Array.from({ length: lineCount }, (_, i) => (
        <span
          key={i}
          className={styles.line}
          style={{
            "--line-index": i,
            "--line-offset": `${(i - lineCount / 2) * 8}px`,
          } as CSSProperties}
        />
      ))}
    </motion.div>
  );
}
