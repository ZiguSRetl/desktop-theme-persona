import { ComicClock } from "../components/comic";
import { useLauncherStore } from "../features/launcher/launcherStore";
import { useT } from "../i18n";

export function HomePage() {
  const t = useT();
  const status = useLauncherStore((state) => state.status);
  const error = useLauncherStore((state) => state.error);

  return (
    <div className="desktop-home">
      <ComicClock desktop />
      {status === "loading" ? <p className="launcher-loading">{t("sections.loading")}</p> : null}
      {status === "error" ? <p className="launcher-loading" role="alert">{error}</p> : null}
    </div>
  );
}
