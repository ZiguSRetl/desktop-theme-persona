import { useEffect, useRef, type ReactNode } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { playUiSound } from "../../../features/audio/soundService";
import { useAnimationProfile } from "../../../features/settings/useAnimationProfile";
import styles from "./SectionTransition.module.css";

export function SectionTransition({ desktopContent }: { desktopContent?: ReactNode }) {
  const location = useLocation();
  const outlet = useOutlet();
  const animationProfile = useAnimationProfile();
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      playUiSound("page");
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);

  return (
    <div className={styles.wrapper} data-animation-intensity={animationProfile}>
      <div key={desktopContent ? "/" : location.pathname} className={styles.page}>
        {desktopContent ?? outlet}
        {animationProfile !== "reduced" ? (
          <div className={styles.cut} aria-hidden="true" />
        ) : null}
      </div>
    </div>
  );
}
