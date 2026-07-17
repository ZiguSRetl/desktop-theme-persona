import { beforeEach, describe, expect, it } from "vitest";
import { useSettingsMenuStore } from "./settingsMenuStore";

describe("settingsMenuStore", () => {
  beforeEach(() => {
    useSettingsMenuStore.setState({ activeCategory: null, menuDirection: 1 });
  });

  it("opens a category and sets forward direction", () => {
    useSettingsMenuStore.getState().openCategory("display");

    expect(useSettingsMenuStore.getState().activeCategory).toBe("display");
    expect(useSettingsMenuStore.getState().menuDirection).toBe(1);
  });

  it("goes back to root and sets reverse direction", () => {
    useSettingsMenuStore.getState().openCategory("general");
    useSettingsMenuStore.getState().goBackToRoot();

    expect(useSettingsMenuStore.getState().activeCategory).toBeNull();
    expect(useSettingsMenuStore.getState().menuDirection).toBe(-1);
  });
});
