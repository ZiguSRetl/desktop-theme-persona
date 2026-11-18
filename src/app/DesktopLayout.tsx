import { useLocation, useMatch } from "react-router-dom";
import { Navigation } from "../components/Navigation";
import { ComicToast, HalftoneBackground, pathnameToSection, SectionTransition } from "../components/comic";
import { ShellFooter, ShellHeader } from "../components/shell";
import { useDesktopInit } from "../features/launcher/useDesktopInit";
import { UpdateAvailableDialog } from "../features/updater/UpdateAvailableDialog";
import { useUpdateCheckOnStartup } from "../features/updater/useUpdateCheckOnStartup";
import { useAnimationProfile } from "../features/settings/useAnimationProfile";
import { useCrossWindowStateSync } from "../hooks/useCrossWindowStateSync";
import { useEscapeToHide } from "../hooks/useEscapeToHide";
import { useWindowPlacement } from "../hooks/useWindowPlacement";
import { useTrayNavigation } from "../hooks/useTrayNavigation";
import { HomePage } from "../pages/HomePage";

export function DesktopLayout() {
  const location = useLocation();
  const applicationsOpen = useMatch("/apps") !== null;
  const isDesktop = location.pathname === "/" || applicationsOpen;
  const section = isDesktop ? "home" : pathnameToSection(location.pathname);
  const animationProfile = useAnimationProfile();
  useDesktopInit();
  useUpdateCheckOnStartup();
  useCrossWindowStateSync();
  useEscapeToHide();
  useWindowPlacement();
  useTrayNavigation();

  return (
    <div className="desktop-shell" data-animation-intensity={animationProfile} data-section={section}>
      <HalftoneBackground section={section} />
      <Navigation />
      <ComicToast />
      <UpdateAvailableDialog />

      <main className="desktop-shell__main">
        {isDesktop ? null : <ShellHeader />}
        <div className="desktop-shell__content">
          <SectionTransition desktopContent={isDesktop ? <HomePage /> : undefined} />
        </div>
        {isDesktop ? null : <ShellFooter />}
      </main>
    </div>
  );
}
