import { useEffect, useState } from "react";
import type { GpuDevice } from "../../types/desktop";
import { listGpus } from "./systemService";

interface UseGpuDevicesResult {
  devices: GpuDevice[];
  status: "loading" | "ready" | "unavailable" | "error";
  error: string | null;
}

export function useGpuDevices(): UseGpuDevicesResult {
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
        setError(err instanceof Error ? err.message : "No se pudieron listar las GPU.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { devices, status, error };
}
