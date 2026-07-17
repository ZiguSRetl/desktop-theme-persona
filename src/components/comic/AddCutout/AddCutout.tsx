import { Plus } from "lucide-react";
import { motion } from "motion/react";
import { useEffectiveReducedMotion } from "../../../features/settings/useAnimationProfile";
import { comicSpring } from "../../../lib/motionPresets";
import styles from "./AddCutout.module.css";

interface AddCutoutProps {
  label?: string;
  onClick: () => void;
}

export function AddCutout({ label = "Añadir", onClick }: AddCutoutProps) {
  const reduceMotion = useEffectiveReducedMotion();

  return (
    <motion.button
      type="button"
      className={styles.addCutout}
      onClick={onClick}
      aria-label={label}
      whileHover={reduceMotion ? undefined : { scale: 1.06, rotate: 1.5, transition: comicSpring }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
    >
      <span className={styles.iconWrap} aria-hidden="true">
        <Plus size={36} strokeWidth={3} />
      </span>
      <span className={styles.label}>{label}</span>
    </motion.button>
  );
}
