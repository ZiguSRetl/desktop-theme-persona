import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Ellipsis, Plus, Search, Star } from "lucide-react";
import { useT } from "../../i18n";
import { AddShortcutDialog } from "../../components/comic/AddShortcutDialog";
import dropdownStyles from "../../components/Navigation/Dropdown.module.css";
import type { LauncherItem } from "../../types/desktop";
import {
  filterInstalledApps,
  findLauncherItemByTarget,
  installedAppToLauncherItem,
  normalizeLauncherTarget,
} from "./installedAppsSelectors";
import { useInstalledAppsStore } from "./installedAppsStore";
import { useLauncherStore } from "./launcherStore";
import { LauncherItemIcon } from "./LauncherItemIcon";
import { launchItem } from "./launchItem";
import { launcherItemLabel } from "./launcherItemLabel";
import { filterLauncherItems } from "./searchSelectors";
import { showLaunchError, showSuccess } from "./toastStore";
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
  const [actionsOpen, setActionsOpen] = useState(false);
  const [editor, setEditor] = useState<"create" | LauncherItem | null>(null);
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const scrollToActive = useRef(false);
  const titleId = useId();
  const listId = useId();
  const actionsId = useId();
  const items = useLauncherStore((state) => state.items);
  const launcherError = useLauncherStore((state) => state.error);
  const apps = useInstalledAppsStore((state) => state.apps);
  const catalogStatus = useInstalledAppsStore((state) => state.status);
  const catalogError = useInstalledAppsStore((state) => state.error);
  const ensureLoaded = useInstalledAppsStore((state) => state.ensureLoaded);
  const { addItem, updateItem, removeItem, toggleFavorite } = useLauncherStore.getState();

  useEffect(() => {
    searchRef.current?.focus();
    void ensureLoaded();
  }, [ensureLoaded]);

  const results = useMemo(() => {
    const matchingApps = filterInstalledApps(apps, query);
    const catalogTargets = new Set(matchingApps.map((app) => normalizeLauncherTarget(app.path)));
    const matchingSaved = new Set(filterLauncherItems(items, query));
    const saved = items
      .filter((item) => (!gamesOnly || isGame(item)) &&
        (matchingSaved.has(item) || catalogTargets.has(normalizeLauncherTarget(item.target))))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) ||
        (a.favorite ? a.favoriteOrder - b.favoriteOrder : a.order - b.order))
      .map((item) => ({ key: `saved:${item.id}`, item }));
    const targets = new Set(saved.map(({ item }) => normalizeLauncherTarget(item.target)));
    const catalog = matchingApps
      .filter((app) => !targets.has(normalizeLauncherTarget(app.path)))
      .map((app) => ({ key: `catalog:${app.path}`, item: installedAppToLauncherItem(app) }))
      .filter(({ item }) => !gamesOnly || isGame(item));
    return [...saved, ...catalog];
  }, [apps, gamesOnly, items, query]);

  const selectedIndex = Math.max(0, results.findIndex((result) => result.key === activeKey));
  const activeOptionId = results.length ? `${listId}-${selectedIndex}` : undefined;
  const displayedCount = Math.max(visibleCount, selectedIndex + 1);
  const loading = catalogStatus === "idle" || catalogStatus === "loading";
  const selection = results[selectedIndex];
  const actionsVisible = actionsOpen && selection !== undefined && selection.key === activeKey;
  const savedSelection = selection?.key.startsWith("saved:")
    ? selection.item
    : findLauncherItemByTarget(items, selection?.item.target ?? "");

  useEffect(() => {
    if (actionsVisible) actionsRef.current?.querySelector("button")?.focus();
  }, [actionsVisible]);

  useEffect(() => {
    if (!scrollToActive.current) return;
    scrollToActive.current = false;
    if (activeOptionId) {
      document.getElementById(activeOptionId)?.scrollIntoView?.({ block: "nearest" });
    }
  }, [activeOptionId]);

  const resetResults = () => {
    setActiveKey(undefined);
    setActionsOpen(false);
    setVisibleCount(RESULT_BATCH);
    if (listRef.current) listRef.current.scrollTop = 0;
  };

  const openActionsFor = (key: string) => {
    setActiveKey(key);
    setActionsOpen(true);
  };

  const closeEditor = () => {
    setEditor(null);
    setActionsOpen(false);
    searchRef.current?.focus();
  };

  const runAction = async (action: () => Promise<void>) => {
    if (saving) return;
    setSaving(true);
    try {
      await action();
      setActionsOpen(false);
      searchRef.current?.focus();
    } catch (error) {
      showLaunchError(typeof error === "string" ? new Error(error) : error);
    } finally {
      setSaving(false);
    }
  };

  const favoriteSelection = () => {
    if (!selection) return;
    if (savedSelection) {
      void runAction(() => toggleFavorite(savedSelection.id));
    } else {
      const { name, type, target, category } = selection.item;
      void runAction(() => addItem({
        name, type, target, category, favorite: true,
      }));
    }
  };

  const deleteShortcut = (item: LauncherItem) => {
    const name = launcherItemLabel(item.name, item.target);
    if (window.confirm(t("launcher.confirm.remove", { name, path: item.target }))) {
      void runAction(async () => {
        await removeItem(item.id);
        showSuccess(t("launcher.toasts.removed", { name }));
      });
    }
  };

  const launch = (item: LauncherItem) => {
    void launchItem(item).catch((error: unknown) =>
      showLaunchError(typeof error === "string" ? new Error(error) : error),
    );
    onLaunch();
  };

  const handleSearchKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || !selection) return;
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      openActionsFor(selection.key);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      launch(selection.item);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const offset = event.key === "ArrowDown" ? 1 : -1;
    const next = Math.min(results.length - 1, Math.max(0, selectedIndex + offset));
    if (next !== selectedIndex) {
      setActionsOpen(false);
      scrollToActive.current = true;
      setActiveKey(results[next].key);
      if (next >= visibleCount) setVisibleCount(next + RESULT_BATCH);
    }
  };

  return (
    <section
      id={id}
      className={`${dropdownStyles.dropdown} ${styles.widget}`}
      aria-labelledby={titleId}
      data-reduced-motion={reducedMotion}
    >
      <header className={styles.heading}>
        <h2 id={titleId} className={dropdownStyles.title}>{t("nav.items.apps")}</h2>
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
            onMouseDown={(event) => {
              if (event.button === 0) event.preventDefault();
            }}
            onClick={() => launch(item)}
            onContextMenu={(event) => {
              event.preventDefault();
              openActionsFor(key);
            }}
          >
            <LauncherItemIcon type={item.type} icon={item.icon} />
            <span>{launcherItemLabel(item.name, item.target)}</span>
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
        <button type="button" disabled={saving} onClick={() => setEditor("create")}>
          <Plus size={15} aria-hidden="true" />
          {t("shortcutDialog.title.create")}
        </button>
        {selection ? (
          <button
            type="button"
            disabled={saving}
            aria-expanded={actionsVisible}
            aria-controls={actionsVisible ? actionsId : undefined}
            onClick={() => {
              if (actionsVisible) setActionsOpen(false);
              else openActionsFor(selection.key);
            }}
          >
            <Ellipsis size={16} aria-hidden="true" />
            <span>{t("installedApps.actionsFor", {
              name: launcherItemLabel(selection.item.name, selection.item.target),
            })}</span>
          </button>
        ) : null}
        {actionsVisible ? (
          <div id={actionsId} ref={actionsRef} className={styles.actionButtons}>
            <button type="button" disabled={saving} onClick={favoriteSelection}>
              {t(savedSelection?.favorite ? "launcher.detail.removeFavorite" : "launcher.detail.addFavorite")}
            </button>
            {savedSelection ? (
              <>
                <button type="button" disabled={saving} onClick={() => setEditor(savedSelection)}>
                  {t("shortcutDialog.title.edit")}
                </button>
                <button type="button" disabled={saving} onClick={() => deleteShortcut(savedSelection)}>
                  {t("launcher.detail.remove")}
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </footer>

      {editor === "create" ? (
        <AddShortcutDialog
          mode="create"
          open
          defaultCategory={gamesOnly ? "games" : "apps"}
          onClose={closeEditor}
          onSubmit={async (input) => {
            await addItem(input);
            showSuccess(t("launcher.toasts.added"));
          }}
        />
      ) : editor ? (
        <AddShortcutDialog
          mode="edit"
          open
          initialItem={editor}
          onClose={closeEditor}
          onSubmit={async (input) => {
            await updateItem(editor.id, input);
            showSuccess(t("launcher.toasts.updated"));
          }}
        />
      ) : null}
    </section>
  );
}
