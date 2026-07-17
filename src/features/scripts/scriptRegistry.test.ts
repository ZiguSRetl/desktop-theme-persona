import { describe, expect, it } from "vitest";
import { getScriptById, SCRIPTS } from "./scriptRegistry";

describe("scriptRegistry", () => {
  it("includes the clean script", () => {
    expect(SCRIPTS.some((script) => script.id === "clean")).toBe(true);
    expect(getScriptById("clean")?.name).toBe("Clean");
  });

  it("defines planned steps with stable ids", () => {
    const clean = getScriptById("clean");
    expect(clean?.plannedSteps.map((step) => step.id)).toEqual([
      "power-plan",
      "close-apps",
      "purge-standby",
      "clear-cache",
      "gpu-reset",
    ]);
  });
});
