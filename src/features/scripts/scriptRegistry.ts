import { Sparkles, type LucideIcon } from "lucide-react";

export type ScriptId = "clean";

export interface ScriptPlannedStep {
  id: string;
  label: string;
}

export interface ScriptDefinition {
  id: ScriptId;
  name: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  plannedSteps: ScriptPlannedStep[];
  appsToClose: string[];
}

export const APPS_TO_CLOSE = [
  "Google Chrome",
  "Microsoft Edge",
  "Mozilla Firefox",
  "Discord",
  "Steam",
  "Epic Games Launcher",
] as const;

export const SCRIPTS: ScriptDefinition[] = [
  {
    id: "clean",
    name: "Clean",
    description:
      "Prepara el PC para jugar liberando RAM en caché, VRAM y cachés de shaders. Activa Alto rendimiento y cierra apps que suelen consumir GPU/RAM.",
    icon: Sparkles,
    accent: "#e60012",
    plannedSteps: [
      { id: "power-plan", label: "Activar plan de energía Alto rendimiento" },
      { id: "close-apps", label: "Cerrar apps en segundo plano" },
      { id: "purge-standby", label: "Purgar RAM standby" },
      { id: "clear-cache", label: "Limpiar cachés temporales y de shaders" },
      { id: "gpu-reset", label: "Resetear GPU NVIDIA (si está disponible)" },
    ],
    appsToClose: [...APPS_TO_CLOSE],
  },
];

export function getScriptById(id: ScriptId): ScriptDefinition | undefined {
  return SCRIPTS.find((script) => script.id === id);
}
