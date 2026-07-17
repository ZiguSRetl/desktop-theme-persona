import { useEffect, useState } from "react";
import { getLocaleTag, useT } from "../../i18n";
import { useSettingsStore } from "../../features/settings/settingsStore";
import styles from "./Clock.module.css";

function formatTime(date: Date, locale: string): string {
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function Clock() {
  const [now, setNow] = useState(() => new Date());
  const t = useT();
  const language = useSettingsStore((state) => state.settings.language);
  const locale = getLocaleTag(language);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <section className={styles.clock} aria-label={t("clock.ariaLabel")}>
      <div className={styles.frame} aria-hidden="true" />
      <p className={styles.time}>{formatTime(now, locale)}</p>
      <p className={styles.date}>{formatDate(now, locale)}</p>
    </section>
  );
}
