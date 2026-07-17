export type MetricTone = "normal" | "warn" | "critical";

const WARN_AT = 80;
const CRITICAL_AT = 95;
const CPU_HIGH_AT = 90;
const CPU_HIGH_STREAK = 3;
const TEMP_WARN_AT = 80;
const TEMP_CRITICAL_AT = 90;

export function capacityTone(percent: number): MetricTone {
  if (percent >= CRITICAL_AT) return "critical";
  if (percent >= WARN_AT) return "warn";
  return "normal";
}

export function temperatureTone(celsius: number): MetricTone {
  if (celsius >= TEMP_CRITICAL_AT) return "critical";
  if (celsius >= TEMP_WARN_AT) return "warn";
  return "normal";
}

/** Worst tone among the provided values (critical > warn > normal). */
export function worstTone(...tones: MetricTone[]): MetricTone {
  if (tones.includes("critical")) return "critical";
  if (tones.includes("warn")) return "warn";
  return "normal";
}

/** Tracks consecutive CPU samples above the high threshold. */
export function createCpuAlertTracker(streakNeeded = CPU_HIGH_STREAK) {
  let streak = 0;

  return {
    next(usagePercent: number): MetricTone {
      if (usagePercent >= CPU_HIGH_AT) {
        streak += 1;
      } else {
        streak = 0;
      }

      if (streak >= streakNeeded) return "critical";
      return "normal";
    },
    reset() {
      streak = 0;
    },
  };
}
