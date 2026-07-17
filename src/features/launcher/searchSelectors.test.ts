import { describe, expect, it } from "vitest";
import { makeLauncherItem } from "../../test/factories";
import {
  filterLauncherItems,
  searchLauncherItems,
  sortSearchResults,
} from "./searchSelectors";

const sampleItems = [
  makeLauncherItem({
    id: "1",
    name: "Steam",
    type: "game",
    target: "steam.exe",
    category: "games",
    favorite: true,
    order: 2,
  }),
  makeLauncherItem({
    id: "2",
    name: "Bloc de notas",
    type: "application",
    target: "notepad.exe",
    category: "apps",
    favorite: false,
    order: 0,
  }),
  makeLauncherItem({
    id: "3",
    name: "Calculadora",
    type: "application",
    target: "calc.exe",
    category: "apps",
    favorite: true,
    order: 1,
  }),
];

describe("filterLauncherItems", () => {
  it("returns all items for empty query", () => {
    expect(filterLauncherItems(sampleItems, "  ")).toHaveLength(3);
  });

  it("matches name, category, type, and target", () => {
    expect(filterLauncherItems(sampleItems, "steam").map((i) => i.id)).toEqual(["1"]);
    expect(filterLauncherItems(sampleItems, "games").map((i) => i.id)).toEqual(["1"]);
    expect(filterLauncherItems(sampleItems, "application").map((i) => i.id)).toEqual([
      "2",
      "3",
    ]);
    expect(filterLauncherItems(sampleItems, "notepad").map((i) => i.id)).toEqual(["2"]);
  });
});

describe("sortSearchResults", () => {
  it("orders favorites first, then category, then order", () => {
    const sorted = sortSearchResults(sampleItems);
    expect(sorted.map((i) => i.id)).toEqual(["3", "1", "2"]);
  });
});

describe("searchLauncherItems", () => {
  it("filters then sorts", () => {
    const results = searchLauncherItems(sampleItems, "app");
    expect(results.map((i) => i.id)).toEqual(["3", "2"]);
  });
});
