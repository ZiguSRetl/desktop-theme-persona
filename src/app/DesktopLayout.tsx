import { useLocation } from "react-router-dom";
import { Navigation } from "../components/Navigation";
import { ComicToast, HalftoneBackground, pathnameToSection, SectionTransition } from "../components/comic";
import { ShellFooter, ShellHeader } from "../components/shell";
import { useDesktopInit } from "../features/launcher/useDesktopInit";
import { useAnimationProfile } from "../features/settings/useAnimationProfile";
import { useCrossWindowStateSync } from "../hooks/useCrossWindowStateSync";
import { useEscapeToHide } from "../hooks/useEscapeToHide";
import { useWindowPlacement } from "../hooks/useWindowPlacement";
import { useTrayNavigation } from "../hooks/useTrayNavigation";

export function DesktopLayout() {
  const location = useLocation();
  const section = pathnameToSection(location.pathname);
  const animationProfile = useAnimationProfile();
  useDesktopInit();
  useCrossWindowStateSync();
  useEscapeToHide();
  useWindowPlacement();
  useTrayNavigation();

  return (
    <div className="desktop-shell" data-animation-intensity={animationProfile} data-section={section}>
      <HalftoneBackground section={section} />
      <Navigation />
      <ComicToast />

      <main className="desktop-shell__main">
        <ShellHeader />
        <div className="desktop-shell__content">
          <SectionTransition />
        </div>
        <ShellFooter />
      </main>
    </div>
  );
}
