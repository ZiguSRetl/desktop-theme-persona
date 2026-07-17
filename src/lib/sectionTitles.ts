import type { AppSection } from "../components/comic/HalftoneBackground/HalftoneBackground";
import type { TranslationKey } from "../i18n";

const titleKeys: Record<AppSection, TranslationKey> = {
  home: "sections.titles.home",
  apps: "sections.titles.apps",
  games: "sections.titles.games",
  system: "sections.titles.system",
  scripts: "sections.titles.scripts",
  settings: "sections.titles.settings",
};

export function sectionTitle(section: AppSection, t: (key: TranslationKey) => string): string {
  return t(titleKeys[section]);
}
