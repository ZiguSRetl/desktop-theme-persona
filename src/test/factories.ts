import type { DesktopSettings, LauncherItem } from "../types/desktop";
import { createDefaultSettings } from "../features/launcher/persistence";

let itemSeq = 0;

export function makeLauncherItem(
  overrides: Partial<LauncherItem> = {},
): LauncherItem {
  itemSeq += 1;
  return {
    id: overrides.id ?? `item-${itemSeq}`,
    name: overrides.name ?? `Item ${itemSeq}`,
    type: overrides.type ?? "application",
    target: overrides.target ?? `app-${itemSeq}.exe`,
    category: overrides.category ?? "apps",
    favorite: overrides.favorite ?? false,
    order: overrides.order ?? itemSeq - 1,
    favoriteOrder: overrides.favoriteOrder ?? itemSeq - 1,
    accent: overrides.accent,
    icon: overrides.icon,
    arguments: overrides.arguments,
  };
}

export function makeSettings(
  overrides: Partial<DesktopSettings> = {},
): DesktopSettings {
  return { ...createDefaultSettings(), ...overrides };
}

export function resetFactories(): void {
  itemSeq = 0;
}
