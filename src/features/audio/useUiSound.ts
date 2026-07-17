import { useCallback } from "react";
import { playUiSound, primeAudioContext } from "./soundService";
import type { UiSoundType } from "./synthSounds";

export function useUiSound() {
  const play = useCallback((type: UiSoundType) => {
    playUiSound(type);
  }, []);

  const prime = useCallback(() => {
    primeAudioContext();
  }, []);

  return { play, prime };
}

export { playUiSound, primeAudioContext };
