import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useT } from "../../../i18n";
import { searchInstalledApps, type InstalledAppResult } from "../../../features/launcher/appSearchService";
import { fetchFileIcon } from "../../../features/launcher/iconService";
import styles from "./AppSearchPicker.module.css";

const SEARCH_DEBOUNCE_MS = 700;
const MIN_QUERY_LENGTH = 2;

export interface AppSearchSelection {
  name: string;
  path: string;
  icon?: string;
}

interface AppSearchPickerProps {
  value: AppSearchSelection | null;
  onChange: (selection: AppSearchSelection) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export function AppSearchPicker({
  value,
  onChange,
  placeholder,
  autoFocus = false,
}: AppSearchPickerProps) {
  const t = useT();
  const resolvedPlaceholder = placeholder ?? t("search.appPicker.placeholder");
  const [query, setQuery] = useState(() => value?.name ?? "");
  const [results, setResults] = useState<InstalledAppResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const trimmedDebounced = debouncedQuery.trim();
  const canSearch = trimmedDebounced.length >= MIN_QUERY_LENGTH;

  const selectResult = useCallback(
    async (result: InstalledAppResult) => {
      const icon = await fetchFileIcon(result.path);
      onChange({
        name: result.name,
        path: result.path,
        icon,
      });
      setQuery(result.name);
      setOpen(false);
      setActiveIndex(0);
    },
    [onChange],
  );

  useEffect(() => {
    if (!open || !canSearch) return;

    let cancelled = false;

    void (async () => {
      setLoading(true);
      const nextResults = await searchInstalledApps(trimmedDebounced, 12);
      if (cancelled) return;
      setResults(nextResults);
      setActiveIndex(0);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [canSearch, trimmedDebounced, open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const visibleResults = canSearch ? results : [];
  const visibleLoading = canSearch && loading;
  const showDropdown = open;

  let emptyMessage = t("search.appPicker.minChars");
  if (canSearch) {
    emptyMessage = t("search.appPicker.empty");
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.searchRow}>
        <Search className={styles.searchIcon} size={18} aria-hidden="true" />
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          autoFocus={autoFocus}
          placeholder={resolvedPlaceholder}
          aria-label={t("search.appPicker.ariaLabel")}
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (!showDropdown) return;

            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) =>
                Math.min(current + 1, Math.max(visibleResults.length - 1, 0)),
              );
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => Math.max(current - 1, 0));
              return;
            }

            if (event.key === "Enter") {
              event.preventDefault();
              const result = visibleResults[activeIndex];
              if (result) void selectResult(result);
              return;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
            }
          }}
        />
      </div>

      {value?.path ? (
        <p className={styles.selectedPath} title={value.path}>
          {value.path}
        </p>
      ) : null}

      {showDropdown ? (
        <div className={styles.dropdown} role="listbox" aria-label={t("search.appPicker.resultsAria")}>
          {visibleLoading ? <p className={styles.empty}>{t("search.appPicker.loading")}</p> : null}
          {!visibleLoading && visibleResults.length === 0 ? (
            <p className={styles.empty}>{emptyMessage}</p>
          ) : null}
          {!visibleLoading && visibleResults.length > 0 ? (
            <ul className={styles.results}>
              {visibleResults.map((result, index) => (
                <li key={result.path}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`${styles.resultItem} ${index === activeIndex ? styles.resultItemActive : ""}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => void selectResult(result)}
                  >
                    <span className={styles.resultText}>
                      <span className={styles.resultName}>{result.name}</span>
                      <span className={styles.resultMeta}>{result.source}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
