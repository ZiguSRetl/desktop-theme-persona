import type { LauncherItem } from "../../types/desktop";

export const seedLauncherItems: LauncherItem[] = [
  {
    id: "app-notepad",
    name: "Bloc de notas",
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
    name: "Calculadora",
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
    name: "Explorador",
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
    name: "Visual Studio Code",
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
    name: "Documentos",
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
    name: "Steam",
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
    name: "Epic Games",
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
    name: "Carpeta de juegos",
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
    name: "Configuración",
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
    name: "Administrador de tareas",
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
    name: "GitHub",
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
    name: "Descargas",
    type: "folder",
    target: "C:\\Users\\Public\\Downloads",
    category: "system",
    favorite: false,
    order: 3,
    favoriteOrder: 0,
    accent: "#a60012",
  },
];

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
