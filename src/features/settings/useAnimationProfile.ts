import { useReducedMotion } from "motion/react";
import { useSetting } from "./settingsStore";

export type AnimationProfile = "reduced" | "normal" | "high";

export function useAnimationProfile(): AnimationProfile {
  const systemReduced = useReducedMotion();
  const intensity = useSetting("animationIntensity");

  if (systemReduced || intensity === "reduced") return "reduced";
  if (intensity === "high") return "high";
  return "normal";
}

export function useEffectiveReducedMotion(): boolean {
  return useAnimationProfile() === "reduced";
}

export function useMotionScale(): number {
  const profile = useAnimationProfile();
  if (profile === "reduced") return 1;
  if (profile === "high") return 1.12;
  return 1;
}

export function useMotionDurationMultiplier(): number {
  const profile = useAnimationProfile();
  if (profile === "reduced") return 0.5;
  if (profile === "high") return 1.2;
  return 1;
}
