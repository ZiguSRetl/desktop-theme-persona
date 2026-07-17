import { useSettingsStore } from "../settings/settingsStore";
import { playSynthSound, type UiSoundType } from "./synthSounds";

let audioContext: AudioContext | null = null;
const lastPlayed = new Map<UiSoundType, number>();
const THROTTLE_MS: Partial<Record<UiSoundType, number>> = {
  hover: 120,
  page: 180,
  launch: 160,
};

function canPlaySounds(): boolean {
  if (typeof window === "undefined") return false;
  if (document.visibilityState !== "visible") return false;
  // Only the focused webview plays UI audio (avoids N× sounds across monitors).
  if (!document.hasFocus()) return false;
  return useSettingsStore.getState().settings.soundEnabled;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!audioContext) {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
  }

  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  return audioContext;
}

export function playUiSound(type: UiSoundType): void {
  if (!canPlaySounds()) return;

  const throttle = THROTTLE_MS[type];
  if (throttle) {
    const now = Date.now();
    const last = lastPlayed.get(type) ?? 0;
    if (now - last < throttle) return;
    lastPlayed.set(type, now);
  }

  const context = getAudioContext();
  if (!context) return;

  try {
    playSynthSound(context, type);
  } catch {
    // Ignore audio failures silently.
  }
}

export function primeAudioContext(): void {
  if (!canPlaySounds()) return;
  getAudioContext();
}
