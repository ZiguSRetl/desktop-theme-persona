import { create } from "zustand";
import type { LauncherItem, LauncherItemType } from "../../types/desktop";
import { mergeAndSaveState } from "./persistence";

const ACCENT_CYCLE = ["#e60012", "#ff4d4d", "#c40010", "#8f0010", "#a60012", "#ff3355"];

export interface NewLauncherItemInput {
  name: string;
  type: LauncherItemType;
  target: string;
  category: LauncherItem["category"];
  favorite?: boolean;
  arguments?: string[];
  icon?: string;
}

export interface UpdateLauncherItemInput {
  name?: string;
  type?: LauncherItemType;
  target?: string;
  category?: LauncherItem["category"];
  favorite?: boolean;
  arguments?: string[];
  icon?: string;
}

interface LauncherStore {
  items: LauncherItem[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  hydrate: (items: LauncherItem[]) => void;
  setStatus: (status: LauncherStore["status"], error?: string | null) => void;
  addItem: (input: NewLauncherItemInput) => Promise<void>;
  updateItem: (id: string, patch: UpdateLauncherItemInput) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  reorderItems: (category: LauncherItem["category"], orderedIds: string[]) => Promise<void>;
  reorderFavorites: (orderedIds: string[]) => Promise<void>;
}

function nextFavoriteOrder(items: LauncherItem[]): number {
  const favorites = items.filter((item) => item.favorite);
  if (favorites.length === 0) return 0;
  return Math.max(...favorites.map((item) => item.favoriteOrder)) + 1;
}

export const useLauncherStore = create<LauncherStore>((set, get) => ({
  items: [],
  status: "idle",
  error: null,

  hydrate: (items) => set({ items, status: "ready", error: null }),

  setStatus: (status, error = null) => set({ status, error }),

  addItem: async (input) => {
    const categoryItems = get().items.filter((item) => item.category === input.category);
    const nextOrder =
      categoryItems.length > 0
        ? Math.max(...categoryItems.map((item) => item.order)) + 1
        : 0;

    const isFavorite = input.favorite ?? false;
    const newItem: LauncherItem = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      type: input.type,
      target: input.target.trim(),
      category: input.category,
      favorite: isFavorite,
      order: nextOrder,
      favoriteOrder: isFavorite ? nextFavoriteOrder(get().items) : 0,
      accent: ACCENT_CYCLE[get().items.length % ACCENT_CYCLE.length],
      arguments: input.arguments,
      icon: input.icon,
    };

    const items = [...get().items, newItem];
    await mergeAndSaveState({ items });
    set({ items, error: null });
  },

  updateItem: async (id, patch) => {
    const current = get().items;
    const items = current.map((item) => {
      if (item.id !== id) return item;

      const nextFavorite = patch.favorite !== undefined ? patch.favorite : item.favorite;
      const becomingFavorite = nextFavorite && !item.favorite;

      return {
        ...item,
        ...patch,
        name: patch.name !== undefined ? patch.name.trim() : item.name,
        target: patch.target !== undefined ? patch.target.trim() : item.target,
        favoriteOrder: becomingFavorite ? nextFavoriteOrder(current) : item.favoriteOrder,
      };
    });
    await mergeAndSaveState({ items });
    set({ items, error: null });
  },

  removeItem: async (id) => {
    const items = get().items.filter((item) => item.id !== id);
    await mergeAndSaveState({ items });
    set({ items, error: null });
  },

  toggleFavorite: async (id) => {
    const current = get().items;
    const items = current.map((item) => {
      if (item.id !== id) return item;
      const nextFavorite = !item.favorite;
      return {
        ...item,
        favorite: nextFavorite,
        favoriteOrder: nextFavorite ? nextFavoriteOrder(current) : item.favoriteOrder,
      };
    });
    await mergeAndSaveState({ items });
    set({ items, error: null });
  },

  reorderItems: async (category, orderedIds) => {
    const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
    const items = get().items.map((item) => {
      if (item.category !== category) return item;
      const nextOrder = orderMap.get(item.id);
      return nextOrder !== undefined ? { ...item, order: nextOrder } : item;
    });
    await mergeAndSaveState({ items });
    set({ items, error: null });
  },

  reorderFavorites: async (orderedIds) => {
    const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
    const items = get().items.map((item) => {
      if (!item.favorite) return item;
      const nextOrder = orderMap.get(item.id);
      return nextOrder !== undefined ? { ...item, favoriteOrder: nextOrder } : item;
    });
    await mergeAndSaveState({ items });
    set({ items, error: null });
  },
}));
