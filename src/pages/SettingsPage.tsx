import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { BackgroundCropEditor } from "../components/settings/BackgroundCropEditor";
import { ComicSettingRow } from "../components/comic/ComicSettingRow";
import { SectionBadge } from "../features/launcher/SectionBadge";
import { CutoutButton } from "../components/comic/CutoutButton";
import { exportConfig, importConfig } from "../features/launcher/configTransfer";
import { showLaunchError, showSuccess } from "../features/launcher/toastStore";
import {
  exitAppCompletely,
  isValidGlobalShortcut,
} from "../features/settings/nativeSettings";
import { useSettingsStore } from "../features/settings/settingsStore";
import {
  deleteStoredWallpaper,
  isWallpaperConfigured,
  loadWallpaperDataUrl,
  pickWallpaperImagePath,
  storeWallpaperImage,
} from "../features/settings/wallpaperService";
import { wallpaperCropToBackgroundStyle } from "../features/settings/wallpaperUtils";
import { useGpuDevices } from "../features/system/useGpuDevices";
import { APP_LANGUAGES, useT } from "../i18n";
import settingStyles from "../components/comic/ComicSettingRow/ComicSettingRow.module.css";
import type { DesktopSettings, WallpaperCrop } from "../types/desktop";
import styles from "./SettingsPage.module.css";

function SettingToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`${settingStyles.toggle} ${checked ? settingStyles.toggleOn : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className={settingStyles.toggleThumb} aria-hidden="true" />
    </button>
  );
}

export function SettingsPage() {
  const t = useT();
  const settings = useSettingsStore((state) => state.settings);
  const updateSetting = useSettingsStore((state) => state.updateSetting);
  const resetToDefaults = useSettingsStore((state) => state.resetToDefaults);
  const { devices: gpuDevices, status: gpuListStatus } = useGpuDevices();
  const [cropEditorOpen, setCropEditorOpen] = useState(false);
  const [cropEditorSrc, setCropEditorSrc] = useState("");
  const [cropEditorImagePath, setCropEditorImagePath] = useState("");
  const [cropEditorIsNew, setCropEditorIsNew] = useState(false);
  const [cropEditorInitialCrop, setCropEditorInitialCrop] = useState<WallpaperCrop | undefined>();
  const [wallpaperPreviewUrl, setWallpaperPreviewUrl] = useState("");

  useEffect(() => {
    if (!isWallpaperConfigured(settings.wallpaper)) {
      queueMicrotask(() => setWallpaperPreviewUrl(""));
      return;
    }

    const path = settings.wallpaper.path;
    let cancelled = false;

    void loadWallpaperDataUrl(path)
      .then((url) => {
        if (!cancelled) setWallpaperPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setWallpaperPreviewUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [settings.wallpaper]);

  const wallpaperPreviewStyle = useMemo(() => {
    if (!wallpaperPreviewUrl || !isWallpaperConfigured(settings.wallpaper)) return undefined;
    return wallpaperCropToBackgroundStyle(wallpaperPreviewUrl, settings.wallpaper.crop);
  }, [settings.wallpaper, wallpaperPreviewUrl]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen<boolean>("desktop-mode-changed", (event) => {
      void updateSetting("desktopMode", event.payload);
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [updateSetting]);

  const handleUpdate = async <K extends keyof DesktopSettings>(
    key: K,
    value: DesktopSettings[K],
    message: string,
  ) => {
    await updateSetting(key, value);
    showSuccess(message);
  };

  const handleShortcutChange = async (value: string) => {
    if (!isValidGlobalShortcut(value)) {
      showLaunchError(new Error(t("settings.toasts.shortcutInvalid")));
      return;
    }

    await handleUpdate("globalShortcut", value, t("settings.toasts.shortcutUpdated"));
  };

  const handleExport = async () => {
    try {
      const path = await exportConfig();
      if (path) showSuccess(t("settings.toasts.exported"));
    } catch (error) {
      showLaunchError(error);
    }
  };

  const handleImport = async () => {
    const confirmed = window.confirm(t("settings.confirm.import"));
    if (!confirmed) return;

    try {
      const imported = await importConfig();
      if (imported) showSuccess(t("settings.toasts.imported"));
    } catch (error) {
      showLaunchError(error);
    }
  };

  const openCropEditor = async (
    imagePath: string,
    options?: { initialCrop?: WallpaperCrop; isNew?: boolean },
  ) => {
    const dataUrl = await loadWallpaperDataUrl(imagePath);
    setCropEditorImagePath(imagePath);
    setCropEditorSrc(dataUrl);
    setCropEditorInitialCrop(options?.initialCrop);
    setCropEditorIsNew(options?.isNew ?? false);
    setCropEditorOpen(true);
  };

  const handlePickWallpaper = async () => {
    try {
      const sourcePath = await pickWallpaperImagePath();
      if (!sourcePath) return;

      await openCropEditor(sourcePath, { isNew: true });
    } catch (error) {
      showLaunchError(error);
    }
  };

  const handleRecropWallpaper = () => {
    if (!isWallpaperConfigured(settings.wallpaper)) return;
    void openCropEditor(settings.wallpaper.path, {
      initialCrop: settings.wallpaper.crop,
      isNew: false,
    }).catch((error) => showLaunchError(error));
  };

  const handleCropConfirm = async (crop: WallpaperCrop) => {
    if (!cropEditorImagePath) return;

    try {
      const storedPath = cropEditorIsNew
        ? await storeWallpaperImage(cropEditorImagePath)
        : cropEditorImagePath;

      await handleUpdate(
        "wallpaper",
        { path: storedPath, crop },
        t("settings.toasts.wallpaperApplied"),
      );
      setCropEditorOpen(false);
    } catch (error) {
      showLaunchError(error);
    }
  };

  const handleRemoveWallpaper = async () => {
    try {
      await deleteStoredWallpaper();
      await handleUpdate("wallpaper", undefined, t("settings.toasts.wallpaperRemoved"));
    } catch (error) {
      showLaunchError(error);
    }
  };

  return (
    <div className="page-layout settings-page">
      <SectionBadge label={t("sections.badges.settings")} />

      <div className="settings-panel" role="list">
          <ComicSettingRow
            label={t("settings.language.label")}
            description={t("settings.language.description")}
            rotation={-1}
          >
            <select
              value={settings.language}
              onChange={(event) =>
                void handleUpdate(
                  "language",
                  event.target.value as DesktopSettings["language"],
                  t("settings.language.updated"),
                )
              }
            >
              {APP_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {t(
                    (
                      {
                        es: "settings.language.options.es",
                        en: "settings.language.options.en",
                        de: "settings.language.options.de",
                        fr: "settings.language.options.fr",
                        ja: "settings.language.options.ja",
                      } as const
                    )[lang],
                  )}
                </option>
              ))}
            </select>
          </ComicSettingRow>

          <ComicSettingRow
            label={t("settings.windowMode.label")}
            description={t("settings.windowMode.description")}
            rotation={-1}
          >
            <select
              value={settings.windowMode}
              onChange={(event) =>
                void handleUpdate(
                  "windowMode",
                  event.target.value as DesktopSettings["windowMode"],
                  t("settings.toasts.windowModeUpdated"),
                )
              }
            >
              <option value="window">{t("settings.windowMode.options.window")}</option>
              <option value="maximized">{t("settings.windowMode.options.maximized")}</option>
              <option value="fullscreen">{t("settings.windowMode.options.fullscreen")}</option>
            </select>
          </ComicSettingRow>

          <ComicSettingRow
            label={t("settings.animationIntensity.label")}
            description={t("settings.animationIntensity.description")}
            rotation={-1}
          >
            <select
              value={settings.animationIntensity}
              onChange={(event) =>
                void handleUpdate(
                  "animationIntensity",
                  event.target.value as DesktopSettings["animationIntensity"],
                  t("settings.toasts.animationUpdated"),
                )
              }
            >
              <option value="reduced">{t("settings.animationIntensity.options.reduced")}</option>
              <option value="normal">{t("settings.animationIntensity.options.normal")}</option>
              <option value="high">{t("settings.animationIntensity.options.high")}</option>
            </select>
          </ComicSettingRow>

          <ComicSettingRow
            label={t("settings.wallpaper.label")}
            description={t("settings.wallpaper.description")}
            rotation={0.5}
          >
            <div className={styles.wallpaperControls}>
              {wallpaperPreviewStyle ? (
                <div
                  className={styles.wallpaperPreview}
                  style={wallpaperPreviewStyle}
                  aria-hidden="true"
                />
              ) : null}
              <div className="settings-actions settings-actions--inline">
                <CutoutButton variant="default" rotation={-1} onClick={() => void handlePickWallpaper()}>
                  {t("settings.wallpaper.pick")}
                </CutoutButton>
                {isWallpaperConfigured(settings.wallpaper) ? (
                  <>
                    <CutoutButton variant="default" rotation={0.5} onClick={handleRecropWallpaper}>
                      {t("settings.wallpaper.recrop")}
                    </CutoutButton>
                    <CutoutButton variant="default" rotation={1} onClick={() => void handleRemoveWallpaper()}>
                      {t("settings.wallpaper.remove")}
                    </CutoutButton>
                  </>
                ) : null}
              </div>
            </div>
          </ComicSettingRow>

          <ComicSettingRow
            label={t("settings.sound.label")}
            description={t("settings.sound.description")}
            rotation={0.5}
          >
            <SettingToggle
              label={t("settings.sound.label")}
              checked={settings.soundEnabled}
              onChange={(value) =>
                void handleUpdate(
                  "soundEnabled",
                  value,
                  value ? t("settings.toasts.soundOn") : t("settings.toasts.soundOff"),
                )
              }
            />
          </ComicSettingRow>

          <ComicSettingRow
            label={t("settings.gpu.label")}
            description={t("settings.gpu.description")}
            rotation={-0.5}
          >
            <select
              value={settings.selectedGpuId ?? ""}
              disabled={gpuListStatus === "loading"}
              onChange={(event) => {
                const next = event.target.value.trim();
                void handleUpdate(
                  "selectedGpuId",
                  next ? next : undefined,
                  next ? t("settings.toasts.gpuUpdated") : t("settings.toasts.gpuAutomatic"),
                );
              }}
              aria-label={t("settings.gpu.ariaLabel")}
            >
              <option value="">{t("settings.gpu.automatic")}</option>
              {settings.selectedGpuId &&
              !gpuDevices.some((gpu) => gpu.id === settings.selectedGpuId) ? (
                <option value={settings.selectedGpuId}>{t("settings.gpu.savedUnavailable")}</option>
              ) : null}
              {gpuDevices.map((gpu) => (
                <option key={gpu.id} value={gpu.id}>
                  {gpu.name}
                  {gpu.supportsMetrics ? "" : t("settings.gpu.noSensorsSuffix")}
                </option>
              ))}
            </select>
          </ComicSettingRow>

          <ComicSettingRow
            label={t("settings.globalShortcut.label")}
            description={t("settings.globalShortcut.description")}
            rotation={-0.5}
          >
            <input
              type="text"
              value={settings.globalShortcut}
              onChange={(event) => void handleShortcutChange(event.target.value)}
              aria-label={t("settings.globalShortcut.ariaLabel")}
              placeholder={t("settings.globalShortcut.placeholder")}
            />
          </ComicSettingRow>

          <ComicSettingRow
            label={t("settings.desktopMode.label")}
            description={t("settings.desktopMode.description")}
            rotation={-0.5}
          >
            <SettingToggle
              label={t("settings.desktopMode.label")}
              checked={settings.desktopMode}
              onChange={(value) =>
                void handleUpdate(
                  "desktopMode",
                  value,
                  value
                    ? t("settings.toasts.desktopModeOn")
                    : t("settings.toasts.desktopModeOff"),
                )
              }
            />
          </ComicSettingRow>

          <ComicSettingRow
            label={t("settings.multiMonitor.label")}
            description={t("settings.multiMonitor.description")}
            rotation={0.4}
          >
            <span className={settingStyles.hint}>{t("settings.multiMonitor.hint")}</span>
          </ComicSettingRow>

          <ComicSettingRow
            label={t("settings.emergency.label")}
            description={t("settings.emergency.description")}
            rotation={0.5}
          >
            <span className={settingStyles.hint}>{t("settings.emergency.hint")}</span>
          </ComicSettingRow>

          <ComicSettingRow
            label={t("settings.launchOnStartup.label")}
            description={t("settings.launchOnStartup.description")}
            rotation={1}
          >
            <SettingToggle
              label={t("settings.launchOnStartup.label")}
              checked={settings.launchOnStartup}
              onChange={(value) =>
                void handleUpdate(
                  "launchOnStartup",
                  value,
                  value ? t("settings.toasts.startupOn") : t("settings.toasts.startupOff"),
                )
              }
            />
          </ComicSettingRow>

          <ComicSettingRow
            label={t("settings.closeBehavior.label")}
            description={t("settings.closeBehavior.description")}
            rotation={-1}
          >
            <select
              value={settings.closeBehavior}
              onChange={(event) =>
                void handleUpdate(
                  "closeBehavior",
                  event.target.value as DesktopSettings["closeBehavior"],
                  t("settings.toasts.closeBehaviorUpdated"),
                )
              }
            >
              <option value="hide">{t("settings.closeBehavior.options.hide")}</option>
              <option value="exit">{t("settings.closeBehavior.options.exit")}</option>
            </select>
          </ComicSettingRow>

          <ComicSettingRow
            label={t("settings.tray.label")}
            description={t("settings.tray.description")}
            rotation={0.5}
          >
            <span className={settingStyles.hint}>{t("settings.tray.hint")}</span>
          </ComicSettingRow>

          <ComicSettingRow
            label={t("settings.backup.label")}
            description={t("settings.backup.description")}
            rotation={-0.5}
          >
            <div className="settings-actions settings-actions--inline">
              <CutoutButton variant="default" rotation={-1} onClick={() => void handleExport()}>
                {t("settings.backup.export")}
              </CutoutButton>
              <CutoutButton variant="default" rotation={1} onClick={() => void handleImport()}>
                {t("settings.backup.import")}
              </CutoutButton>
            </div>
          </ComicSettingRow>

          <div className="settings-actions">
            <CutoutButton
              variant="default"
              rotation={-1}
              onClick={() => {
                void resetToDefaults().then(() =>
                  showSuccess(t("settings.toasts.defaultsRestored")),
                );
              }}
            >
              {t("settings.actions.resetDefaults")}
            </CutoutButton>
            <CutoutButton variant="default" rotation={1} onClick={() => void exitAppCompletely()}>
              {t("settings.actions.exitCompletely")}
            </CutoutButton>
          </div>
      </div>

      {cropEditorOpen ? (
        <BackgroundCropEditor
          key={cropEditorImagePath}
          open
          imageSrc={cropEditorSrc}
          initialCrop={cropEditorInitialCrop}
          onConfirm={(crop) => void handleCropConfirm(crop)}
          onCancel={() => setCropEditorOpen(false)}
        />
      ) : null}
    </div>
  );
}
