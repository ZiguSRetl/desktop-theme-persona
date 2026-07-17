import { useEffect, useState } from "react";
import { useEffectiveReducedMotion } from "../features/settings/useAnimationProfile";

interface ParallaxOffset {
  x: number;
  y: number;
}

export function useParallax(maxOffset = 12): ParallaxOffset {
  const reduceMotion = useEffectiveReducedMotion();
  const [offset, setOffset] = useState<ParallaxOffset>({ x: 0, y: 0 });

  useEffect(() => {
    if (reduceMotion) return;

    let frameId = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      if (document.hidden) return;
      const nx = (event.clientX / window.innerWidth - 0.5) * 2;
      const ny = (event.clientY / window.innerHeight - 0.5) * 2;
      targetX = nx * maxOffset;
      targetY = ny * maxOffset;

      if (!frameId) {
        frameId = requestAnimationFrame(() => {
          setOffset({ x: targetX, y: targetY });
          frameId = 0;
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [maxOffset, reduceMotion]);

  return offset;
}

export function useLayerParallax(
  layerIndex: number,
  totalLayers: number,
  maxOffset = 12,
): ParallaxOffset {
  const base = useParallax(maxOffset);
  const factor = (layerIndex + 1) / totalLayers;

  return {
    x: base.x * factor,
    y: base.y * factor,
  };
}
