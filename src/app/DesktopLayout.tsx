import { useLocation } from "react-router-dom";
import { Navigation } from "../components/Navigation";
import { desktopWidget } from "../components/Navigation/widgetRoutes";
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
  const widget = desktopWidget(location.pathname);
  const isDesktop = location.pathname === "/" || widget !== null;
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
      <HalftoneBackground />
      <Navigation />
      <ComicToast />
      <UpdateAvailableDialog />

      <main className="desktop-shell__main">
        {isDesktop ? null : <ShellHeader />}
        <div className="desktop-shell__content">
          <SectionTransition desktopContent={isDesktop ? <HomePage /> : undefined} />
        </div>
        <ShellFooter desktop={isDesktop} expanded={widget === "system"} />
      </main>
    </div>
  );
}
