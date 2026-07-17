import { useEffect, useState } from "react";
import styles from "./Clock.module.css";

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <section className={styles.clock} aria-label="Reloj del sistema">
      <div className={styles.frame} aria-hidden="true" />
      <p className={styles.time}>{formatTime(now)}</p>
      <p className={styles.date}>{formatDate(now)}</p>
    </section>
  );
}
