/** Host OS family for platform-specific product behavior (desktop shell, filters, nav). */

import type { WindowMode } from "../../types/desktop";

export type OsFamily = "windows" | "linux" | "macos" | "other";

let testOverride: OsFamily | null = null;

/** Vitest-only: force platform detection. Pass `null` to clear. */
export function setOsFamilyOverrideForTests(family: OsFamily | null): void {
  testOverride = family;
}

export function detectHostOsFamily(): OsFamily {
  if (testOverride) return testOverride;
  if (typeof navigator === "undefined") return "other";

  const platform = (navigator.platform ?? "").toLowerCase();
  const ua = (navigator.userAgent ?? "").toLowerCase();
  const dataPlatform =
    "userAgentData" in navigator &&
    navigator.userAgentData &&
    typeof navigator.userAgentData === "object" &&
    "platform" in navigator.userAgentData
      ? String((navigator.userAgentData as { platform?: string }).platform ?? "").toLowerCase()
      : "";

  const haystack = `${platform} ${ua} ${dataPlatform}`;
  if (haystack.includes("win")) return "windows";
  if (haystack.includes("linux") || haystack.includes("android")) return "linux";
  if (haystack.includes("mac")) return "macos";
  return "other";
}

export function isWindowsHost(): boolean {
  return detectHostOsFamily() === "windows";
}

export function isLinuxHost(): boolean {
  return detectHostOsFamily() === "linux";
}

export function defaultWindowMode(): WindowMode {
  return "window";
}

export function withPlatformDesktopMode<T extends { desktopMode: boolean }>(settings: T): T {
  return isWindowsHost() ? settings : { ...settings, desktopMode: false, desktopModeOptIn: undefined };
}

export function withDesktopMode<T extends { desktopMode: boolean }>(settings: T, enabled: boolean): T {
  return withPlatformDesktopMode({ ...settings, desktopMode: enabled, desktopModeOptIn: enabled ? true : undefined });
}
