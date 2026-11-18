import { createBrowserRouter, Navigate, replace } from "react-router-dom";
import { DesktopLayout } from "./DesktopLayout";
import { SettingsPage } from "../pages/SettingsPage";
import { ScriptsPage } from "../pages/ScriptsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <DesktopLayout />,
    children: [
      { index: true, element: null },
      { path: "apps", element: null },
      ...["apps/catalog", "apps/shortcuts", "system/shortcuts"].map((path) => ({
        path,
        loader: ({ request }: { request: Request }) => replace(`/apps${new URL(request.url).search}`),
      })),
      { path: "games", element: <Navigate to="/apps?filter=games" replace /> },
      { path: "system", element: null },
      { path: "scripts", element: null },
      { path: "scripts/details", element: <ScriptsPage /> },
      { path: "settings", element: null },
      { path: "settings/details", element: <SettingsPage /> },
    ],
  },
]);
