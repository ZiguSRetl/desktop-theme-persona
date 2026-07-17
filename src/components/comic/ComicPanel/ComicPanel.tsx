import type { CSSProperties, ReactNode } from "react";
import styles from "./ComicPanel.module.css";

type ComicPanelVariant = "white" | "red" | "black";
type ShadowColor = "black" | "red" | "white" | "none";

interface ComicPanelProps {
  variant?: ComicPanelVariant;
  rotation?: number;
  shadowColor?: ShadowColor;
  className?: string;
  children: ReactNode;
}

const clipPaths = [
  "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))",
  "polygon(0 8px, 8px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)",
  "polygon(0 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%)",
];

export function ComicPanel({
  variant = "black",
  rotation = 0,
  shadowColor = "black",
  className = "",
  children,
}: ComicPanelProps) {
  const clipIndex = Math.abs(Math.round(rotation * 10)) % clipPaths.length;

  const style = {
    "--panel-rotation": `${rotation}deg`,
    clipPath: clipPaths[clipIndex],
  } as CSSProperties;

  return (
    <div
      className={`${styles.panel} ${styles[variant]} ${styles[`shadow-${shadowColor}`]} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
