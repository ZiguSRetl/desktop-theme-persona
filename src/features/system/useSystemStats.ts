import { useEffect, useRef, useState } from "react";
import { useSetting } from "../settings/settingsStore";
import { useT } from "../../i18n";
import { fetchSystemMetrics } from "./systemService";
import type { SystemMetrics, SystemMonitorStatus } from "./types";

const POLL_INTERVAL_MS = 2000;

interface UseSystemStatsResult {
  metrics: SystemMetrics | null;
  status: SystemMonitorStatus;
  error: string | null;
}

export type SystemStatsStatus = SystemMonitorStatus | "idle";

export function useSystemStats(): UseSystemStatsResult {
  const t = useT();
  const selectedGpuId = useSetting("selectedGpuId");
  const [reading, setReading] = useState<UseSystemStatsResult>({
    metrics: null,
    status: "loading",
    error: null,
  });
  const requestInProgress = useRef(false);

  useEffect(() => {
    let disposed = false;
    let intervalId: number | undefined;

    const refresh = async () => {
      if (requestInProgress.current || document.hidden) return;
      requestInProgress.current = true;

      try {
        const metrics = await fetchSystemMetrics(selectedGpuId);
        if (disposed) return;
        setReading((previous) => ({
          metrics: metrics ?? previous.metrics,
          status: metrics ? "ready" : "unavailable",
          error: null,
        }));
      } catch (error) {
        if (disposed) return;
        const message = typeof error === "string"
          ? error
          : error instanceof Error ? error.message : t("system.errors.readStats");
        setReading((previous) => ({ ...previous, status: "error", error: message }));
      } finally {
        requestInProgress.current = false;
      }
    };

    const syncPolling = () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
      if (document.hidden) return;
      void refresh();
      intervalId = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    };

    queueMicrotask(() => {
      if (!disposed) syncPolling();
    });
    document.addEventListener("visibilitychange", syncPolling);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", syncPolling);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [selectedGpuId, t]);

  return reading;
}
