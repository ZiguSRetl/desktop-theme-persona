import { motion } from "motion/react";
import { useEffectiveReducedMotion } from "../../../features/settings/useAnimationProfile";
import { DecorativeBurst } from "../DecorativeBurst";
import { comicEnter } from "../../../lib/motionPresets";
import styles from "./ComicPageHeader.module.css";

interface ComicPageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
}

export function ComicPageHeader({ eyebrow, title, subtitle }: ComicPageHeaderProps) {
  const reduceMotion = useEffectiveReducedMotion();

  return (
    <header className={styles.header}>
      <DecorativeBurst
        elements={[
          { type: "cross", top: "0", right: "5%", rotation: 15, size: 16 },
          { type: "slash", bottom: "20%", left: "-2%", rotation: 0, size: 20 },
          { type: "star", top: "40%", right: "-1%", rotation: -10, size: 12 },
        ]}
      />

      <motion.p
        className={styles.eyebrow}
        initial={reduceMotion ? false : { x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...comicEnter, delay: 0.05 }}
      >
        {eyebrow}
      </motion.p>

      <div className={styles.titleWrap}>
        <span className={styles.titleBg} aria-hidden="true" />
        <motion.h1
          className={styles.title}
          initial={reduceMotion ? false : { x: -60, opacity: 0, rotate: -4 }}
          animate={{ x: 0, opacity: 1, rotate: -2 }}
          transition={{ ...comicEnter, delay: 0.08 }}
        >
          {title}
        </motion.h1>
      </div>

      {subtitle ? (
        <motion.p
          className={styles.subtitle}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.2 }}
        >
          {subtitle}
        </motion.p>
      ) : null}

      <div className={`${styles.halftone} halftone-pattern-light`} aria-hidden="true" />
    </header>
  );
}
