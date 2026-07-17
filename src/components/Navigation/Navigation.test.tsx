import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useSettingsMenuStore } from "../../features/settings/settingsMenuStore";
import { useSettingsStore } from "../../features/settings/settingsStore";
import { Navigation } from "./Navigation";

describe("Navigation", () => {
  beforeEach(() => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, language: "es" },
    }));
    useSettingsMenuStore.setState({ activeCategory: null, menuDirection: 1 });
  });

  it("renders primary links", () => {
    render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Inicio/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Aplicaciones/i })).toBeInTheDocument();
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
