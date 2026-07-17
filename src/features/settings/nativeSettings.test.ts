import { describe, expect, it } from "vitest";
import { isValidGlobalShortcut } from "./nativeSettings";

describe("isValidGlobalShortcut", () => {
  it("accepts valid shortcuts", () => {
    expect(isValidGlobalShortcut("Ctrl+Space")).toBe(true);
    expect(isValidGlobalShortcut("Alt+Shift+F")).toBe(true);
  });

  it("rejects invalid shortcuts", () => {
    expect(isValidGlobalShortcut("")).toBe(false);
    expect(isValidGlobalShortcut("Space")).toBe(false);
    expect(isValidGlobalShortcut("Ctrl+")).toBe(false);
  });
});
