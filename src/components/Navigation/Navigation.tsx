import { useCallback, useEffect, useId, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, LayoutGrid, MonitorCog, Settings, Terminal } from "lucide-react";
import { playUiSound, primeAudioContext } from "../../features/audio/soundService";
import { ApplicationsWidget } from "../../features/launcher/ApplicationsWidget";
import { ScriptsWidget } from "../../features/scripts/ScriptsWidget";
import { SettingsWidget } from "../../features/settings/SettingsWidget";
import { useAnimationProfile } from "../../features/settings/useAnimationProfile";
import { useT } from "../../i18n";
import { SYSTEM_WIDGET_ID } from "../shell/ShellFooter/ShellFooter";
import { desktopWidget } from "./widgetRoutes";
import styles from "./Navigation.module.css";

const navItems = [
  { widget: "apps", label: "nav.items.apps", icon: LayoutGrid },
  { widget: "system", label: "nav.items.system", icon: MonitorCog },
  { widget: "scripts", label: "nav.items.scripts", icon: Terminal },
  { widget: "settings", label: "nav.items.settings", icon: Settings },
] as const;

const dropdowns = {
  apps: ApplicationsWidget,
  scripts: ScriptsWidget,
  settings: SettingsWidget,
};

function itemClass(active: boolean) {
  return `${styles.link}${active ? ` ${styles.active}` : ""}`;
}

function handleHover() {
  primeAudioContext();
  playUiSound("hover");
}

export function Navigation() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const t = useT();
  const reducedMotion = useAnimationProfile() === "reduced";
  const activeButton = useRef<HTMLButtonElement>(null);
  const dropdownId = useId();
  const activeWidget = desktopWidget(pathname);

  const closeWidget = useCallback(() => {
    activeButton.current?.focus();
    void navigate("/", { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!activeWidget) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing ||
          (event.target instanceof Element && event.target.closest("dialog[open]"))) return;
      event.preventDefault();
      event.stopPropagation();
      closeWidget();
    };

    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [activeWidget, closeWidget]);

  return (
    <nav className={styles.nav} aria-label={t("nav.ariaLabel")}>
      <ul className={styles.list}>
        <li className={styles.item}>
          <NavLink
            to="/"
            end
            className={({ isActive }) => itemClass(isActive)}
            title={t("nav.items.home")}
            onMouseEnter={handleHover}
          >
            <Home size={18} aria-hidden="true" />
            <span>{t("nav.items.home")}</span>
          </NavLink>
        </li>
        {navItems.map(({ widget, label, icon: Icon }) => {
          const path = `/${widget}`;
          const expanded = activeWidget === widget;
          const Dropdown = widget !== "system" ? dropdowns[widget] : null;
          return (
            <li key={widget} className={styles.item}>
              <button
                ref={expanded ? activeButton : undefined}
                type="button"
                className={itemClass(expanded || pathname.startsWith(`${path}/`))}
                aria-expanded={expanded}
                aria-controls={widget === "system" ? SYSTEM_WIDGET_ID : expanded ? dropdownId : undefined}
                title={t(label)}
                onMouseEnter={handleHover}
                onClick={() => {
                  if (expanded) closeWidget();
                  else void navigate(path);
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{t(label)}</span>
              </button>
              {expanded && Dropdown ? (
                <Dropdown id={dropdownId} reducedMotion={reducedMotion} onLaunch={closeWidget} />
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
