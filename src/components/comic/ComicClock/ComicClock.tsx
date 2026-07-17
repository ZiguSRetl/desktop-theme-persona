import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useEffectiveReducedMotion } from "../../../features/settings/useAnimationProfile";
import { useSettingsStore } from "../../../features/settings/settingsStore";
import { getLocaleTag, useT } from "../../../i18n";
import { DecorativeBurst } from "../DecorativeBurst";
import { comicEnter } from "../../../lib/motionPresets";
import styles from "./ComicClock.module.css";

function formatHoursMinutes(date: Date, locale: string): string {
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSeconds(date: Date, locale: string): string {
  return date.toLocaleTimeString(locale, { second: "2-digit" }).slice(-2);
}

function formatWeekday(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { weekday: "long" }).toUpperCase();
}

function formatDateShort(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ComicClock() {
  const [now, setNow] = useState(() => new Date());
  const reduceMotion = useEffectiveReducedMotion();
  const t = useT();
  const language = useSettingsStore((state) => state.settings.language);
  const locale = getLocaleTag(language);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <motion.section
      className={styles.clock}
      aria-label={t("clock.ariaLabel")}
      initial={reduceMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={comicEnter}
    >
      <div className={styles.burst} aria-hidden="true" />
      <DecorativeBurst
        elements={[
          { type: "star", top: "0", right: "-4px", rotation: 20, size: 10 },
          { type: "dot", bottom: "8px", left: "-8px", size: 6 },
        ]}
      />

      <span className={styles.weekday}>{formatWeekday(now, locale)}</span>

      <div className={styles.timeRow}>
        <motion.span
          className={styles.timeMain}
          key={formatHoursMinutes(now, locale)}
          initial={reduceMotion ? false : { scale: 1 }}
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 0.15 }}
        >
          {formatHoursMinutes(now, locale)}
        </motion.span>
        <motion.span
          className={styles.timeSeconds}
          key={formatSeconds(now, locale)}
          initial={reduceMotion ? false : { y: -4, opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.12 }}
        >
          {formatSeconds(now, locale)}
        </motion.span>
      </div>

      <div className={styles.dateBand}>
        <span className={styles.date}>{formatDateShort(now, locale)}</span>
      </div>
    </motion.section>
  );
}
