import { tt } from "../../i18n";
import type { LauncherItem, LauncherItemType } from "../../types/desktop";

function typeLabel(type: LauncherItemType): string {
  switch (type) {
    case "application":
      return tt("launcher.types.application");
    case "game":
      return tt("launcher.types.game");
    case "folder":
      return tt("launcher.types.folder");
    case "url":
      return tt("launcher.types.url");
  }
}

function categoryLabel(category: LauncherItem["category"]): string {
  switch (category) {
    case "apps":
      return tt("launcher.categoryFlavor.apps");
    case "games":
      return tt("launcher.categoryFlavor.games");
    case "system":
      return tt("launcher.categoryFlavor.system");
  }
}

export function itemDescription(item: LauncherItem): string {
  const type = typeLabel(item.type);
  const category = categoryLabel(item.category);

  if (item.type === "url") {
    return tt("launcher.description.url", { target: item.target, category });
  }

  if (item.type === "folder") {
    return tt("launcher.description.folder", { target: item.target });
  }

  if (item.type === "game") {
    return tt("launcher.description.game", { name: item.name, type, category });
  }

  return tt("launcher.description.app", { name: item.name, type, category });
}

export function canRevealLocation(item: LauncherItem): boolean {
  return item.type !== "url" && item.target.trim().length > 0;
}
