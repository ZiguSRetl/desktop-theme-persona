import { describe, expect, it } from "vitest";
import {
  centeredWindowOnMonitor,
  isPrimaryWindowLabel,
  resolveRestorePosition,
  satelliteLabel,
} from "./windowPlacement";

describe("windowPlacement", () => {
  it("keeps absolute restore coordinates (no monitor offset)", () => {
    expect(resolveRestorePosition({ x: 1920, y: 100, width: 800, height: 600 })).toEqual({
      x: 1920,
      y: 100,
    });
  });

  it("centers a window on a secondary monitor", () => {
    const bounds = centeredWindowOnMonitor(
      {
        position: { x: 1920, y: 0 },
        size: { width: 1920, height: 1080 },
      },
      1280,
      720,
    );

    expect(bounds).toEqual({
      x: 1920 + Math.floor((1920 - 1280) / 2),
      y: Math.floor((1080 - 720) / 2),
      width: 1280,
      height: 720,
    });
  });

  it("maps satellite labels and primary role", () => {
    expect(satelliteLabel(1)).toBe("monitor-1");
    expect(isPrimaryWindowLabel("main")).toBe(true);
    expect(isPrimaryWindowLabel("monitor-1")).toBe(false);
  });
});
