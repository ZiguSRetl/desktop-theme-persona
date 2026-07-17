export type UiSoundType = "hover" | "confirm" | "page" | "launch" | "error";

interface SoundPreset {
  frequency: number;
  duration: number;
  type: OscillatorType;
  gain: number;
  slideTo?: number;
}

const PRESETS: Record<UiSoundType, SoundPreset> = {
  hover: { frequency: 880, duration: 0.04, type: "sine", gain: 0.03 },
  confirm: { frequency: 660, duration: 0.12, type: "triangle", gain: 0.05, slideTo: 990 },
  page: { frequency: 220, duration: 0.1, type: "sawtooth", gain: 0.04, slideTo: 440 },
  launch: { frequency: 180, duration: 0.16, type: "square", gain: 0.05, slideTo: 90 },
  error: { frequency: 140, duration: 0.18, type: "square", gain: 0.05, slideTo: 90 },
};

export function playSynthSound(context: AudioContext, type: UiSoundType): void {
  const preset = PRESETS[type];
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = preset.type;
  oscillator.frequency.setValueAtTime(preset.frequency, context.currentTime);

  if (preset.slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(preset.slideTo, 1),
      context.currentTime + preset.duration,
    );
  }

  gainNode.gain.setValueAtTime(preset.gain, context.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + preset.duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + preset.duration + 0.02);
}
