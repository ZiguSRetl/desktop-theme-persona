import type { LauncherItem, LauncherItemType } from "../../types/desktop";

function typeLabel(type: LauncherItemType): string {
  switch (type) {
    case "application":
      return "aplicación";
    case "game":
      return "juego";
    case "folder":
      return "carpeta";
    case "url":
      return "enlace web";
  }
}

function categoryLabel(category: LauncherItem["category"]): string {
  switch (category) {
    case "apps":
      return "productividad";
    case "games":
      return "entretenimiento";
    case "system":
      return "utilidades del sistema";
  }
}

export function itemDescription(item: LauncherItem): string {
  const type = typeLabel(item.type);
  const category = categoryLabel(item.category);

  if (item.type === "url") {
    return `Enlace directo a ${item.target}. Categoría: ${category}.`;
  }

  if (item.type === "folder") {
    return `Abre la carpeta en: ${item.target}`;
  }

  if (item.type === "game") {
    return `${item.name} — ${type} en la categoría ${category}. Pulsa ABRIR para iniciar.`;
  }

  return `${item.name} — ${type} de ${category}. Pulsa ABRIR para ejecutar.`;
}

export function canRevealLocation(item: LauncherItem): boolean {
  return item.type !== "url" && item.target.trim().length > 0;
}
