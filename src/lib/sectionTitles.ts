import type { AppSection } from "../components/comic/HalftoneBackground/HalftoneBackground";

const titles: Record<AppSection, string> = {
  home: "INICIO",
  apps: "APLICACIONES",
  games: "JUEGOS",
  system: "SISTEMA",
  scripts: "SCRIPTS",
  settings: "AJUSTES",
};

export function sectionTitle(section: AppSection): string {
  return titles[section];
}
