import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useAnimationProfile,
  useMotionDurationMultiplier,
  useMotionScale,
} from "./useAnimationProfile";
import { useSettingsStore } from "./settingsStore";
import { DEFAULT_SETTINGS } from "../launcher/persistence";

const useReducedMotionMock = vi.fn(() => false);

vi.mock("motion/react", () => ({
  useReducedMotion: () => useReducedMotionMock(),
}));

describe("useAnimationProfile", () => {
  beforeEach(() => {
    useReducedMotionMock.mockReturnValue(false);
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS },
      status: "ready",
    });
  });

  it("returns reduced profile from settings", () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, animationIntensity: "reduced" },
      status: "ready",
    });

    const { result } = renderHook(() => useAnimationProfile());
    expect(result.current).toBe("reduced");
  });

  it("returns normal profile for normal intensity", () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, animationIntensity: "normal" },
      status: "ready",
    });

    const { result } = renderHook(() => useAnimationProfile());
    expect(result.current).toBe("normal");
  });

  it("forces reduced when OS prefers reduced motion", () => {
    useReducedMotionMock.mockReturnValue(true);
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, animationIntensity: "high" },
      status: "ready",
    });

    const { result } = renderHook(() => useAnimationProfile());
    expect(result.current).toBe("reduced");
  });

  it("scales motion for high intensity", () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, animationIntensity: "high" },
      status: "ready",
    });

    const { result } = renderHook(() => useMotionScale());
    expect(result.current).toBe(1.12);
  });

  it("shortens duration when reduced", () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, animationIntensity: "reduced" },
      status: "ready",
    });

    const { result } = renderHook(() => useMotionDurationMultiplier());
    expect(result.current).toBe(0.5);
  });
});
