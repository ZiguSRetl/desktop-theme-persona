import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MOCK_SYSTEM_METRICS } from "../../../features/system/types";
import { useSettingsStore } from "../../../features/settings/settingsStore";
import { SystemMonitor } from "./SystemMonitor";

beforeEach(() => {
  useSettingsStore.setState((state) => ({
    settings: { ...state.settings, language: "es" },
  }));
});

afterEach(() => {
  cleanup();
});

describe("SystemMonitor", () => {
  it("renders ready metrics with accessible labels", () => {
    render(
      <SystemMonitor metrics={MOCK_SYSTEM_METRICS} status="ready" error={null} />,
    );

    expect(screen.getByLabelText("Monitor del sistema")).toBeInTheDocument();
    expect(screen.getByLabelText(/CPU:/)).toBeInTheDocument();
    expect(screen.getByLabelText(/CPU: 25% · 58 °C/)).toBeInTheDocument();
    expect(screen.getByLabelText(/RAM:/)).toBeInTheDocument();
    expect(screen.getByLabelText(/DISCO:/)).toBeInTheDocument();
    expect(screen.getByLabelText(/GPU:/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Red:/)).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar")).toHaveLength(3);
  });

  it("shows placeholders when unavailable", () => {
    render(<SystemMonitor metrics={null} status="unavailable" error={null} />);
    expect(screen.getAllByText("--").length).toBeGreaterThanOrEqual(3);
  });

  it("handles missing disk, network and gpu", () => {
    render(
      <SystemMonitor
        metrics={{
          ...MOCK_SYSTEM_METRICS,
          disk: null,
          network: null,
          gpu: null,
        }}
        status="ready"
      />,
    );

    expect(screen.getByLabelText(/DISCO: no disponible/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Red: no disponible/)).toBeInTheDocument();
    expect(screen.getByLabelText(/GPU: no disponible/)).toBeInTheDocument();
  });

  it("shows sin sensores when GPU has name but no metrics", () => {
    render(
      <SystemMonitor
        metrics={{
          ...MOCK_SYSTEM_METRICS,
          gpu: {
            id: "wmi:PCI\\VEN_8086",
            name: "Intel UHD Graphics",
            usagePercent: null,
            vramUsedBytes: null,
            vramTotalBytes: null,
            temperatureCelsius: null,
          },
        }}
        status="ready"
      />,
    );

    expect(screen.getByText("Sin sensores")).toBeInTheDocument();
    expect(screen.getByLabelText(/GPU: Intel UHD Graphics/)).toBeInTheDocument();
  });
});
