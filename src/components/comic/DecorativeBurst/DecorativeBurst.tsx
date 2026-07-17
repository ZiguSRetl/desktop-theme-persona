import { motion } from "motion/react";
import { useEffectiveReducedMotion } from "../../../features/settings/useAnimationProfile";
import styles from "./DecorativeBurst.module.css";

type BurstElementType = "star" | "cross" | "dot" | "slash";

export interface BurstElement {
  type: BurstElementType;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  rotation?: number;
  size?: number;
  delay?: number;
}

interface DecorativeBurstProps {
  elements?: BurstElement[];
  className?: string;
}

const defaultElements: BurstElement[] = [
  { type: "star", top: "-8px", right: "12px", rotation: 15, size: 14, delay: 0 },
  { type: "cross", bottom: "4px", left: "-6px", rotation: -20, size: 12, delay: 0.05 },
];

function BurstShape({ type, size = 12 }: { type: BurstElementType; size?: number }) {
  switch (type) {
    case "star":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0l2.5 9.5L24 12l-9.5 2.5L12 24l-2.5-9.5L0 12l9.5-2.5L12 0z" />
        </svg>
      );
    case "cross":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M14 0h-4v10H0v4h10v10h4V14h10v-4H14V0z" />
        </svg>
      );
    case "dot":
      return <span className={styles.dot} style={{ width: size, height: size }} />;
    case "slash":
      return <span className={styles.slash} style={{ width: size * 2, height: 3 }} />;
  }
}

export function DecorativeBurst({
  elements = defaultElements,
  className = "",
}: DecorativeBurstProps) {
  const reduceMotion = useEffectiveReducedMotion();

  return (
    <div className={`${styles.burst} ${className}`} aria-hidden="true">
      {elements.map((el, i) => (
        <motion.span
          key={i}
          className={`${styles.element} ${styles[el.type]}`}
          style={{
            top: el.top,
            left: el.left,
            right: el.right,
            bottom: el.bottom,
            rotate: el.rotation ?? 0,
          }}
          initial={reduceMotion ? false : { opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: el.delay ?? i * 0.04,
            duration: 0.2,
            ease: [0.34, 1.56, 0.64, 1],
          }}
        >
          <BurstShape type={el.type} size={el.size} />
        </motion.span>
      ))}
    </div>
  );
}
