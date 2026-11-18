import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { useSettingsStore } from "../features/settings/settingsStore";
import { fetchSystemMetrics } from "../features/system/systemService";
import { MOCK_SYSTEM_METRICS, type SystemMetrics } from "../features/system/types";
import { DesktopLayout } from "./DesktopLayout";

vi.mock("../features/system/systemService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../features/system/systemService")>()),
  fetchSystemMetrics: vi.fn(),
}));

vi.mock("../features/launcher/useDesktopInit", () => ({ useDesktopInit: vi.fn() }));
vi.mock("../features/updater/useUpdateCheckOnStartup", () => ({ useUpdateCheckOnStartup: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

it("shares a polling request and the last sample between widget sizes", async () => {
  vi.useFakeTimers();
  useSettingsStore.setState((state) => ({ settings: { ...state.settings, language: "es" } }));
  let resolveFirst!: (metrics: SystemMetrics) => void;
  let rejectSecond!: (error: Error) => void;
  const first = new Promise<SystemMetrics>((resolve) => { resolveFirst = resolve; });
  const second = new Promise<SystemMetrics>((_, reject) => { rejectSecond = reject; });
  const fetchMetrics = vi.mocked(fetchSystemMetrics);
  fetchMetrics.mockReturnValueOnce(first).mockReturnValueOnce(second);
  const router = createMemoryRouter([
    {
      path: "/",
      element: <DesktopLayout />,
      children: [
        { index: true, element: null },
        { path: "system", element: null },
      ],
    },
  ]);
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );

  const toggle = screen.getByRole("button", { name: "Sistema" });
  const monitor = screen.getByRole("region", { name: "Monitor del sistema" });
  expect(within(monitor).getAllByText("—")).toHaveLength(5);
  await act(async () => {});
  expect(fetchMetrics).toHaveBeenCalledTimes(1);

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(within(monitor).getAllByText("—")).toHaveLength(5);
  fireEvent.click(toggle);
  expect(within(monitor).getAllByText("—")).toHaveLength(5);
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(fetchMetrics).toHaveBeenCalledTimes(1);

  await act(async () => resolveFirst({ ...MOCK_SYSTEM_METRICS, gpu: null }));
  expect(within(monitor).getByLabelText(/CPU: 25% · 58 °C/)).toBeInTheDocument();
  expect(within(monitor).getByLabelText(/DISCO: 62%/)).toBeInTheDocument();
  expect(within(monitor).getByLabelText(/GPU: no disponible/)).toBeInTheDocument();
  expect(within(monitor).getByLabelText(/Red: Descarga/)).toBeInTheDocument();
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(fetchMetrics).toHaveBeenCalledTimes(2);

  fireEvent.click(toggle);
  expect(within(monitor).getByLabelText(/CPU: 25%/)).toBeInTheDocument();
  expect(within(monitor).getByLabelText(/DISCO: 62%/)).toBeInTheDocument();
  expect(within(monitor).getByLabelText(/GPU: no disponible/)).toBeInTheDocument();
  expect(within(monitor).getByLabelText(/Red: Descarga/)).toBeInTheDocument();
  fireEvent.keyDown(document.activeElement ?? toggle, { key: "Escape" });
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(fetchMetrics).toHaveBeenCalledTimes(2);

  await act(async () => rejectSecond(new Error("Sensor timeout")));
  expect(within(monitor).getByLabelText(/CPU: 25% · 58 °C/)).toBeInTheDocument();
  expect(within(monitor).getByRole("status")).toBeInTheDocument();
});
