import { Sparkles, type LucideIcon } from "lucide-react";
import { tt, type TranslationKey } from "../../i18n";

export type ScriptId = "clean";

export interface ScriptPlannedStep {
  id: string;
  labelKey: TranslationKey;
}

export interface ScriptDefinition {
  id: ScriptId;
  readonly name: string;
  readonly description: string;
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
    get name() {
      return tt("scripts.clean.name");
    },
    get description() {
      return tt("scripts.clean.description");
    },
    icon: Sparkles,
    accent: "#e60012",
    plannedSteps: [
      { id: "power-plan", labelKey: "scripts.clean.steps.powerPlan" },
      { id: "close-apps", labelKey: "scripts.clean.steps.closeApps" },
      { id: "purge-standby", labelKey: "scripts.clean.steps.purgeStandby" },
      { id: "clear-cache", labelKey: "scripts.clean.steps.clearCache" },
      { id: "gpu-reset", labelKey: "scripts.clean.steps.gpuReset" },
    ],
    appsToClose: [...APPS_TO_CLOSE],
  },
];

export function getScriptById(id: ScriptId): ScriptDefinition | undefined {
  return SCRIPTS.find((script) => script.id === id);
}
