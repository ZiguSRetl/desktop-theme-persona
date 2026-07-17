import { Plus } from "lucide-react";
import { motion } from "motion/react";
import { useT } from "../../../i18n";
import { useEffectiveReducedMotion } from "../../../features/settings/useAnimationProfile";
import { comicSpring } from "../../../lib/motionPresets";
import styles from "./AddCutout.module.css";

interface AddCutoutProps {
  label?: string;
  onClick: () => void;
}

export function AddCutout({ label, onClick }: AddCutoutProps) {
  const t = useT();
  const reduceMotion = useEffectiveReducedMotion();
  const resolvedLabel = label ?? t("launcher.add");

  return (
    <motion.button
      type="button"
      className={styles.addCutout}
      onClick={onClick}
      aria-label={resolvedLabel}
      whileHover={reduceMotion ? undefined : { scale: 1.06, rotate: 1.5, transition: comicSpring }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
    >
      <span className={styles.iconWrap} aria-hidden="true">
        <Plus size={36} strokeWidth={3} />
      </span>
      <span className={styles.label}>{resolvedLabel}</span>
    </motion.button>
  );
}
