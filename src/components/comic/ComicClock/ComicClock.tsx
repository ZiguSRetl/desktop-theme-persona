import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useEffectiveReducedMotion } from "../../../features/settings/useAnimationProfile";
import { DecorativeBurst } from "../DecorativeBurst";
import { comicEnter } from "../../../lib/motionPresets";
import styles from "./ComicClock.module.css";

function formatHoursMinutes(date: Date): string {
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSeconds(date: Date): string {
  return date.toLocaleTimeString("es-ES", { second: "2-digit" }).slice(-2);
}

function formatWeekday(date: Date): string {
  return date.toLocaleDateString("es-ES", { weekday: "long" }).toUpperCase();
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ComicClock() {
  const [now, setNow] = useState(() => new Date());
  const reduceMotion = useEffectiveReducedMotion();

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <motion.section
      className={styles.clock}
      aria-label="Reloj del sistema"
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

      <span className={styles.weekday}>{formatWeekday(now)}</span>

      <div className={styles.timeRow}>
        <motion.span
          className={styles.timeMain}
          key={formatHoursMinutes(now)}
          initial={reduceMotion ? false : { scale: 1 }}
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 0.15 }}
        >
          {formatHoursMinutes(now)}
        </motion.span>
        <motion.span
          className={styles.timeSeconds}
          key={formatSeconds(now)}
          initial={reduceMotion ? false : { y: -4, opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.12 }}
        >
          {formatSeconds(now)}
        </motion.span>
      </div>

      <div className={styles.dateBand}>
        <span className={styles.date}>{formatDateShort(now)}</span>
      </div>
    </motion.section>
  );
}
