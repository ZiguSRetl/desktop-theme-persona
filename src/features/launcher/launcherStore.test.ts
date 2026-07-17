import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeLauncherItem } from "../../test/factories";

const { mergeAndSaveState } = vi.hoisted(() => ({
  mergeAndSaveState: vi.fn(async () => undefined),
}));

vi.mock("./persistence", async () => {
  const actual = await vi.importActual<typeof import("./persistence")>("./persistence");
  return {
    ...actual,
    mergeAndSaveState,
  };
});

import { useLauncherStore } from "./launcherStore";

describe("useLauncherStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLauncherStore.setState({
      items: [
        makeLauncherItem({
          id: "a",
          name: "Alpha",
          category: "apps",
          order: 0,
          favorite: false,
          favoriteOrder: 0,
        }),
        makeLauncherItem({
          id: "b",
          name: "Beta",
          category: "apps",
          order: 1,
          favorite: false,
          favoriteOrder: 0,
        }),
        makeLauncherItem({
          id: "g",
          name: "Gamma",
          category: "games",
          order: 0,
          favorite: true,
          favoriteOrder: 0,
        }),
      ],
      status: "ready",
      error: null,
    });
  });

  it("adds an item with next category order and persists first", async () => {
    await useLauncherStore.getState().addItem({
      name: "  New App  ",
      type: "application",
      target: "  new.exe  ",
      category: "apps",
    });

    const items = useLauncherStore.getState().items;
    const created = items.find((item) => item.target === "new.exe");
    expect(created).toMatchObject({
      name: "New App",
      category: "apps",
      order: 2,
      favorite: false,
    });
    expect(created?.accent).toBeTruthy();
    expect(mergeAndSaveState).toHaveBeenCalledWith({
      items: expect.arrayContaining([expect.objectContaining({ target: "new.exe" })]),
    });
  });

  it("toggles favorite and persists", async () => {
    await useLauncherStore.getState().toggleFavorite("a");
    const toggled = useLauncherStore.getState().items.find((i) => i.id === "a");
    expect(toggled?.favorite).toBe(true);
    expect(toggled?.favoriteOrder).toBe(1);
    expect(mergeAndSaveState).toHaveBeenCalledTimes(1);
  });

  it("removes an item and persists", async () => {
    await useLauncherStore.getState().removeItem("b");
    expect(useLauncherStore.getState().items.map((i) => i.id)).toEqual(["a", "g"]);
    expect(mergeAndSaveState).toHaveBeenCalledTimes(1);
  });

  it("reorders only the given category", async () => {
    await useLauncherStore.getState().reorderItems("apps", ["b", "a"]);
    const apps = useLauncherStore
      .getState()
      .items.filter((item) => item.category === "apps")
      .sort((left, right) => left.order - right.order);

    expect(apps.map((item) => item.id)).toEqual(["b", "a"]);
    expect(useLauncherStore.getState().items.find((i) => i.id === "g")?.order).toBe(0);
  });

  it("reorders favorites without changing category order", async () => {
    await useLauncherStore.getState().toggleFavorite("a");
    await useLauncherStore.getState().reorderFavorites(["a", "g"]);

    const favorites = useLauncherStore
      .getState()
      .items.filter((item) => item.favorite)
      .sort((left, right) => left.favoriteOrder - right.favoriteOrder);

    expect(favorites.map((item) => item.id)).toEqual(["a", "g"]);
    expect(favorites.map((item) => item.favoriteOrder)).toEqual([0, 1]);
    expect(useLauncherStore.getState().items.find((i) => i.id === "a")?.order).toBe(0);
    expect(useLauncherStore.getState().items.find((i) => i.id === "g")?.order).toBe(0);
  });
});
