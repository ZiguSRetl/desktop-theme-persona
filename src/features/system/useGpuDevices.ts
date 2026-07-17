import { useEffect, useState } from "react";
import type { GpuDevice } from "../../types/desktop";
import { useT } from "../../i18n";
import { listGpus } from "./systemService";

interface UseGpuDevicesResult {
  devices: GpuDevice[];
  status: "loading" | "ready" | "unavailable" | "error";
  error: string | null;
}

export function useGpuDevices(): UseGpuDevicesResult {
  const t = useT();
  const [devices, setDevices] = useState<GpuDevice[]>([]);
  const [status, setStatus] = useState<UseGpuDevicesResult["status"]>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const next = await listGpus();
        if (cancelled) return;
        setDevices(next);
        setStatus("ready");
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setDevices([]);
        setStatus("error");
        setError(err instanceof Error ? err.message : t("system.errors.listGpus"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t]);

  return { devices, status, error };
}
