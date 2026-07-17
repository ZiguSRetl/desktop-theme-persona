import { describe, expect, it } from "vitest";
import {
  clampWallpaperCrop,
  defaultWallpaperCrop,
  fitImageInBox,
  wallpaperCropToBackgroundStyle,
} from "./wallpaperUtils";

describe("defaultWallpaperCrop", () => {
  it("returns full frame when image aspect matches target", () => {
    const crop = defaultWallpaperCrop(1920, 1080, 16 / 9);
    expect(crop).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it("centers a horizontal crop for wider-than-target images", () => {
    const crop = defaultWallpaperCrop(3200, 1080, 16 / 9);
    expect(crop.height).toBe(1);
    expect(crop.y).toBe(0);
    expect(crop.width).toBeLessThan(1);
    expect(crop.x).toBeCloseTo((1 - crop.width) / 2);
  });

  it("centers a vertical crop for taller-than-target images", () => {
    const crop = defaultWallpaperCrop(1080, 1920, 16 / 9);
    expect(crop.width).toBe(1);
    expect(crop.x).toBe(0);
    expect(crop.height).toBeLessThan(1);
    expect(crop.y).toBeCloseTo((1 - crop.height) / 2);
  });
});

describe("clampWallpaperCrop", () => {
  it("clamps crop inside image bounds", () => {
    const crop = clampWallpaperCrop({ x: 0.9, y: 0.9, width: 0.5, height: 0.5 });
    expect(crop.x).toBe(0.5);
    expect(crop.y).toBe(0.5);
    expect(crop.width).toBe(0.5);
    expect(crop.height).toBe(0.5);
  });
});

describe("wallpaperCropToBackgroundStyle", () => {
  it("maps crop to CSS background properties", () => {
    const style = wallpaperCropToBackgroundStyle("file://wallpaper.jpg", {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });

    expect(style.backgroundImage).toContain("file://wallpaper.jpg");
    expect(style.backgroundSize).toBe("100% 100%");
    expect(style.backgroundPosition).toBe("0% 0%");
  });
});

describe("fitImageInBox", () => {
  it("scales down while preserving aspect ratio", () => {
    expect(fitImageInBox(2000, 1000, 400, 400)).toEqual({ width: 400, height: 200 });
  });
});
