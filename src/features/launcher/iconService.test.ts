import { describe, expect, it } from "vitest";
import { makeLauncherItem } from "../../test/factories";
import {
  displayIconUrl,
  ICON_QUALITY,
  isCurrentQualityIcon,
  isLegacyIcon,
  itemNeedsIcon,
  toIconDataUrl,
} from "./iconService";

describe("iconService", () => {
  it("marks raw base64 with the current quality prefix", () => {
    expect(toIconDataUrl("abc123")).toBe(`data:image/png;p5q=${ICON_QUALITY};base64,abc123`);
  });

  it("upgrades plain png data urls to the current quality prefix", () => {
    expect(toIconDataUrl("data:image/png;base64,abc")).toBe(
      `data:image/png;p5q=${ICON_QUALITY};base64,abc`,
    );
  });

  it("re-marks older quality prefixes with the current quality", () => {
    expect(toIconDataUrl("data:image/png;p5q=2;base64,abc")).toBe(
      `data:image/png;p5q=${ICON_QUALITY};base64,abc`,
    );
  });

  it("strips the quality prefix for display", () => {
    expect(displayIconUrl(`data:image/png;p5q=${ICON_QUALITY};base64,abc`)).toBe(
      "data:image/png;base64,abc",
    );
  });

  it("detects current-quality vs legacy icons", () => {
    const current = `data:image/png;p5q=${ICON_QUALITY};base64,abc`;
    const legacy = "data:image/png;base64,abc";

    expect(isCurrentQualityIcon(current)).toBe(true);
    expect(isCurrentQualityIcon(legacy)).toBe(false);
    expect(isLegacyIcon(legacy)).toBe(true);
    expect(isLegacyIcon(current)).toBe(false);
  });

  it("requests backfill for missing or legacy icons", () => {
    expect(itemNeedsIcon(makeLauncherItem({ icon: undefined }))).toBe(true);
    expect(
      itemNeedsIcon(makeLauncherItem({ icon: "data:image/png;base64,old" })),
    ).toBe(true);
    expect(
      itemNeedsIcon(makeLauncherItem({ icon: "data:image/png;p5q=2;base64,old" })),
    ).toBe(true);
    expect(
      itemNeedsIcon(
        makeLauncherItem({ icon: `data:image/png;p5q=${ICON_QUALITY};base64,ok` }),
      ),
    ).toBe(false);
  });

  it("does not request icons for url items", () => {
    expect(
      itemNeedsIcon(makeLauncherItem({ type: "url", target: "https://example.com" })),
    ).toBe(false);
  });
});
