import { createBrowserRouter } from "react-router-dom";
import { DesktopLayout } from "./DesktopLayout";
import { AppsPage } from "../pages/AppsPage";
import { GamesPage } from "../pages/GamesPage";
import { HomePage } from "../pages/HomePage";
import { SettingsPage } from "../pages/SettingsPage";
import { ScriptsPage } from "../pages/ScriptsPage";
import { SystemPage } from "../pages/SystemPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <DesktopLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "apps", element: <AppsPage /> },
      { path: "games", element: <GamesPage /> },
      { path: "system", element: <SystemPage /> },
      { path: "scripts", element: <ScriptsPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
