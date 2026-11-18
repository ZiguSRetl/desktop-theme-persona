import { useEffect, useState } from "react";
import {
  isWallpaperConfigured,
  loadWallpaperDataUrl,
} from "../../../features/settings/wallpaperService";
import { wallpaperCropToBackgroundStyle } from "../../../features/settings/wallpaperUtils";
import { useSetting } from "../../../features/settings/settingsStore";
import styles from "./HalftoneBackground.module.css";

export type AppSection = "home" | "apps" | "games" | "system" | "scripts" | "settings";

export function HalftoneBackground() {
  const wallpaper = useSetting("wallpaper");
  const desktopMode = useSetting("desktopMode");
  const wallpaperPassthrough = useSetting("wallpaperPassthrough") && desktopMode;
  const path = isWallpaperConfigured(wallpaper) ? wallpaper.path : null;
  const [loaded, setLoaded] = useState<{ path: string; url: string }>();

  useEffect(() => {
    if (wallpaperPassthrough || !path) return;
    let cancelled = false;

    void loadWallpaperDataUrl(path)
      .then((url) => {
        if (!cancelled) setLoaded({ path, url });
      })
      .catch(() => {
        if (!cancelled) setLoaded(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [path, wallpaper, wallpaperPassthrough]);

  if (wallpaperPassthrough) {
    return <div className={styles.background} aria-hidden="true" data-passthrough="true" />;
  }

  const wallpaperStyle = loaded?.path === path && loaded.url && isWallpaperConfigured(wallpaper)
    ? wallpaperCropToBackgroundStyle(loaded.url, wallpaper.crop)
    : undefined;

  return (
    <div className={styles.background} aria-hidden="true">
      {wallpaperStyle ? (
        <div className={styles.wallpaper} style={wallpaperStyle} />
      ) : (
        <div className={styles.composition}>
          <div className={styles.scarlet} />
          <div className={styles.paper} />
          <div className={styles.hatching} />
        </div>
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
