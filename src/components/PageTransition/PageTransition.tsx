import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocation, useOutlet } from "react-router-dom";
import { useEffectiveReducedMotion } from "../../features/settings/useAnimationProfile";
import styles from "./PageTransition.module.css";

export function PageTransition() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduceMotion = useEffectiveReducedMotion();
  const [isVisible, setIsVisible] = useState(
    () => typeof document !== "undefined" && document.visibilityState === "visible",
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const pageVariants = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: {
          opacity: 0,
          clipPath: "polygon(0 0, 0 0, 0 100%, 0 100%)",
          scale: 0.99,
        },
        animate: {
          opacity: 1,
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
          scale: 1,
        },
        exit: {
          opacity: 0,
          clipPath: "polygon(100% 0, 100% 0, 100% 100%, 100% 100%)",
          scale: 0.98,
        },
      };

  return (
    <div className={styles.wrapper} data-window-visible={isVisible}>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          className={styles.page}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageVariants}
          transition={{
            duration: reduceMotion ? 0.15 : 0.42,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {outlet}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
