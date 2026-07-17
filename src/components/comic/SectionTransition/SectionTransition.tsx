import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocation, useOutlet } from "react-router-dom";
import { playUiSound } from "../../../features/audio/soundService";
import {
  useEffectiveReducedMotion,
  useMotionDurationMultiplier,
} from "../../../features/settings/useAnimationProfile";
import { pageTransition, reducedMotionTransition } from "../../../lib/motionPresets";
import styles from "./SectionTransition.module.css";

export function SectionTransition() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduceMotion = useEffectiveReducedMotion();
  const durationMultiplier = useMotionDurationMultiplier();
  const [isVisible, setIsVisible] = useState(
    () => typeof document !== "undefined" && document.visibilityState === "visible",
  );
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      playUiSound("page");
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);

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
          skewX: -3,
          scale: 0.97,
        },
        animate: {
          opacity: 1,
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
          skewX: 0,
          scale: 1,
        },
        exit: {
          opacity: 0,
          clipPath: "polygon(100% 0, 100% 0, 100% 100%, 100% 100%)",
          skewX: 3,
          scale: 0.96,
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
          transition={
            reduceMotion
              ? reducedMotionTransition
              : {
                  ...pageTransition,
                  duration: pageTransition.duration * durationMultiplier,
                }
          }
        >
          {outlet}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
