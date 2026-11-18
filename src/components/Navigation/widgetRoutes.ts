import { matchPath } from "react-router-dom";

export function desktopWidget(pathname: string) {
  const widget = matchPath("/:widget", pathname)?.params.widget?.toLowerCase();
  if (widget === "apps" || widget === "system" || widget === "scripts" || widget === "settings") {
    return widget;
  }
  return null;
}
