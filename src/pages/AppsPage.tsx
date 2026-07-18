import { InstalledAppsView } from "../features/launcher/InstalledAppsView";
import { useT } from "../i18n";

export function AppsPage() {
  const t = useT();

  return <InstalledAppsView sectionBadge={t("sections.badges.apps")} />;
}
