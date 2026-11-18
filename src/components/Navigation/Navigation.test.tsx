import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useInstalledAppsStore } from "../../features/launcher/installedAppsStore";
import { launchItem } from "../../features/launcher/launchItem";
import { useLauncherStore } from "../../features/launcher/launcherStore";
import { createInitialState, loadFullState, saveFullState } from "../../features/launcher/persistence";
import { useSettingsMenuStore } from "../../features/settings/settingsMenuStore";
import { useSettingsStore } from "../../features/settings/settingsStore";
import { makeLauncherItem } from "../../test/factories";
import { Navigation } from "./Navigation";

vi.mock("../../features/launcher/launchItem", () => ({ launchItem: vi.fn(async () => {}) }));

describe("Navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, language: "es", soundEnabled: true },
      status: "ready",
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
    expect(screen.getByRole("button", { name: /Scripts/i })).toBeInTheDocument();
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

  it("adds an installed app to favorites from the keyboard without launching it", async () => {
    useInstalledAppsStore.setState({
      apps: [{ name: "Terminal", path: "terminal.exe", source: "registry" }],
      status: "ready",
    });
    render(<MemoryRouter initialEntries={["/apps"]}><Navigation /></MemoryRouter>);

    const search = screen.getByRole("combobox");
    fireEvent.change(search, { target: { value: "registry" } });
    fireEvent.keyDown(search, { key: "F10", shiftKey: true });
    const favorite = screen.getByRole("button", { name: "Añadir a favoritos" });
    expect(favorite).toHaveFocus();
    fireEvent.click(favorite);
    await waitFor(() => expect(search).toHaveFocus());

    expect((await loadFullState())?.items).toMatchObject([{ target: "terminal.exe", favorite: true }]);
    expect(screen.getAllByRole("option", { name: "Terminal" })).toHaveLength(1);
    fireEvent.keyDown(search, { key: "F10", shiftKey: true });
    expect(screen.getByRole("button", { name: "Quitar de favoritos" })).toBeInTheDocument();
    expect(launchItem).not.toHaveBeenCalled();
  });

  it("launches a saved System shortcut and respects cancellation before removing it", async () => {
    const item = makeLauncherItem({ name: "Monitor de recursos", category: "system", arguments: ["-test"] });
    useLauncherStore.getState().hydrate([item]);
    render(<MemoryRouter initialEntries={["/apps"]}><Navigation /></MemoryRouter>);
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    try {
      const row = screen.getByRole("option", { name: item.name });
      fireEvent.contextMenu(row);
      const remove = screen.getByRole("button", { name: "Eliminar acceso" });
      fireEvent.click(remove);
      expect(useLauncherStore.getState().items).toEqual([item]);
      fireEvent.click(remove);
      await waitFor(() => expect(row).not.toBeInTheDocument());
      expect((await loadFullState())?.items).toEqual([]);

      act(() => useLauncherStore.getState().hydrate([item]));
      fireEvent.click(await screen.findByRole("option", { name: item.name }));
      expect(launchItem).toHaveBeenCalledWith(item);
    } finally {
      confirm.mockRestore();
    }
  });

  it("returns to the full settings menu from the quick controls", () => {
    useSettingsMenuStore.setState({ activeCategory: "display", menuDirection: 1 });

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Navigation />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Todos los ajustes" }));

    expect(useSettingsMenuStore.getState().activeCategory).toBeNull();
    expect(useSettingsMenuStore.getState().menuDirection).toBe(-1);
  });

  it.each(["Scripts", "Ajustes"])("opens only %s and restores focus on Escape", (name) => {
    render(
      <MemoryRouter initialEntries={["/apps"]}>
        <Navigation />
      </MemoryRouter>,
    );
    const button = screen.getByRole("button", { name });
    fireEvent.click(button);
    expect(screen.queryByRole("region", { name: "Aplicaciones" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name })).toBeInTheDocument();
    fireEvent.keyDown(button, { key: "Escape" });
    expect(screen.queryByRole("region", { name })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("saves quick settings alongside existing shortcuts and preferences", async () => {
    const saved = createInitialState(
      [makeLauncherItem({ name: "Acceso guardado" })],
      { ...useSettingsStore.getState().settings, animationIntensity: "high" },
    );
    await saveFullState(saved);
    useSettingsStore.getState().hydrate(saved.settings);
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Navigation />
      </MemoryRouter>,
    );

    const sound = screen.getByRole("checkbox", { name: "Sonidos de interfaz" });
    expect(sound).toBeChecked();
    fireEvent.click(sound);
    await waitFor(() => expect(sound).not.toBeChecked());
    expect(await loadFullState()).toMatchObject({
      items: saved.items,
      settings: { soundEnabled: false, animationIntensity: "high" },
    });
  });
});
