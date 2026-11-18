import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Star } from "lucide-react";
import { useT } from "../../i18n";
import type { LauncherItem } from "../../types/desktop";
import {
  filterInstalledApps,
  installedAppToLauncherItem,
  normalizeLauncherTarget,
} from "./installedAppsSelectors";
import { useInstalledAppsStore } from "./installedAppsStore";
import { useLauncherStore } from "./launcherStore";
import { LauncherItemIcon } from "./LauncherItemIcon";
import { launchItem } from "./launchItem";
import { tileDisplayName } from "./LauncherTile";
import { filterLauncherItems } from "./searchSelectors";
import { showLaunchError } from "./toastStore";
import styles from "./ApplicationsWidget.module.css";

const RESULT_BATCH = 36;

interface ApplicationsWidgetProps {
  id: string;
  reducedMotion: boolean;
  onLaunch: () => void;
}

function isGame(item: LauncherItem): boolean {
  return item.type === "game" || item.category === "games";
}

export function ApplicationsWidget({ id, reducedMotion, onLaunch }: ApplicationsWidgetProps) {
  const t = useT();
  const [params] = useSearchParams();
  const [gamesOnly, setGamesOnly] = useState(params.get("filter") === "games");
  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState<string>();
  const [visibleCount, setVisibleCount] = useState(RESULT_BATCH);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const scrollToActive = useRef(false);
  const titleId = useId();
  const listId = useId();
  const items = useLauncherStore((state) => state.items);
  const launcherError = useLauncherStore((state) => state.error);
  const apps = useInstalledAppsStore((state) => state.apps);
  const iconsByPath = useInstalledAppsStore((state) => state.iconsByPath);
  const catalogStatus = useInstalledAppsStore((state) => state.status);
  const catalogError = useInstalledAppsStore((state) => state.error);
  const ensureLoaded = useInstalledAppsStore((state) => state.ensureLoaded);

  useEffect(() => {
    searchRef.current?.focus();
    void ensureLoaded();
  }, [ensureLoaded]);

  const results = useMemo(() => {
    const saved = filterLauncherItems(gamesOnly ? items.filter(isGame) : items, query)
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) ||
        (a.favorite ? a.favoriteOrder - b.favoriteOrder : a.order - b.order))
      .map((item) => ({ key: `saved:${item.id}`, item }));
    const targets = new Set(saved.map(({ item }) => normalizeLauncherTarget(item.target)));
    const catalog = filterInstalledApps(apps, query)
      .filter((app) => !targets.has(normalizeLauncherTarget(app.path)))
      .map((app) => ({ key: `catalog:${app.path}`, item: installedAppToLauncherItem(app) }))
      .filter(({ item }) => !gamesOnly || isGame(item));
    return [...saved, ...catalog];
  }, [apps, gamesOnly, items, query]);

  const selectedIndex = Math.max(0, results.findIndex((result) => result.key === activeKey));
  const activeOptionId = results.length ? `${listId}-${selectedIndex}` : undefined;
  const displayedCount = Math.max(visibleCount, selectedIndex + 1);
  const loading = catalogStatus === "idle" || catalogStatus === "loading";

  useEffect(() => {
    if (!scrollToActive.current) return;
    scrollToActive.current = false;
    if (activeOptionId) {
      document.getElementById(activeOptionId)?.scrollIntoView?.({ block: "nearest" });
    }
  }, [activeOptionId]);

  const resetResults = () => {
    setActiveKey(undefined);
    setVisibleCount(RESULT_BATCH);
    if (listRef.current) listRef.current.scrollTop = 0;
  };

  const launch = (item: LauncherItem) => {
    void launchItem(item).catch((error: unknown) =>
      showLaunchError(typeof error === "string" ? new Error(error) : error),
    );
    onLaunch();
  };

  const handleSearchKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || results.length === 0) return;
    if (event.key === "Enter") {
      event.preventDefault();
      launch(results[selectedIndex].item);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const offset = event.key === "ArrowDown" ? 1 : -1;
    const next = Math.min(results.length - 1, Math.max(0, selectedIndex + offset));
    if (next !== selectedIndex) {
      scrollToActive.current = true;
      setActiveKey(results[next].key);
      if (next >= visibleCount) setVisibleCount(next + RESULT_BATCH);
    }
  };

  return (
    <section
      id={id}
      className={styles.widget}
      aria-labelledby={titleId}
      data-reduced-motion={reducedMotion}
    >
      <header className={styles.heading}>
        <h2 id={titleId}>{t("nav.items.apps")}</h2>
        <button
          type="button"
          className={styles.filter}
          aria-pressed={gamesOnly}
          onClick={() => {
            setGamesOnly(!gamesOnly);
            resetResults();
            searchRef.current?.focus();
          }}
        >
          {t("nav.items.games")}
        </button>
      </header>

      <div className={styles.search}>
        <Search size={17} aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={activeOptionId}
          aria-label={t("installedApps.search.ariaLabel")}
          placeholder={t("installedApps.search.placeholder")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            resetResults();
          }}
          onKeyDown={handleSearchKeys}
        />
      </div>

      <ul
        ref={listRef}
        id={listId}
        className={styles.results}
        role="listbox"
        aria-labelledby={titleId}
        onScroll={(event) => {
          const list = event.currentTarget;
          if (displayedCount < results.length &&
              list.scrollHeight - list.scrollTop - list.clientHeight < 96) {
            setVisibleCount(displayedCount + RESULT_BATCH);
          }
        }}
      >
        {results.slice(0, displayedCount).map(({ key, item }, index) => (
          <li
            key={key}
            id={`${listId}-${index}`}
            className={styles.result}
            role="option"
            aria-selected={index === selectedIndex}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => launch(item)}
          >
            <LauncherItemIcon type={item.type} icon={item.icon ?? iconsByPath[item.target]} />
            <span>{tileDisplayName(item.name, item.target)}</span>
            {item.favorite ? <Star className={styles.star} size={15} aria-hidden="true" /> : null}
          </li>
        ))}
      </ul>

      {launcherError ? <p className={styles.status} role="alert">{launcherError}</p> : null}
      {loading || catalogError || !results.length ? (
        <p className={styles.status} role="status">
          {catalogError
            ? t("installedApps.error")
            : t(loading ? "installedApps.loading" : "installedApps.empty")}
        </p>
      ) : null}

      <footer className={styles.actions}>
        <Link to={gamesOnly ? "/apps/shortcuts?filter=games" : "/apps/shortcuts"}>
          {t("installedApps.manageShortcuts")}
        </Link>
        <Link to="/apps/catalog">{t("installedApps.openCatalog")}</Link>
      </footer>
    </section>
  );
}
