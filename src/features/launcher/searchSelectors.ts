import type { LauncherItem } from "../../types/desktop";

export function filterLauncherItems(
  items: LauncherItem[],
  query: string,
): LauncherItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;

  return items.filter((item) => {
    const haystack = `${item.name} ${item.category} ${item.type} ${item.target}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

export function sortSearchResults(items: LauncherItem[]): LauncherItem[] {
  return [...items].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.order - b.order;
  });
}

export function searchLauncherItems(items: LauncherItem[], query: string): LauncherItem[] {
  return sortSearchResults(filterLauncherItems(items, query));
}
