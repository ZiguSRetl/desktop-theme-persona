import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useEffectiveReducedMotion } from "../../../features/settings/useAnimationProfile";
import { useSettingsStore } from "../../../features/settings/settingsStore";
import { getLocaleTag, useT } from "../../../i18n";
import { DecorativeBurst } from "../DecorativeBurst";
import { comicEnter } from "../../../lib/motionPresets";
import styles from "./ComicClock.module.css";

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

export function ComicClock({ desktop = false }: { desktop?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  const reduceMotion = useEffectiveReducedMotion();
  const t = useT();
  const language = useSettingsStore((state) => state.settings.language);
  const locale = getLocaleTag(language);
  const timeFormat = useMemo(() => new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }), [locale]);

  useEffect(() => {
    let timer: number;
    const tick = () => {
      const current = new Date();
      setNow(current);
      timer = window.setTimeout(tick, 1000 - current.getMilliseconds());
    };
    const syncVisibility = () => {
      window.clearTimeout(timer);
      if (!document.hidden) tick();
    };
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  const parts = timeFormat.formatToParts(now);
  const secondsIndex = parts.findIndex(({ type }) => type === "second");
  const timeMain = parts.slice(0, secondsIndex - 1).map(({ value }) => value).join("");
  const separator = parts[secondsIndex - 1]?.value;
  const seconds = parts[secondsIndex]?.value;
  const timeSuffix = parts.slice(secondsIndex + 1).map(({ value }) => value).join("").trim();

  return (
    <motion.section
      className={styles.clock}
      data-desktop={desktop ? "" : undefined}
      data-reduced-motion={reduceMotion}
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

      <time className={styles.timeRow} dateTime={now.toISOString()} aria-label={timeFormat.format(now)}>
        <span className={styles.timeMain} aria-hidden="true">{timeMain}</span>
        <span className={styles.timeSeconds} aria-hidden="true">
          <span key={seconds} className={styles.tick}>{separator}{seconds}</span>
        </span>
        {timeSuffix ? <span className={styles.timeSuffix} aria-hidden="true">{timeSuffix}</span> : null}
      </time>

      <div className={styles.dateBand}>
        <span className={styles.date}>{formatDateShort(now, locale)}</span>
      </div>
    </motion.section>
  );
}
