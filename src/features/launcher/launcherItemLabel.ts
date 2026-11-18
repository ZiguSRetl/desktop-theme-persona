import { tt } from "../../i18n";

export function launcherItemLabel(name: string, target: string): string {
  const trimmed = name.trim();
  if (trimmed) return trimmed;
  const segment = target.replace(/[/\\]+$/, "").split(/[/\\]/).pop();
  return segment || tt("launcher.unnamed");
}
