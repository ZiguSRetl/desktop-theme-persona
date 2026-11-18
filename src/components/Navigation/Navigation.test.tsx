import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useInstalledAppsStore } from "../../features/launcher/installedAppsStore";
import { launchItem } from "../../features/launcher/launchItem";
import { useLauncherStore } from "../../features/launcher/launcherStore";
import { useSettingsMenuStore } from "../../features/settings/settingsMenuStore";
import { useSettingsStore } from "../../features/settings/settingsStore";
import { makeLauncherItem } from "../../test/factories";
import { Navigation } from "./Navigation";

vi.mock("../../features/launcher/launchItem", () => ({ launchItem: vi.fn(async () => {}) }));

describe("Navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, language: "es" },
    }));
    useSettingsMenuStore.setState({ activeCategory: null, menuDirection: 1 });
    useLauncherStore.getState().hydrate([]);
    useInstalledAppsStore.setState({
      apps: [],
      status: "loading",
      error: null,
      ensureLoaded: vi.fn(async () => {}),
    });
  });

  it("renders primary links", () => {
    render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Inicio/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aplicaciones/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Scripts/i })).toBeInTheDocument();
    expect(within(screen.getByRole("navigation")).getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByRole("link", { name: /Juegos/i })).not.toBeInTheDocument();
  });

  it("focuses the search and launches a favorite while applications are loading", () => {
    const favorite = makeLauncherItem({ name: "Editor", favorite: true });
    useLauncherStore.getState().hydrate([favorite]);
    render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", { name: "Aplicaciones" });
    fireEvent.click(trigger);
    const search = screen.getByRole("combobox");
    expect(search).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando aplicaciones");
    fireEvent.keyDown(search, { key: "Enter" });
    expect(launchItem).toHaveBeenCalledWith(favorite);
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("moves selection with the arrow keys and closes on Escape", () => {
    useInstalledAppsStore.setState({
      apps: [
        { name: "Calculadora", path: "calculator.exe", source: "registry" },
        { name: "Terminal", path: "terminal.exe", source: "registry" },
      ],
      status: "ready",
    });
    render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", { name: "Aplicaciones" });
    fireEvent.click(trigger);
    const search = screen.getByRole("combobox");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "Terminal" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(search, { key: "ArrowUp" });
    expect(screen.getByRole("option", { name: "Calculadora" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(search, { key: "Escape" });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps saved games under the Games filter and searches their names", () => {
    useLauncherStore.getState().hydrate([
      makeLauncherItem({ id: "game-1", type: "game", category: "games", name: "Celeste" }),
      makeLauncherItem({ id: "game-2", type: "game", category: "games", name: "Portal" }),
      makeLauncherItem({ id: "app", type: "application", category: "apps", name: "Notepad" }),
    ]);
    render(
      <MemoryRouter initialEntries={["/apps"]}>
        <Navigation />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Juegos" }));
    expect(screen.queryByRole("option", { name: "Notepad" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Celeste" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "por" } });
    expect(screen.getByRole("option", { name: "Portal" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Celeste" })).not.toBeInTheDocument();
  });

  it("returns settings menu to root when Ajustes is clicked while nested", () => {
    useSettingsMenuStore.setState({ activeCategory: "display", menuDirection: 1 });

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Navigation />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: /Ajustes/i }));

    expect(useSettingsMenuStore.getState().activeCategory).toBeNull();
    expect(useSettingsMenuStore.getState().menuDirection).toBe(-1);
  });
});
