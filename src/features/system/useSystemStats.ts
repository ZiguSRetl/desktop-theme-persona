import { useCallback, useEffect, useRef, useState } from "react";
import { useSetting } from "../settings/settingsStore";
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
  const selectedGpuId = useSetting("selectedGpuId");
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [status, setStatus] = useState<SystemMonitorStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(
    () => typeof document !== "undefined" && document.visibilityState === "visible",
  );
  const intervalRef = useRef<number | null>(null);
  const requestInProgress = useRef(false);
  const cpuWarmupDone = useRef(false);

  const refresh = useCallback(async () => {
    if (requestInProgress.current) return;
    if (typeof document !== "undefined" && document.hidden) return;

    requestInProgress.current = true;
    try {
      setStatus((current) => (current === "ready" ? "ready" : "loading"));
      const next = await fetchSystemMetrics(selectedGpuId);

      if (!next) {
        setMetrics(null);
        setStatus("unavailable");
        setError(null);
        cpuWarmupDone.current = false;
        return;
      }

      // First CPU sample from sysinfo is often inaccurate — keep loading until sample 2.
      if (!cpuWarmupDone.current) {
        cpuWarmupDone.current = true;
        setMetrics(next);
        setStatus("loading");
        setError(null);
        return;
      }

      setMetrics(next);
      setStatus("ready");
      setError(null);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "No se pudieron leer las estadísticas.");
    } finally {
      requestInProgress.current = false;
    }
  }, [selectedGpuId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    cpuWarmupDone.current = false;
  }, [selectedGpuId]);

  useEffect(() => {
    if (!isVisible) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- kick off async polling when visible
    void refresh();

    intervalRef.current = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isVisible, refresh]);

  return { metrics, status, error };
}
