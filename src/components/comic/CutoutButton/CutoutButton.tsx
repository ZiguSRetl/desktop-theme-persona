import type { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";
import { comicSpring } from "../../../lib/motionPresets";
import { playUiSound, primeAudioContext } from "../../../features/audio/soundService";
import { useEffectiveReducedMotion } from "../../../features/settings/useAnimationProfile";
import styles from "./CutoutButton.module.css";

type CutoutVariant = "default" | "active" | "ghost";

interface CutoutButtonProps {
  children: ReactNode;
  variant?: CutoutVariant;
  rotation?: number;
  clipIndex?: number;
  className?: string;
  onClick?: () => void;
  "aria-label"?: string;
  "aria-current"?: "page" | boolean;
  as?: "button" | "div";
  htmlType?: "button" | "submit";
  disabled?: boolean;
}

const clipPaths = [
  "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)",
  "polygon(0 6px, 6px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)",
  "polygon(0 0, 100% 4px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
  "polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)",
  "polygon(0 0, calc(100% - 8px) 0, 100% 100%, 0 calc(100% - 6px))",
];

export function CutoutButton({
  children,
  variant = "default",
  rotation = 0,
  clipIndex = 0,
  className = "",
  onClick,
  "aria-label": ariaLabel,
  "aria-current": ariaCurrent,
  as = "button",
  htmlType = "button",
  disabled = false,
}: CutoutButtonProps) {
  const reduceMotion = useEffectiveReducedMotion();
  const clip = clipPaths[clipIndex % clipPaths.length];

  const style = {
    "--cutout-rotation": `${rotation}deg`,
    clipPath: clip,
  } as CSSProperties;

  const motionProps = {
    className: `${styles.cutout} ${styles[variant]} ${className}`,
    style,
    whileHover: reduceMotion ? undefined : { scale: 1.03, skewX: -2 },
    whileTap: reduceMotion ? undefined : { scale: 0.97 },
    transition: comicSpring,
    onClick,
    onMouseEnter: () => {
      primeAudioContext();
      playUiSound("hover");
    },
    "aria-label": ariaLabel,
    "aria-current": ariaCurrent,
  };

  if (as === "div") {
    return (
      <motion.div {...motionProps} role="presentation">
        {children}
      </motion.div>
    );
  }

  return (
    <motion.button type={htmlType} disabled={disabled} {...motionProps}>
      {children}
    </motion.button>
  );
}

export { clipPaths as cutoutClipPaths };
