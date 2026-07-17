import { detectSystemLanguage } from "../../i18n/detectLanguage";
import { t } from "../../i18n/translate";
import type { AppLanguage } from "../../i18n/types";
import type { LauncherItem } from "../../types/desktop";

const SEED_IDS = [
  "app-notepad",
  "app-calc",
  "app-explorer",
  "app-vscode",
  "app-docs",
  "game-steam",
  "game-epic",
  "game-folder",
  "sys-settings",
  "sys-taskmgr",
  "sys-github",
  "sys-downloads",
] as const;

type SeedId = (typeof SEED_IDS)[number];

function seedName(language: AppLanguage, id: SeedId): string {
  return t(language, `seed.${id}`);
}

export function createSeedLauncherItems(
  language: AppLanguage = detectSystemLanguage(),
): LauncherItem[] {
  return [
    {
      id: "app-notepad",
      name: seedName(language, "app-notepad"),
      type: "application",
      target: "C:\\Windows\\System32\\notepad.exe",
      category: "apps",
      favorite: true,
      order: 0,
      favoriteOrder: 0,
      accent: "#e60012",
    },
    {
      id: "app-calc",
      name: seedName(language, "app-calc"),
      type: "application",
      target: "C:\\Windows\\System32\\calc.exe",
      category: "apps",
      favorite: true,
      order: 1,
      favoriteOrder: 1,
      accent: "#ff4d4d",
    },
    {
      id: "app-explorer",
      name: seedName(language, "app-explorer"),
      type: "application",
      target: "C:\\Windows\\explorer.exe",
      category: "apps",
      favorite: false,
      order: 2,
      favoriteOrder: 0,
      accent: "#c40010",
    },
    {
      id: "app-vscode",
      name: seedName(language, "app-vscode"),
      type: "application",
      target: "C:\\Users\\Public\\Desktop\\Visual Studio Code.lnk",
      category: "apps",
      favorite: true,
      order: 3,
      favoriteOrder: 2,
      accent: "#8f0010",
    },
    {
      id: "app-docs",
      name: seedName(language, "app-docs"),
      type: "folder",
      target: "C:\\Users\\Public\\Documents",
      category: "apps",
      favorite: false,
      order: 4,
      favoriteOrder: 0,
      accent: "#a60012",
    },
    {
      id: "game-steam",
      name: seedName(language, "game-steam"),
      type: "application",
      target: "C:\\Program Files (x86)\\Steam\\steam.exe",
      category: "games",
      favorite: true,
      order: 0,
      favoriteOrder: 3,
      accent: "#e60012",
    },
    {
      id: "game-epic",
      name: seedName(language, "game-epic"),
      type: "application",
      target: "C:\\Program Files (x86)\\Epic Games\\Launcher\\EpicGamesLauncher.exe",
      category: "games",
      favorite: false,
      order: 1,
      favoriteOrder: 0,
      accent: "#ff3355",
    },
    {
      id: "game-folder",
      name: seedName(language, "game-folder"),
      type: "folder",
      target: "C:\\Games",
      category: "games",
      favorite: false,
      order: 2,
      favoriteOrder: 0,
      accent: "#8f0010",
    },
    {
      id: "sys-settings",
      name: seedName(language, "sys-settings"),
      type: "application",
      target: "ms-settings:",
      category: "system",
      favorite: true,
      order: 0,
      favoriteOrder: 4,
      accent: "#e60012",
    },
    {
      id: "sys-taskmgr",
      name: seedName(language, "sys-taskmgr"),
      type: "application",
      target: "C:\\Windows\\System32\\Taskmgr.exe",
      category: "system",
      favorite: false,
      order: 1,
      favoriteOrder: 0,
      accent: "#c40010",
    },
    {
      id: "sys-github",
      name: seedName(language, "sys-github"),
      type: "url",
      target: "https://github.com",
      category: "system",
      favorite: false,
      order: 2,
      favoriteOrder: 0,
      accent: "#ff4d4d",
    },
    {
      id: "sys-downloads",
      name: seedName(language, "sys-downloads"),
      type: "folder",
      target: "C:\\Users\\Public\\Downloads",
      category: "system",
      favorite: false,
      order: 3,
      favoriteOrder: 0,
      accent: "#a60012",
    },
  ];
}

/** @deprecated Prefer createSeedLauncherItems(language) */
export const seedLauncherItems: LauncherItem[] = createSeedLauncherItems();

/** @deprecated Use launcherStore instead */
export const defaultLauncherItems = seedLauncherItems;

/** @deprecated Use launcherStore instead */
export function getItemsByCategory(category: LauncherItem["category"]): LauncherItem[] {
  return seedLauncherItems
    .filter((item) => item.category === category)
    .sort((a, b) => a.order - b.order);
}

/** @deprecated Use launcherStore instead */
export function getFavoriteItems(): LauncherItem[] {
  return seedLauncherItems
    .filter((item) => item.favorite)
    .sort((a, b) => a.favoriteOrder - b.favoriteOrder);
}
