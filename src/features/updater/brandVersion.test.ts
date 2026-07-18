import { describe, expect, it } from "vitest";
import { getBrandVersionParts } from "./brandVersion";

describe("getBrandVersionParts", () => {
  it("returns null when current version is unknown", () => {
    expect(getBrandVersionParts(null, "0.1.5")).toBeNull();
  });

  it("returns current only when no update", () => {
    expect(getBrandVersionParts("0.1.5", null)).toEqual({
      current: "0.1.5",
      next: null,
    });
    expect(getBrandVersionParts("0.1.5", undefined)).toEqual({
      current: "0.1.5",
      next: null,
    });
  });

  it("ignores available when it matches current", () => {
    expect(getBrandVersionParts("0.1.5", "0.1.5")).toEqual({
      current: "0.1.5",
      next: null,
    });
  });

  it("returns next when an update is available", () => {
    expect(getBrandVersionParts("0.1.3", "0.1.5")).toEqual({
      current: "0.1.3",
      next: "0.1.5",
    });
  });
});
