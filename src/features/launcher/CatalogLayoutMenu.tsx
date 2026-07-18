import { useEffect, useId, useRef, useState } from "react";
import { Columns2, LayoutGrid, PanelLeft, Settings, StretchHorizontal } from "lucide-react";
import { useT } from "../../i18n";
import {
  type CatalogLayoutMode,
  useInstalledAppsStore,
} from "./installedAppsStore";
import styles from "./CatalogLayoutMenu.module.css";

const LAYOUT_OPTIONS: {
  mode: CatalogLayoutMode;
  Icon: typeof LayoutGrid;
  labelKey:
    | "installedApps.layout.grid"
    | "installedApps.layout.list"
    | "installedApps.layout.listSplit"
    | "installedApps.layout.listRail";
}[] = [
  { mode: "grid", Icon: LayoutGrid, labelKey: "installedApps.layout.grid" },
  { mode: "list", Icon: StretchHorizontal, labelKey: "installedApps.layout.list" },
  { mode: "listSplit", Icon: Columns2, labelKey: "installedApps.layout.listSplit" },
  { mode: "listRail", Icon: PanelLeft, labelKey: "installedApps.layout.listRail" },
];

export function CatalogLayoutMenu() {
  const t = useT();
  const layoutMode = useInstalledAppsStore((state) => state.layoutMode);
  const setLayoutMode = useInstalledAppsStore((state) => state.setLayoutMode);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={styles.wrap}>
      <button
        type="button"
        className={styles.gearBtn}
        aria-label={t("installedApps.layout.gearAria")}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <Settings size={18} aria-hidden="true" />
      </button>

      {open ? (
        <div id={menuId} className={styles.popover} role="menu" aria-label={t("installedApps.layout.menuAria")}>
          {LAYOUT_OPTIONS.map(({ mode, Icon, labelKey }) => {
            const active = layoutMode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                aria-label={t(labelKey)}
                title={t(labelKey)}
                className={`${styles.option} ${active ? styles.optionActive : ""}`}
                onClick={() => {
                  setLayoutMode(mode);
                  setOpen(false);
                }}
              >
                <Icon size={18} aria-hidden="true" strokeWidth={2.25} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
