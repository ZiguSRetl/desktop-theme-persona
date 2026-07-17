import { LauncherView } from "../features/launcher/LauncherView";
import { useLauncherStore } from "../features/launcher/launcherStore";
import { useT } from "../i18n";

export function HomePage() {
  const t = useT();
  const status = useLauncherStore((state) => state.status);

  if (status === "loading") {
    return <p className="launcher-loading">{t("sections.loading")}</p>;
  }

  return <LauncherView source="favorites" sectionBadge={t("sections.badges.home")} showStar />;
}
