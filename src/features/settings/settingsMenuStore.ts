import { create } from "zustand";

export const SETTINGS_CATEGORIES = [
  "general",
  "display",
  "shortcuts",
  "desktop",
  "system",
  "data",
] as const;

export type SettingsCategoryId = (typeof SETTINGS_CATEGORIES)[number];

interface SettingsMenuStore {
  activeCategory: SettingsCategoryId | null;
  /** 1 = enter category, -1 = back to root (drives slide animation). */
  menuDirection: 1 | -1;
  openCategory: (category: SettingsCategoryId) => void;
  goBackToRoot: () => void;
}

export const useSettingsMenuStore = create<SettingsMenuStore>((set) => ({
  activeCategory: null,
  menuDirection: 1,

  openCategory: (category) => set({ activeCategory: category, menuDirection: 1 }),

  goBackToRoot: () => set({ activeCategory: null, menuDirection: -1 }),
}));
