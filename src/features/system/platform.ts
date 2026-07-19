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

/** Desktop overlay shell is Windows-only; other hosts run as a normal window. */
export function forcesDesktopMode(): boolean {
  return isWindowsHost();
}

/** Windows shell defaults to maximized; Linux/macOS use a floating window (avoids GNOME dock clash). */
export function defaultWindowMode(): WindowMode {
  return forcesDesktopMode() ? "maximized" : "window";
}

export function withPlatformDesktopMode<T extends { desktopMode: boolean }>(settings: T): T {
  if (forcesDesktopMode()) {
    return { ...settings, desktopMode: true };
  }
  return { ...settings, desktopMode: false };
}

/**
 * Apply platform shell rules: desktopMode force, and on non-Windows remap
 * frameless-maximized → window (work-area maximize leaves a gap above the dock).
 * Fullscreen remains available for immersive use.
 */
export function withPlatformShellSettings<
  T extends { desktopMode: boolean; windowMode: WindowMode },
>(settings: T): T {
  const next = withPlatformDesktopMode(settings);
  if (!forcesDesktopMode() && next.windowMode === "maximized") {
    return { ...next, windowMode: "window" };
  }
  return next;
}
