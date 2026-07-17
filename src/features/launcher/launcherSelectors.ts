import { useMemo } from "react";
import type { LauncherItem } from "../../types/desktop";
import { useLauncherStore } from "./launcherStore";

function sortByOrder(items: LauncherItem[]): LauncherItem[] {
  return [...items].sort((a, b) => a.order - b.order);
}

function sortByFavoriteOrder(items: LauncherItem[]): LauncherItem[] {
  return [...items].sort((a, b) => a.favoriteOrder - b.favoriteOrder);
}

export function useItemsByCategory(category: LauncherItem["category"]): LauncherItem[] {
  const items = useLauncherStore((state) => state.items);

  return useMemo(
    () => sortByOrder(items.filter((item) => item.category === category)),
    [items, category],
  );
}

export function useFavoriteItems(): LauncherItem[] {
  const items = useLauncherStore((state) => state.items);

  return useMemo(
    () => sortByFavoriteOrder(items.filter((item) => item.favorite)),
    [items],
  );
}
