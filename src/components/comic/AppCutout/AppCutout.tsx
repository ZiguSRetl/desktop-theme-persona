import { useState } from "react";
import type { CSSProperties } from "react";
import {
  AppWindow,
  ExternalLink,
  FolderOpen,
  Gamepad2,
  GripVertical,
  Pencil,
  Star,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useT } from "../../../i18n";
import type { LauncherItemType } from "../../../types/desktop";
import {
  useEffectiveReducedMotion,
  useMotionScale,
} from "../../../features/settings/useAnimationProfile";
import { comicSpring } from "../../../lib/motionPresets";
import { playUiSound, primeAudioContext } from "../../../features/audio/soundService";
import { DecorativeBurst } from "../DecorativeBurst";
import { SpeedLines } from "../SpeedLines";
import styles from "./AppCutout.module.css";

const iconByType: Record<LauncherItemType, LucideIcon> = {
  application: AppWindow,
  game: Gamepad2,
  folder: FolderOpen,
  url: ExternalLink,
};

type CutoutVariant = "white" | "red" | "black";

interface AppCutoutProps {
  id: string;
  name: string;
  type: LauncherItemType;
  category?: string;
  index?: number;
  accent?: string;
  tabIndex?: number;
  isFavorite?: boolean;
  confirmDelete?: boolean;
  sortable?: boolean;
  dragHandleProps?: Record<string, unknown>;
  onLaunch?: () => void;
  onRemove?: () => void;
  onEdit?: () => void;
  onToggleFavorite?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const variantCycle: CutoutVariant[] = ["white", "red", "black"];
const rotations = [-2.5, 1.5, -1, 2, -2, 1];

const clipPaths = [
  "polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px))",
  "polygon(0 10px, 10px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)",
  "polygon(0 0, 100% 6px, 100% 100%, 12px 100%, 0 calc(100% - 12px))",
];

function typeLabel(t: ReturnType<typeof useT>, type: LauncherItemType): string {
  switch (type) {
    case "application":
      return t("launcher.types.application.cap");
    case "game":
      return t("launcher.types.game.cap");
    case "folder":
      return t("launcher.types.folder.cap");
    case "url":
      return t("launcher.types.url.cap");
  }
}

export function AppCutout({
  name,
  type,
  category,
  index = 0,
  accent,
  tabIndex = 0,
  isFavorite = false,
  confirmDelete = false,
  sortable = false,
  dragHandleProps,
  onLaunch,
  onRemove,
  onEdit,
  onToggleFavorite,
  onMoveUp,
  onMoveDown,
}: AppCutoutProps) {
  const t = useT();
  const [isHovered, setIsHovered] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const reduceMotion = useEffectiveReducedMotion();
  const motionScale = useMotionScale();
  const Icon = iconByType[type];

  const variant = variantCycle[index % variantCycle.length];
  const rotation = rotations[index % rotations.length];
  const clipPath = clipPaths[index % clipPaths.length];

  const handleClick = () => {
    if (isLaunching) return;
    primeAudioContext();
    playUiSound("launch");
    setIsLaunching(true);

    if (reduceMotion) {
      onLaunch?.();
      setIsLaunching(false);
      return;
    }

    window.setTimeout(() => {
      onLaunch?.();
      setIsLaunching(false);
    }, 280);
  };

  return (
    <motion.div
      role="button"
      tabIndex={tabIndex}
      className={`app-cutout ${styles.cutout} ${styles[variant]} ${isHovered ? styles.hovered : ""} ${isLaunching ? styles.launching : ""}`}
      style={
        {
          "--cutout-rotation": `${rotation}deg`,
          "--cutout-accent": accent ?? "var(--color-red)",
          clipPath,
        } as CSSProperties
      }
      layout
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick();
        }
      }}
      onContextMenu={(event) => {
        if (!onRemove) return;
        event.preventDefault();
        onRemove();
      }}
      whileHover={
        reduceMotion
          ? undefined
          : { scale: 1.08 * motionScale, rotate: rotation + 2, transition: comicSpring }
      }
      whileTap={reduceMotion ? undefined : { scale: 1.15 * motionScale }}
      transition={comicSpring}
    >
      <SpeedLines visible={isHovered && !reduceMotion} direction="diagonal-left" intensity="medium" />

      <AnimatePresence>
        {isLaunching && !reduceMotion && (
          <motion.span
            className={styles.flash}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
          />
        )}
      </AnimatePresence>

      <DecorativeBurst
        elements={[
          {
            type: "dot",
            top: "-4px",
            right: "8px",
            size: 8,
            delay: index * 0.02,
          },
        ]}
      />

      {sortable && dragHandleProps ? (
        <button
          type="button"
          className={styles.dragHandle}
          aria-label={t("launcher.tile.reorderAria", { name })}
          {...dragHandleProps}
          onClick={(event) => event.stopPropagation()}
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
      ) : null}

      {onToggleFavorite ? (
        <button
          type="button"
          className={`${styles.favoriteBtn} ${isFavorite ? styles.favoriteBtnActive : ""}`}
          aria-label={
            isFavorite
              ? t("launcher.cutout.removeFavoriteAria", { name })
              : t("launcher.cutout.addFavoriteAria", { name })
          }
          aria-pressed={isFavorite}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
        >
          <Star size={14} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" />
        </button>
      ) : null}

      {onEdit ? (
        <button
          type="button"
          className={styles.editBtn}
          aria-label={t("launcher.cutout.editAria", { name })}
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
      ) : null}

      <span className={styles.iconWrap} aria-hidden="true">
        <Icon size={32} strokeWidth={2.5} />
      </span>
      <span className={styles.name}>{name}</span>
      <span className={styles.category}>{category ?? typeLabel(t, type)}</span>

      {(onMoveUp || onMoveDown) && (
        <div className={styles.reorderBtns}>
          {onMoveUp ? (
            <button
              type="button"
              className={styles.reorderBtn}
              aria-label={t("launcher.cutout.moveUpAria", { name })}
              onClick={(event) => {
                event.stopPropagation();
                onMoveUp();
              }}
            >
              ↑
            </button>
          ) : null}
          {onMoveDown ? (
            <button
              type="button"
              className={styles.reorderBtn}
              aria-label={t("launcher.cutout.moveDownAria", { name })}
              onClick={(event) => {
                event.stopPropagation();
                onMoveDown();
              }}
            >
              ↓
            </button>
          ) : null}
        </div>
      )}

      {onRemove ? (
        <button
          type="button"
          className={`${styles.removeBtn} ${confirmDelete ? styles.removeBtnConfirm : ""}`}
          aria-label={
            confirmDelete
              ? t("launcher.cutout.confirmRemoveAria", { name })
              : t("launcher.cutout.removeAria", { name })
          }
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          {confirmDelete ? t("launcher.cutout.confirmRemove") : "×"}
        </button>
      ) : null}
    </motion.div>
  );
}
