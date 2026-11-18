import { describe, expect, it } from "vitest";
import { makeLauncherItem } from "../../test/factories";
import {
  catalogAppCategory,
  filterInstalledApps,
  findLauncherItemByTarget,
} from "./installedAppsSelectors";
import type { InstalledAppResult } from "./appSearchService";

const apps: InstalledAppResult[] = [
  { name: "Chrome", path: "C:\\Programs\\Chrome.lnk", source: "Menú Inicio" },
  { name: "Firefox", path: "C:\\Desktop\\Firefox.lnk", source: "Escritorio" },
  { name: "Notion", path: "C:\\Programs\\Notion.lnk", source: "Menú Inicio" },
];

describe("filterInstalledApps", () => {
  it("returns all apps when query is empty", () => {
    expect(filterInstalledApps(apps, "  ")).toEqual(apps);
  });

  it("filters by name substring", () => {
    expect(filterInstalledApps(apps, "fire")).toEqual([apps[1]]);
  });

  it("requires all tokens to match", () => {
    expect(filterInstalledApps(apps, "chrome inicio")).toEqual([apps[0]]);
    expect(filterInstalledApps(apps, "chrome escritorio")).toEqual([]);
  });

  it("matches path and source", () => {
    expect(filterInstalledApps(apps, "desktop")).toEqual([apps[1]]);
    expect(filterInstalledApps(apps, "menú")).toEqual([apps[0], apps[2]]);
  });
});

describe("findLauncherItemByTarget", () => {
  it("matches targets ignoring slash direction and case", () => {
    const items = [
      makeLauncherItem({
        id: "bf",
        target: "steam://rungameid/2807960",
        favorite: true,
      }),
    ];
    expect(
      findLauncherItemByTarget(items, "steam:\\\\rungameid\\2807960")?.id,
    ).toBe("bf");
  });
});

describe("catalogAppCategory", () => {
  it("maps store protocols to games", () => {
    expect(
      catalogAppCategory({
        name: "BF",
        path: "steam:\\\\rungameid\\2807960",
        source: "Menú Inicio",
      }),
    ).toBe("games");
    expect(
      catalogAppCategory({
        name: "Chrome",
        path: "C:\\Chrome.lnk",
        source: "Menú Inicio",
      }),
    ).toBe("apps");
  });
});
