import { useCallback, useEffect, useId, useRef } from "react";
import { NavLink, useLocation, useMatch, useNavigate } from "react-router-dom";
import { Home, LayoutGrid, MonitorCog, Settings, Terminal } from "lucide-react";
import { playUiSound, primeAudioContext } from "../../features/audio/soundService";
import { ApplicationsWidget } from "../../features/launcher/ApplicationsWidget";
import { useSettingsMenuStore } from "../../features/settings/settingsMenuStore";
import { useAnimationProfile } from "../../features/settings/useAnimationProfile";
import { useT } from "../../i18n";
import styles from "./Navigation.module.css";

const navItems = [
  { to: "/", label: "nav.items.home", icon: Home },
  { to: "/apps", label: "nav.items.apps", icon: LayoutGrid },
  { to: "/system", label: "nav.items.system", icon: MonitorCog },
  { to: "/scripts", label: "nav.items.scripts", icon: Terminal },
  { to: "/settings", label: "nav.items.settings", icon: Settings },
] as const;

export function Navigation() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const t = useT();
  const animationProfile = useAnimationProfile();
  const goBackToRoot = useSettingsMenuStore((state) => state.goBackToRoot);
  const activeCategory = useSettingsMenuStore((state) => state.activeCategory);
  const applicationsButton = useRef<HTMLButtonElement>(null);
  const widgetId = useId();
  const applicationsOpen = useMatch("/apps") !== null;

  const closeApplications = useCallback(() => {
    void navigate("/", { replace: true });
    applicationsButton.current?.focus();
  }, [navigate]);

  useEffect(() => {
    if (!applicationsOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      closeApplications();
    };

    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [applicationsOpen, closeApplications]);

  const itemClass = (active: boolean) => `${styles.link}${active ? ` ${styles.active}` : ""}`;

  const handleHover = () => {
    primeAudioContext();
    playUiSound("hover");
  };

  return (
    <nav className={styles.nav} aria-label={t("nav.ariaLabel")}>
      <ul className={styles.list}>
        {navItems.map(({ to, label, icon: Icon }) => (
          <li key={to} className={styles.item}>
            {to === "/apps" ? (
              <>
                <button
                  ref={applicationsButton}
                  type="button"
                  className={itemClass(pathname.startsWith("/apps"))}
                  aria-expanded={applicationsOpen}
                  aria-controls={applicationsOpen ? widgetId : undefined}
                  title={t(label)}
                  onMouseEnter={handleHover}
                  onClick={() => {
                    if (applicationsOpen) closeApplications();
                    else void navigate("/apps");
                  }}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{t(label)}</span>
                </button>
                {applicationsOpen ? (
                  <ApplicationsWidget
                    id={widgetId}
                    reducedMotion={animationProfile === "reduced"}
                    onLaunch={closeApplications}
                  />
                ) : null}
              </>
            ) : (
              <NavLink
                to={to}
                end={to === "/"}
                className={({ isActive }) => itemClass(isActive)}
                title={t(label)}
                onMouseEnter={handleHover}
                onClick={() => {
                  if (to === "/settings" && pathname === "/settings" && activeCategory !== null) {
                    goBackToRoot();
                  }
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{t(label)}</span>
              </NavLink>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
