import { afterEach, describe, expect, it } from "vitest";
import {
  defaultWindowMode,
  detectHostOsFamily,
  forcesDesktopMode,
  isLinuxHost,
  isWindowsHost,
  setOsFamilyOverrideForTests,
  withPlatformDesktopMode,
  withPlatformShellSettings,
} from "./platform";

describe("platform", () => {
  afterEach(() => {
    setOsFamilyOverrideForTests(null);
  });

  it("forces desktop mode only on Windows", () => {
    setOsFamilyOverrideForTests("windows");
    expect(isWindowsHost()).toBe(true);
    expect(forcesDesktopMode()).toBe(true);
    expect(withPlatformDesktopMode({ desktopMode: false }).desktopMode).toBe(true);

    setOsFamilyOverrideForTests("linux");
    expect(isLinuxHost()).toBe(true);
    expect(forcesDesktopMode()).toBe(false);
    expect(withPlatformDesktopMode({ desktopMode: true }).desktopMode).toBe(false);
  });

  it("defaults window mode to window on Linux and remaps maximized", () => {
    setOsFamilyOverrideForTests("linux");
    expect(defaultWindowMode()).toBe("window");
    expect(
      withPlatformShellSettings({ desktopMode: true, windowMode: "maximized" as const })
        .windowMode,
    ).toBe("window");
    expect(
      withPlatformShellSettings({ desktopMode: false, windowMode: "fullscreen" as const })
        .windowMode,
    ).toBe("fullscreen");
  });

  it("keeps maximized on Windows", () => {
    setOsFamilyOverrideForTests("windows");
    expect(defaultWindowMode()).toBe("maximized");
    expect(
      withPlatformShellSettings({ desktopMode: false, windowMode: "maximized" as const })
        .windowMode,
    ).toBe("maximized");
  });

  it("detects override before navigator", () => {
    setOsFamilyOverrideForTests("macos");
    expect(detectHostOsFamily()).toBe("macos");
  });
});
