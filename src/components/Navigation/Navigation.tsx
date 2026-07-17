import { NavLink, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import {
  Crown,
  Gamepad2,
  Home,
  LayoutGrid,
  MonitorCog,
  Settings,
  Terminal,
} from "lucide-react";
import { staggerChildren } from "../../lib/motionPresets";
import { playUiSound, primeAudioContext } from "../../features/audio/soundService";
import { useSettingsMenuStore } from "../../features/settings/settingsMenuStore";
import { useEffectiveReducedMotion } from "../../features/settings/useAnimationProfile";
import { useT } from "../../i18n";
import styles from "./Navigation.module.css";

const navItems = [
  { to: "/", labelKey: "nav.items.home", icon: Home, end: true },
  { to: "/apps", labelKey: "nav.items.apps", icon: LayoutGrid, end: false },
  { to: "/games", labelKey: "nav.items.games", icon: Gamepad2, end: false },
  { to: "/system", labelKey: "nav.items.system", icon: MonitorCog, end: false },
  { to: "/scripts", labelKey: "nav.items.scripts", icon: Terminal, end: false },
  { to: "/settings", labelKey: "nav.items.settings", icon: Settings, end: false },
] as const;

export function Navigation() {
  const reduceMotion = useEffectiveReducedMotion();
  const location = useLocation();
  const t = useT();
  const goBackToRoot = useSettingsMenuStore((state) => state.goBackToRoot);
  const activeCategory = useSettingsMenuStore((state) => state.activeCategory);

  return (
    <nav className={styles.nav} aria-label={t("nav.ariaLabel")}>
      <div className={styles.brand}>
        <Crown className={styles.brandMark} size={28} aria-hidden="true" />
        <div className={styles.brandText}>
          <span className={styles.brandEyebrow}>{t("nav.brand.eyebrow")}</span>
          <span className={styles.brandTitle}>{t("nav.brand.title")}</span>
        </div>
      </div>

      <motion.ul
        className={styles.list}
        role="list"
        initial={false}
        animate="animate"
        variants={{
          animate: {
            transition: { staggerChildren: reduceMotion ? 0 : staggerChildren },
          },
        }}
      >
        {navItems.map(({ to, labelKey, icon: Icon, end }, index) => (
          <motion.li
            key={to}
            layout={!reduceMotion}
            className={styles.item}
            initial={reduceMotion ? false : { x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: index * 0.04 }}
          >
            <NavLink
              to={to}
              end={end}
              onMouseEnter={() => {
                primeAudioContext();
                playUiSound("hover");
              }}
              onClick={() => {
                if (
                  to === "/settings" &&
                  location.pathname === "/settings" &&
                  activeCategory !== null
                ) {
                  goBackToRoot();
                }
              }}
              className={({ isActive }) =>
                [
                  styles.link,
                  styles[`linkVariant${index}`],
                  isActive ? styles.linkActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <Icon className={styles.icon} aria-hidden="true" />
              <span className={styles.label}>{t(labelKey)}</span>
              <span className={styles.arrow} aria-hidden="true" />
            </NavLink>
          </motion.li>
        ))}
      </motion.ul>

      <div className={styles.footerDecor} aria-hidden="true">
        <Crown className={styles.footerCrown} size={64} strokeWidth={1.5} />
      </div>
    </nav>
  );
}
