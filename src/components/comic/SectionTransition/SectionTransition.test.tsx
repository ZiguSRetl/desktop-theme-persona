import { fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { SectionTransition } from "./SectionTransition";

vi.mock("../../../features/audio/soundService", () => ({ playUiSound: vi.fn() }));

it("makes the destination interactive in the same update as navigation", () => {
  const launchFavorite = vi.fn();
  render(
    <MemoryRouter initialEntries={["/settings"]}>
      <Link to="/">Inicio</Link>
      <Routes>
        <Route element={<SectionTransition />}>
          <Route path="/settings" element={<h1>Ajustes</h1>} />
          <Route
            index
            element={<button onClick={launchFavorite}>Abrir favorito</button>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByRole("heading", { name: "Ajustes" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Inicio" }));
  fireEvent.click(screen.getByRole("button", { name: "Abrir favorito" }));

  expect(screen.queryByRole("heading", { name: "Ajustes" })).not.toBeInTheDocument();
  expect(launchFavorite).toHaveBeenCalledOnce();
});
