import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { launchItem } from "../../features/launcher/launchItem";
import { useLauncherStore } from "../../features/launcher/launcherStore";
import { searchLauncherItems } from "../../features/launcher/searchSelectors";
import { showLaunchError } from "../../features/launcher/toastStore";
import { useEffectiveReducedMotion } from "../../features/settings/useAnimationProfile";
import { useT } from "../../i18n";
import { ComicPanel } from "../comic/ComicPanel";
import styles from "./CommandSearch.module.css";

export function CommandSearch() {
  const t = useT();
  const items = useLauncherStore((state) => state.items);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useEffectiveReducedMotion();

  const results = useMemo(() => searchLauncherItems(items, query), [items, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const launchActive = useCallback(async () => {
    const item = results[activeIndex];
    if (!item) return;

    try {
      await launchItem(item);
      close();
    } catch (error) {
      showLaunchError(error);
    }
  }, [activeIndex, close, results]);

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
        setOpen(true);
        return;
      }

      if (event.key === "/" && !isTypingField && !open) {
        event.preventDefault();
        setOpen(true);
        return;
      }

      if (!open) return;

      if (event.key === "Escape") {
        event.preventDefault();
        close();
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

      if (event.key === "Enter") {
        event.preventDefault();
        void launchActive();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, launchActive, open, results.length]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.commandSearchBackdrop} role="presentation" onClick={close}>
      <motion.div
        className={styles.commandSearchPanel}
        role="dialog"
        aria-modal="true"
        aria-label={t("search.command.ariaLabel")}
        initial={reduceMotion ? false : { scale: 0.95, opacity: 0, y: -12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        onClick={(event) => event.stopPropagation()}
      >
        <ComicPanel variant="white" shadowColor="red" rotation={-1}>
          <div className={styles.form}>
            <h2 className={styles.title}>{t("search.command.title")}</h2>
            <input
              ref={inputRef}
              className={styles.input}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              placeholder={t("search.command.placeholder")}
              aria-label={t("search.command.ariaLabel")}
              autoComplete="off"
            />
            <p className={styles.hint}>{t("search.command.hint")}</p>

            {results.length === 0 ? (
              <p className={styles.empty}>{t("search.command.empty")}</p>
            ) : (
              <ul className={styles.results} role="listbox">
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
                            close();
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
        </ComicPanel>
      </motion.div>
    </div>
  );
}
