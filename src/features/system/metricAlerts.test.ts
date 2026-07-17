import { describe, expect, it } from "vitest";
import { capacityTone, createCpuAlertTracker, temperatureTone, worstTone } from "./metricAlerts";

describe("metricAlerts", () => {
  it("maps capacity thresholds", () => {
    expect(capacityTone(50)).toBe("normal");
    expect(capacityTone(80)).toBe("warn");
    expect(capacityTone(95)).toBe("critical");
  });

  it("maps temperature thresholds", () => {
    expect(temperatureTone(60)).toBe("normal");
    expect(temperatureTone(80)).toBe("warn");
    expect(temperatureTone(90)).toBe("critical");
  });

  it("picks the worst tone", () => {
    expect(worstTone("normal", "warn")).toBe("warn");
    expect(worstTone("warn", "critical", "normal")).toBe("critical");
  });

  it("marks CPU high only after consecutive samples", () => {
    const tracker = createCpuAlertTracker(3);
    expect(tracker.next(95)).toBe("normal");
    expect(tracker.next(92)).toBe("normal");
    expect(tracker.next(91)).toBe("critical");
    expect(tracker.next(50)).toBe("normal");
    expect(tracker.next(99)).toBe("normal");
  });
});
