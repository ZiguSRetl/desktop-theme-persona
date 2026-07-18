import { FolderOpen, Star } from "lucide-react";
import { useT } from "../../i18n";
import { ComicPanel } from "../../components/comic/ComicPanel";
import { LauncherItemIcon } from "./LauncherItemIcon";
import { tileDisplayName } from "./LauncherTile";
import type { InstalledAppResult } from "./appSearchService";
import styles from "./LauncherDetailPanel.module.css";

interface InstalledAppDetailPanelProps {
  app: InstalledAppResult | null;
  icon?: string;
  isFavorite?: boolean;
  canReveal?: boolean;
  onLaunch: (app: InstalledAppResult) => void;
  onToggleFavorite: (app: InstalledAppResult) => void;
  onReveal: (app: InstalledAppResult) => void;
}

export function InstalledAppDetailPanel({
  app,
  icon,
  isFavorite = false,
  canReveal = true,
  onLaunch,
  onToggleFavorite,
  onReveal,
}: InstalledAppDetailPanelProps) {
  const t = useT();

  if (!app) {
    return (
      <ComicPanel variant="white" rotation={-1} shadowColor="red" className={styles.panel}>
        <p className={styles.empty}>{t("installedApps.detail.empty")}</p>
      </ComicPanel>
    );
  }

  return (
    <ComicPanel variant="white" rotation={-1} shadowColor="red" className={styles.panel}>
      <div className={styles.hero}>
        <LauncherItemIcon type="application" icon={icon} className={styles.iconWrap} />
        <h2 className={styles.name}>{tileDisplayName(app.name, app.path)}</h2>
        <p className={styles.description}>{app.source}</p>
        <p className={styles.target} title={app.path}>
          {app.path}
        </p>
      </div>

      <div className={styles.primaryActions}>
        <button type="button" className={styles.openBtn} onClick={() => onLaunch(app)}>
          {t("launcher.detail.open")}
        </button>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.actionBtn} ${isFavorite ? styles.actionBtnActive : ""}`}
          onClick={() => onToggleFavorite(app)}
        >
          <Star size={16} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" />
          {isFavorite ? t("launcher.detail.removeFavorite") : t("launcher.detail.addFavorite")}
        </button>

        {canReveal ? (
          <button type="button" className={styles.actionBtn} onClick={() => onReveal(app)}>
            <FolderOpen size={16} aria-hidden="true" />
            {t("launcher.detail.reveal")}
          </button>
        ) : null}
      </div>
    </ComicPanel>
  );
}
