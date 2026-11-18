import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSettingsStore } from "../../../features/settings/settingsStore";
import { ComicClock } from "./ComicClock";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("shows desktop seconds and syncs to the next second after becoming visible", () => {
  const start = new Date(2026, 10, 18, 13, 24, 59, 750);
  vi.useFakeTimers();
  vi.setSystemTime(start);
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  useSettingsStore.setState((state) => ({
    settings: { ...state.settings, language: "es", animationIntensity: "reduced" },
  }));
  render(<ComicClock desktop />);

  const clock = screen.getByRole("region", { name: /reloj/i });
  expect(clock).toHaveAttribute("data-reduced-motion", "true");
  const time = clock.querySelector("time");
  expect(time).toHaveAccessibleName("13:24:59");
  expect(time).toHaveTextContent("13:24:59");

  act(() => vi.advanceTimersByTime(250));
  expect(time).toHaveTextContent("13:25:00");

  hidden.mockReturnValue(true);
  document.dispatchEvent(new Event("visibilitychange"));
  act(() => vi.advanceTimersByTime(5250));
  expect(time).toHaveTextContent("13:25:00");

  hidden.mockReturnValue(false);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(time).toHaveTextContent("13:25:05");
  act(() => vi.advanceTimersByTime(750));
  expect(time).toHaveTextContent("13:25:06");
});
