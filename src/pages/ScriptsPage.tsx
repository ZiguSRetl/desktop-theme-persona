import { ScriptView } from "../features/scripts/ScriptView";
import { isWindowsHost } from "../features/system/platform";
import { useT } from "../i18n";

export function ScriptsPage() {
  const t = useT();
  return isWindowsHost() ? <ScriptView /> : (
    <p className="launcher-loading">{t("scripts.view.windowsOnly")}</p>
  );
}
