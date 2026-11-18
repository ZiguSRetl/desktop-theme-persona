import { createBrowserRouter, Navigate } from "react-router-dom";
import { DesktopLayout } from "./DesktopLayout";
import { AppsPage } from "../pages/AppsPage";
import { ShortcutsPage } from "../pages/ShortcutsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { ScriptsPage } from "../pages/ScriptsPage";
import { SystemPage } from "../pages/SystemPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <DesktopLayout />,
    children: [
      { index: true, element: null },
      { path: "apps", element: null },
      { path: "apps/catalog", element: <AppsPage /> },
      { path: "apps/shortcuts", element: <ShortcutsPage /> },
      { path: "games", element: <Navigate to="/apps?filter=games" replace /> },
      { path: "system", element: <SystemPage /> },
      { path: "scripts", element: <ScriptsPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
