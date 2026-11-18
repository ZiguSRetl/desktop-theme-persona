import { useSearchParams } from "react-router-dom";
import { LauncherView } from "../features/launcher/LauncherView";
import { useLauncherStore } from "../features/launcher/launcherStore";
import { useT } from "../i18n";

export function ShortcutsPage() {
  const t = useT();
  const [params] = useSearchParams();
  const status = useLauncherStore((state) => state.status);

  if (status === "loading") {
    return <p className="launcher-loading">{t("sections.loading")}</p>;
  }

  return params.get("filter") === "games"
    ? <LauncherView key="games" category="games" sectionBadge={t("sections.badges.games")} />
    : <LauncherView key="favorites" source="favorites" sectionBadge={t("sections.badges.home")} showStar />;
}
