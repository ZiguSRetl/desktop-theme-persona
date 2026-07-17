import { LauncherView } from "../features/launcher/LauncherView";
import { useLauncherStore } from "../features/launcher/launcherStore";

export function GamesPage() {
  const status = useLauncherStore((state) => state.status);

  if (status === "loading") {
    return <p className="launcher-loading">Cargando accesos…</p>;
  }

  return <LauncherView category="games" sectionBadge="Entretenimiento" />;
}
