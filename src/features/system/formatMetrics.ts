const percentFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 0,
});

const valueFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const RATE_UNITS = ["B/s", "KB/s", "MB/s", "GB/s"] as const;
const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Clamp percent into [0, 100]. */
export function normalizePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function usagePercent(usedBytes: number, totalBytes: number): number {
  if (!Number.isFinite(usedBytes) || !Number.isFinite(totalBytes) || totalBytes <= 0) {
    return 0;
  }
  return normalizePercent((usedBytes / totalBytes) * 100);
}

export function formatPercent(value: number): string {
  return `${percentFormatter.format(Math.round(normalizePercent(value)))}%`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const rounded = exponent === 0 ? Math.round(value) : value;

  return `${valueFormatter.format(rounded)} ${BYTE_UNITS[exponent]}`;
}

export function formatByteRate(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return `0 ${RATE_UNITS[0]}`;
  }

  const exponent = Math.min(
    Math.floor(Math.log(bytesPerSecond) / Math.log(1024)),
    RATE_UNITS.length - 1,
  );
  const value = bytesPerSecond / 1024 ** exponent;
  const rounded = exponent === 0 ? Math.round(value) : value;

  return `${valueFormatter.format(rounded)} ${RATE_UNITS[exponent]}`;
}

export function formatMemorySecondary(usedBytes: number, totalBytes: number): string {
  return `${formatBytes(usedBytes)} / ${formatBytes(totalBytes)}`;
}

export function formatDiskSecondary(usedBytes: number, totalBytes: number): string {
  return formatMemorySecondary(usedBytes, totalBytes);
}

export function formatNetworkPair(downloadBps: number, uploadBps: number): {
  download: string;
  upload: string;
  ariaLabel: string;
} {
  const download = formatByteRate(downloadBps);
  const upload = formatByteRate(uploadBps);
  return {
    download,
    upload,
    ariaLabel: `Descarga ${download}, subida ${upload}`,
  };
}

export function formatTemperature(celsius: number): string {
  if (!Number.isFinite(celsius)) return "--";
  return `${percentFormatter.format(Math.round(celsius))} °C`;
}

export function formatGpuVram(usedBytes: number | null, totalBytes: number | null): string | null {
  if (usedBytes === null || totalBytes === null) return null;
  return formatMemorySecondary(usedBytes, totalBytes);
}
