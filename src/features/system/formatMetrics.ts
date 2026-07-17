const DEFAULT_LOCALE = "en-US";

const percentFormatters = new Map<string, Intl.NumberFormat>();
const valueFormatters = new Map<string, Intl.NumberFormat>();

function getPercentFormatter(locale: string): Intl.NumberFormat {
  let formatter = percentFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    percentFormatters.set(locale, formatter);
  }
  return formatter;
}

function getValueFormatter(locale: string): Intl.NumberFormat {
  let formatter = valueFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    });
    valueFormatters.set(locale, formatter);
  }
  return formatter;
}

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

export function formatPercent(value: number, locale: string = DEFAULT_LOCALE): string {
  return `${getPercentFormatter(locale).format(Math.round(normalizePercent(value)))}%`;
}

export function formatBytes(bytes: number, locale: string = DEFAULT_LOCALE): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const rounded = exponent === 0 ? Math.round(value) : value;

  return `${getValueFormatter(locale).format(rounded)} ${BYTE_UNITS[exponent]}`;
}

export function formatByteRate(bytesPerSecond: number, locale: string = DEFAULT_LOCALE): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return `0 ${RATE_UNITS[0]}`;
  }

  const exponent = Math.min(
    Math.floor(Math.log(bytesPerSecond) / Math.log(1024)),
    RATE_UNITS.length - 1,
  );
  const value = bytesPerSecond / 1024 ** exponent;
  const rounded = exponent === 0 ? Math.round(value) : value;

  return `${getValueFormatter(locale).format(rounded)} ${RATE_UNITS[exponent]}`;
}

export function formatMemorySecondary(
  usedBytes: number,
  totalBytes: number,
  locale: string = DEFAULT_LOCALE,
): string {
  return `${formatBytes(usedBytes, locale)} / ${formatBytes(totalBytes, locale)}`;
}

export function formatDiskSecondary(
  usedBytes: number,
  totalBytes: number,
  locale: string = DEFAULT_LOCALE,
): string {
  return formatMemorySecondary(usedBytes, totalBytes, locale);
}

export function formatNetworkPair(
  downloadBps: number,
  uploadBps: number,
  locale: string = DEFAULT_LOCALE,
): { download: string; upload: string } {
  return {
    download: formatByteRate(downloadBps, locale),
    upload: formatByteRate(uploadBps, locale),
  };
}

export function formatTemperature(celsius: number, locale: string = DEFAULT_LOCALE): string {
  if (!Number.isFinite(celsius)) return "--";
  return `${getPercentFormatter(locale).format(Math.round(celsius))} °C`;
}

export function formatGpuVram(
  usedBytes: number | null,
  totalBytes: number | null,
  locale: string = DEFAULT_LOCALE,
): string | null {
  if (usedBytes === null || totalBytes === null) return null;
  return formatMemorySecondary(usedBytes, totalBytes, locale);
}
