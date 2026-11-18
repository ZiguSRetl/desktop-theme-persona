import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSettingsStore } from "../../../features/settings/settingsStore";
import { loadWallpaperDataUrl } from "../../../features/settings/wallpaperService";
import { HalftoneBackground } from "./HalftoneBackground";

vi.mock("../../../features/settings/wallpaperService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../features/settings/wallpaperService")>()),
  loadWallpaperDataUrl: vi.fn(),
}));

const original = useSettingsStore.getState().settings;
const wallpaper = {
  path: "wallpaper.png",
  crop: { x: 0.25, y: 0, width: 0.5, height: 1 },
};

afterEach(() => {
  cleanup();
  useSettingsStore.setState({ settings: original });
  vi.resetAllMocks();
});

it("uses the current crop and reloads a replacement saved to the same path", async () => {
  vi.mocked(loadWallpaperDataUrl)
    .mockResolvedValueOnce("https://example.test/old.png")
    .mockResolvedValueOnce("https://example.test/new.png");
  useSettingsStore.setState({ settings: { ...original, wallpaper } });
  const { container } = render(<HalftoneBackground />);
  const image = () => container.querySelector<HTMLElement>("[style]");

  await waitFor(() => expect(image()).toHaveStyle({
    backgroundImage: 'url("https://example.test/old.png")',
    backgroundSize: "200% 100%",
    backgroundPosition: "50% 0%",
  }));

  act(() => {
    useSettingsStore.setState({
      settings: { ...original, wallpaper: { ...wallpaper, crop: { ...wallpaper.crop, x: 0 } } },
    });
  });
  await waitFor(() => expect(image()).toHaveStyle({
    backgroundImage: 'url("https://example.test/new.png")',
    backgroundPosition: "0% 0%",
  }));
});

it("keeps the native desktop visible with wallpaper passthrough", () => {
  useSettingsStore.setState({
    settings: { ...original, desktopMode: true, wallpaperPassthrough: true, wallpaper },
  });
  const { container } = render(<HalftoneBackground />);
  const background = container.querySelector("[data-passthrough]");

  expect(background).toBeEmptyDOMElement();
  expect(loadWallpaperDataUrl).not.toHaveBeenCalled();
});
