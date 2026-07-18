import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useT } from "../../i18n";
import type { LauncherItem } from "../../types/desktop";
import { isFilesystemAppPath, type InstalledAppResult } from "./appSearchService";
import { CatalogLayoutMenu } from "./CatalogLayoutMenu";
import {
  catalogAppCategory,
  filterInstalledApps,
  findLauncherItemByTarget,
} from "./installedAppsSelectors";
import { useInstalledAppsStore } from "./installedAppsStore";
import { useLauncherStore } from "./launcherStore";
import { launchItem } from "./launchItem";
import { revealItemInDir } from "./revealItem";
import { showLaunchError, showSuccess } from "./toastStore";
import { InstalledAppDetailPanel } from "./InstalledAppDetailPanel";
import { LauncherItemIcon } from "./LauncherItemIcon";
import { LauncherTile, tileDisplayName } from "./LauncherTile";
import { SectionBadge } from "./SectionBadge";
import styles from "./LauncherView.module.css";
import catalogStyles from "./InstalledAppsView.module.css";

const INITIAL_VISIBLE = 36;
const LOAD_MORE_STEP = 24;

function toLaunchItem(app: InstalledAppResult, icon?: string): LauncherItem {
  return {
    id: app.path,
    name: app.name,
    type: "application",
    target: app.path,
    category: catalogAppCategory(app),
    favorite: false,
    order: 0,
    favoriteOrder: 0,
    icon,
  };
}

interface InstalledAppsViewProps {
  sectionBadge: string;
}

export function InstalledAppsView({ sectionBadge }: InstalledAppsViewProps) {
  const t = useT();
  const apps = useInstalledAppsStore((state) => state.apps);
  const status = useInstalledAppsStore((state) => state.status);
  const error = useInstalledAppsStore((state) => state.error);
  const loadedOnce = useInstalledAppsStore((state) => state.loadedOnce);
  const filterQuery = useInstalledAppsStore((state) => state.filterQuery);
  const layoutMode = useInstalledAppsStore((state) => state.layoutMode);
  const iconsByPath = useInstalledAppsStore((state) => state.iconsByPath);
  const ensureLoaded = useInstalledAppsStore((state) => state.ensureLoaded);
  const refreshFromOs = useInstalledAppsStore((state) => state.refreshFromOs);
  const setFilterQuery = useInstalledAppsStore((state) => state.setFilterQuery);
  const requestIcons = useInstalledAppsStore((state) => state.requestIcons);

  const launcherItems = useLauncherStore((state) => state.items);
  const addItem = useLauncherStore((state) => state.addItem);
  const toggleFavorite = useLauncherStore((state) => state.toggleFavorite);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const wasHiddenRef = useRef(false);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        wasHiddenRef.current = true;
        return;
      }

      if (document.visibilityState === "visible" && wasHiddenRef.current && loadedOnce) {
        wasHiddenRef.current = false;
        void refreshFromOs();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loadedOnce, refreshFromOs]);

  const filteredApps = useMemo(
    () => filterInstalledApps(apps, filterQuery),
    [apps, filterQuery],
  );

  const visibleApps = useMemo(
    () => filteredApps.slice(0, visibleCount),
    [filteredApps, visibleCount],
  );

  const hasMore = visibleCount < filteredApps.length;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((current) =>
            Math.min(current + LOAD_MORE_STEP, filteredApps.length),
          );
        }
      },
      { root, rootMargin: "240px", threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, filteredApps.length, visibleCount]);

  const selectedApp = useMemo(() => {
    if (filteredApps.length === 0) return null;
    const match = selectedPath
      ? filteredApps.find((app) => app.path === selectedPath)
      : undefined;
    return match ?? filteredApps[0] ?? null;
  }, [filteredApps, selectedPath]);

  const selectedLauncherItem = useMemo(
    () =>
      selectedApp
        ? findLauncherItemByTarget(launcherItems, selectedApp.path)
        : undefined,
    [launcherItems, selectedApp],
  );
  const selectedIsFavorite = Boolean(selectedLauncherItem?.favorite);

  const visiblePathsKey = visibleApps.map((app) => app.path).join("\0");

  useEffect(() => {
    const paths = visiblePathsKey ? visiblePathsKey.split("\0").filter(Boolean) : [];
    if (paths.length === 0) return;
    requestIcons(paths);
  }, [visiblePathsKey, requestIcons]);

  const handleFilterChange = (value: string) => {
    setFilterQuery(value);
    setVisibleCount(INITIAL_VISIBLE);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  };

  const handleLaunch = async (app: InstalledAppResult) => {
    try {
      await launchItem(toLaunchItem(app, iconsByPath[app.path]));
    } catch (launchError) {
      showLaunchError(launchError);
    }
  };

  const handleReveal = async (app: InstalledAppResult) => {
    try {
      await revealItemInDir(app.path);
    } catch (revealError) {
      showLaunchError(revealError);
    }
  };

  const handleToggleFavorite = async (app: InstalledAppResult) => {
    try {
      const existing = findLauncherItemByTarget(
        useLauncherStore.getState().items,
        app.path,
      );
      if (existing) {
        await toggleFavorite(existing.id);
        return;
      }

      await addItem({
        name: app.name,
        type: "application",
        target: app.path,
        category: catalogAppCategory(app),
        favorite: true,
        icon: iconsByPath[app.path],
      });
      showSuccess(t("launcher.toasts.added"));
    } catch (favoriteError) {
      showLaunchError(favoriteError);
    }
  };

  if (status === "error" && !loadedOnce && apps.length === 0) {
    return <p className="launcher-loading">{error ?? t("installedApps.error")}</p>;
  }

  const listItems = visibleApps.map((app) => {
    const selected = selectedApp?.path === app.path;
    return (
      <button
        key={app.path}
        type="button"
        role="listitem"
        className={`${catalogStyles.row} ${selected ? catalogStyles.rowSelected : ""}`}
        aria-pressed={selected}
        onClick={() => setSelectedPath(app.path)}
        onDoubleClick={() => void handleLaunch(app)}
      >
        <LauncherItemIcon
          type="application"
          icon={iconsByPath[app.path]}
          className={catalogStyles.rowIcon}
        />
        <span className={catalogStyles.rowText}>
          <span className={catalogStyles.rowName}>{tileDisplayName(app.name, app.path)}</span>
          <span className={catalogStyles.rowMeta}>{app.source}</span>
        </span>
      </button>
    );
  });

  return (
    <div className="page-layout launcher-page">
      <SectionBadge label={sectionBadge} />

      {status === "loading" ? (
        <p className={catalogStyles.scanning}>{t("installedApps.loading")}</p>
      ) : null}

      <div className={catalogStyles.toolbar}>
        <div className={catalogStyles.searchBar}>
          <Search size={18} className={catalogStyles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            className={catalogStyles.searchInput}
            value={filterQuery}
            onChange={(event) => handleFilterChange(event.target.value)}
            placeholder={t("installedApps.search.placeholder")}
            aria-label={t("installedApps.search.ariaLabel")}
          />
        </div>
        <CatalogLayoutMenu />
      </div>

      <div className="launcher-layout">
        <div className={styles.main}>
          <div ref={scrollRef} className={catalogStyles.gridScroll}>
            {visibleApps.length === 0 ? (
              <p className={catalogStyles.empty}>{t("installedApps.empty")}</p>
            ) : (
              <>
                {layoutMode === "grid" ? (
                  <div className={catalogStyles.tileGrid} role="list">
                    {visibleApps.map((app) => (
                      <div key={app.path} role="listitem">
                        <LauncherTile
                          name={app.name}
                          target={app.path}
                          type="application"
                          icon={iconsByPath[app.path]}
                          selected={selectedApp?.path === app.path}
                          onSelect={() => setSelectedPath(app.path)}
                          onLaunch={() => void handleLaunch(app)}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}

                {layoutMode === "list" ? (
                  <div className={catalogStyles.listFull} role="list">
                    {listItems}
                  </div>
                ) : null}

                {layoutMode === "listSplit" ? (
                  <div className={catalogStyles.listSplit} role="list">
                    {listItems}
                  </div>
                ) : null}

                {layoutMode === "listRail" ? (
                  <div className={catalogStyles.listRail}>
                    <div className={catalogStyles.listRailList} role="list">
                      {listItems}
                    </div>
                    <div className={catalogStyles.listRailGap} aria-hidden="true" />
                  </div>
                ) : null}

                {hasMore ? (
                  <div ref={sentinelRef} className={catalogStyles.sentinel} aria-hidden="true" />
                ) : null}
              </>
            )}
          </div>
        </div>

        <aside className={styles.detailAside} aria-label={t("launcher.detail.asideAria")}>
          <details className="context-panel__details launcher-panel__details" open>
            <summary className="context-panel__toggle">{t("launcher.detail.summary")}</summary>
            <div className="context-panel__content">
              <InstalledAppDetailPanel
                app={selectedApp}
                icon={selectedApp ? iconsByPath[selectedApp.path] : undefined}
                isFavorite={selectedIsFavorite}
                canReveal={selectedApp ? isFilesystemAppPath(selectedApp.path) : false}
                onLaunch={(app) => void handleLaunch(app)}
                onToggleFavorite={(app) => void handleToggleFavorite(app)}
                onReveal={(app) => void handleReveal(app)}
              />
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
