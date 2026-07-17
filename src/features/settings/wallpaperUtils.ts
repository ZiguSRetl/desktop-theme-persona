import type { CSSProperties } from "react";
import type { WallpaperCrop } from "../../types/desktop";

export function getScreenAspectRatio(): number {
  if (typeof window === "undefined") return 16 / 9;
  const { innerWidth, innerHeight } = window;
  if (innerWidth <= 0 || innerHeight <= 0) return 16 / 9;
  return innerWidth / innerHeight;
}

export function defaultWallpaperCrop(
  imageWidth: number,
  imageHeight: number,
  aspectRatio = getScreenAspectRatio(),
): WallpaperCrop {
  if (imageWidth <= 0 || imageHeight <= 0 || aspectRatio <= 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  const imageAspect = imageWidth / imageHeight;

  if (imageAspect > aspectRatio) {
    const height = 1;
    const width = aspectRatio / imageAspect;
    return { x: (1 - width) / 2, y: 0, width, height };
  }

  const width = 1;
  const height = imageAspect / aspectRatio;
  return { x: 0, y: (1 - height) / 2, width, height };
}

export function clampWallpaperCrop(crop: WallpaperCrop): WallpaperCrop {
  const width = Math.min(Math.max(crop.width, 0.01), 1);
  const height = Math.min(Math.max(crop.height, 0.01), 1);
  const x = Math.min(Math.max(crop.x, 0), 1 - width);
  const y = Math.min(Math.max(crop.y, 0), 1 - height);
  return { x, y, width, height };
}

export function wallpaperCropToBackgroundStyle(
  imageUrl: string,
  crop: WallpaperCrop,
): CSSProperties {
  return {
    backgroundImage: `url("${imageUrl}")`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${100 / crop.width}% ${100 / crop.height}%`,
    backgroundPosition: `${(-crop.x / crop.width) * 100}% ${(-crop.y / crop.height) * 100}%`,
  };
}

export function fitImageInBox(
  imageWidth: number,
  imageHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { width: maxWidth, height: maxHeight };
  }

  const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight, 1);
  return {
    width: Math.round(imageWidth * scale),
    height: Math.round(imageHeight * scale),
  };
}
