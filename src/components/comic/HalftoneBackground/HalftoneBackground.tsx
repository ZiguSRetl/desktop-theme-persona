import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useLayerParallax } from "../../../hooks/useParallax";
import { useEffectiveReducedMotion } from "../../../features/settings/useAnimationProfile";
import {
  isWallpaperConfigured,
  loadWallpaperDataUrl,
} from "../../../features/settings/wallpaperService";
import { wallpaperCropToBackgroundStyle } from "../../../features/settings/wallpaperUtils";
import { useSetting } from "../../../features/settings/settingsStore";
import { SpeedLines } from "../SpeedLines";
import styles from "./HalftoneBackground.module.css";

export type AppSection = "home" | "apps" | "games" | "system" | "scripts" | "settings";

interface HalftoneBackgroundProps {
  section: AppSection;
}

const sectionOffsets: Record<AppSection, { shape1: number; shape2: number }> = {
  home: { shape1: 0, shape2: 0 },
  apps: { shape1: 15, shape2: -10 },
  games: { shape1: -12, shape2: 18 },
  system: { shape1: 8, shape2: -15 },
  scripts: { shape1: 12, shape2: 8 },
  settings: { shape1: -8, shape2: 10 },
};

export function HalftoneBackground({ section }: HalftoneBackgroundProps) {
  const wallpaper = useSetting("wallpaper");
  const wallpaperPassthrough = useSetting("wallpaperPassthrough");
  const reduceMotion = useEffectiveReducedMotion();
  const [isVisible, setIsVisible] = useState(
    () => typeof document !== "undefined" && document.visibilityState === "visible",
  );
  const [wallpaperUrl, setWallpaperUrl] = useState("");
  const layer0 = useLayerParallax(0, 3, 8);
  const layer1 = useLayerParallax(1, 3, 10);
  const layer2 = useLayerParallax(2, 3, 12);
  const offsets = sectionOffsets[section];

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (wallpaperPassthrough || !isWallpaperConfigured(wallpaper)) {
      queueMicrotask(() => setWallpaperUrl(""));
      return;
    }

    const path = wallpaper.path;
    let cancelled = false;

    void loadWallpaperDataUrl(path)
      .then((url) => {
        if (!cancelled) setWallpaperUrl(url);
      })
      .catch(() => {
        if (!cancelled) setWallpaperUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [wallpaper, wallpaperPassthrough]);

  const wallpaperStyle = useMemo(() => {
    if (!wallpaperUrl || !isWallpaperConfigured(wallpaper)) return undefined;
    return wallpaperCropToBackgroundStyle(wallpaperUrl, wallpaper.crop);
  }, [wallpaper, wallpaperUrl]);

  const paused = reduceMotion || !isVisible;
  const hasWallpaper = Boolean(wallpaperStyle);

  if (wallpaperPassthrough) {
    return <div className={styles.background} aria-hidden="true" data-passthrough="true" />;
  }

  return (
    <div className={styles.background} aria-hidden="true" data-paused={paused}>
      {hasWallpaper ? (
        <div className={styles.wallpaper} style={wallpaperStyle} />
      ) : (
        <>
          <div className={`${styles.base} paper-texture`} />

          <motion.div
            className={`${styles.shape} ${styles.shapeOne}`}
            animate={
              paused
                ? {}
                : {
                    rotate: offsets.shape1,
                    x: layer0.x,
                    y: layer0.y,
                  }
            }
            transition={{ duration: 0.3, ease: "easeOut" }}
          />

          <motion.div
            className={`${styles.shape} ${styles.shapeTwo}`}
            animate={
              paused
                ? {}
                : {
                    rotate: -8 + offsets.shape2,
                    x: layer1.x,
                    y: layer1.y,
                  }
            }
            transition={{ duration: 0.3, ease: "easeOut" }}
          />

          <motion.div
            className={`${styles.fragment} ${styles.fragmentWhite}`}
            animate={paused ? {} : { x: layer2.x * 0.5, y: layer2.y * 0.5 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />

          <div className={`${styles.halftone} halftone-pattern-light`} />
          <div className={styles.halftoneDark} />

          <div className={styles.speedLinesWrap}>
            <SpeedLines visible direction="diagonal-left" intensity="low" />
          </div>
        </>
      )}
    </div>
  );
}

export function pathnameToSection(pathname: string): AppSection {
  if (pathname.startsWith("/apps")) return "apps";
  if (pathname.startsWith("/games")) return "games";
  if (pathname.startsWith("/system")) return "system";
  if (pathname.startsWith("/scripts")) return "scripts";
  if (pathname.startsWith("/settings")) return "settings";
  return "home";
}
