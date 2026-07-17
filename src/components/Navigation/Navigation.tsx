import { NavLink } from "react-router-dom";
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
import { useEffectiveReducedMotion } from "../../features/settings/useAnimationProfile";
import styles from "./Navigation.module.css";

const navItems = [
  { to: "/", label: "Inicio", icon: Home, end: true },
  { to: "/apps", label: "Aplicaciones", icon: LayoutGrid, end: false },
  { to: "/games", label: "Juegos", icon: Gamepad2, end: false },
  { to: "/system", label: "Sistema", icon: MonitorCog, end: false },
  { to: "/scripts", label: "Scripts", icon: Terminal, end: false },
  { to: "/settings", label: "Ajustes", icon: Settings, end: false },
] as const;

export function Navigation() {
  const reduceMotion = useEffectiveReducedMotion();

  return (
    <nav className={styles.nav} aria-label="Navegación principal">
      <div className={styles.brand}>
        <Crown className={styles.brandMark} size={28} aria-hidden="true" />
        <div className={styles.brandText}>
          <span className={styles.brandEyebrow}>Launcher</span>
          <span className={styles.brandTitle}>P5 Explorer</span>
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
        {navItems.map(({ to, label, icon: Icon, end }, index) => (
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
              <span className={styles.label}>{label}</span>
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
