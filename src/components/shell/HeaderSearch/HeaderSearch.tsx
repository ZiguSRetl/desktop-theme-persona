import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { launchItem } from "../../../features/launcher/launchItem";
import { useLauncherStore } from "../../../features/launcher/launcherStore";
import { searchLauncherItems } from "../../../features/launcher/searchSelectors";
import { showLaunchError } from "../../../features/launcher/toastStore";
import { useT } from "../../../i18n";
import styles from "./HeaderSearch.module.css";

export interface HeaderSearchHandle {
  focus: () => void;
}

export const HeaderSearch = forwardRef<HeaderSearchHandle>(function HeaderSearch(_props, ref) {
  const t = useT();
  const items = useLauncherStore((state) => state.items);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchLauncherItems(items, query), [items, query]);
  const showDropdown = dropdownOpen && query.trim().length > 0;

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
      setDropdownOpen(true);
    },
  }));

  const closeDropdown = useCallback(() => {
    setDropdownOpen(false);
    setActiveIndex(0);
  }, []);

  const launchActive = useCallback(async () => {
    const item = results[activeIndex];
    if (!item) return;

    try {
      await launchItem(item);
      setQuery("");
      closeDropdown();
      inputRef.current?.blur();
    } catch (error) {
      showLaunchError(error);
    }
  }, [activeIndex, closeDropdown, results]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setDropdownOpen(true);
        return;
      }

      if (event.key === "/" && !isTypingField) {
        event.preventDefault();
        inputRef.current?.focus();
        setDropdownOpen(true);
        return;
      }

      if (!showDropdown) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setQuery("");
        closeDropdown();
        inputRef.current?.blur();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === "Enter" && document.activeElement === inputRef.current) {
        event.preventDefault();
        void launchActive();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeDropdown, launchActive, results.length, showDropdown]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeDropdown]);

  return (
    <div className={styles.searchWrap} ref={wrapRef}>
      <form
        className={styles.searchForm}
        onSubmit={(event) => {
          event.preventDefault();
          void launchActive();
        }}
      >
        <Search className={styles.searchIcon} size={18} aria-hidden="true" />
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setDropdownOpen(true);
          }}
          onFocus={() => setDropdownOpen(true)}
          placeholder={t("search.header.placeholder")}
          aria-label={t("search.header.ariaLabel")}
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          autoComplete="off"
        />
      </form>

      {showDropdown ? (
        <div className={styles.dropdown} role="listbox" aria-label={t("search.header.resultsAria")}>
          {results.length === 0 ? (
            <p className={styles.empty}>{t("search.header.empty")}</p>
          ) : (
            <ul className={styles.results}>
              {results.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`${styles.resultItem} ${index === activeIndex ? styles.resultItemActive : ""}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      setActiveIndex(index);
                      void (async () => {
                        try {
                          await launchItem(item);
                          setQuery("");
                          closeDropdown();
                        } catch (error) {
                          showLaunchError(error);
                        }
                      })();
                    }}
                  >
                    <span className={styles.resultName}>{item.name}</span>
                    <span className={styles.resultMeta}>
                      {item.category} · {item.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
});
