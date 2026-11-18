import { afterEach, describe, expect, it } from "vitest";
import {
  defaultWindowMode,
  detectHostOsFamily,
  isLinuxHost,
  isWindowsHost,
  setOsFamilyOverrideForTests,
  withPlatformDesktopMode,
} from "./platform";

describe("platform", () => {
  afterEach(() => {
    setOsFamilyOverrideForTests(null);
  });

  it("keeps the user's desktop mode choice on Windows", () => {
    setOsFamilyOverrideForTests("windows");
    expect(isWindowsHost()).toBe(true);
    expect(withPlatformDesktopMode({ desktopMode: false }).desktopMode).toBe(false);
    expect(withPlatformDesktopMode({ desktopMode: true }).desktopMode).toBe(true);
  });

  it.each(["windows", "linux", "macos"] as const)("defaults to a floating window on %s", (platform) => {
    setOsFamilyOverrideForTests(platform);
    expect(defaultWindowMode()).toBe("window");
  });

  it.each(["linux", "macos"] as const)("keeps native maximize and disables desktop mode on %s", (platform) => {
    setOsFamilyOverrideForTests(platform);
    expect(isLinuxHost()).toBe(platform === "linux");
    expect(withPlatformDesktopMode({ desktopMode: true, windowMode: "maximized" }))
      .toMatchObject({ desktopMode: false, windowMode: "maximized" });
  });

  it("detects override before navigator", () => {
    setOsFamilyOverrideForTests("macos");
    expect(detectHostOsFamily()).toBe("macos");
  });
});
