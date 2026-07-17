import { AnimatePresence, motion } from "motion/react";
import { useEffectiveReducedMotion } from "../../../features/settings/useAnimationProfile";
import { useToastStore } from "../../../features/launcher/toastStore";
import { useT } from "../../../i18n";
import styles from "./ComicToast.module.css";

export function ComicToast() {
  const message = useToastStore((state) => state.message);
  const variant = useToastStore((state) => state.variant);
  const clear = useToastStore((state) => state.clear);
  const reduceMotion = useEffectiveReducedMotion();
  const t = useT();

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          className={`${styles.toast} ${styles[variant]}`}
          role="alert"
          initial={reduceMotion ? false : { y: -20, opacity: 0, rotate: -2 }}
          animate={{ y: 0, opacity: 1, rotate: -1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <p className={styles.message}>{message}</p>
          <button type="button" className={styles.close} onClick={clear} aria-label={t("toast.closeAria")}>
            ×
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
