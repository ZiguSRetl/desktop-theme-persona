import { LauncherView } from "../features/launcher/LauncherView";
import { useLauncherStore } from "../features/launcher/launcherStore";
import { useT } from "../i18n";

export function AppsPage() {
  const t = useT();
  const status = useLauncherStore((state) => state.status);

  if (status === "loading") {
    return <p className="launcher-loading">{t("sections.loading")}</p>;
  }

  return <LauncherView category="apps" sectionBadge={t("sections.badges.apps")} />;
}
