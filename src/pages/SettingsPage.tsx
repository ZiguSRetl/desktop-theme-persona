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
      showLaunchError(
        new Error('Formato inválido. Usa Ctrl, Alt o Shift + tecla (ej. "Ctrl+Space").'),
      );
      return;
    }

    await handleUpdate("globalShortcut", value, "Atajo global actualizado.");
  };

  const handleExport = async () => {
    try {
      const path = await exportConfig();
      if (path) showSuccess("Configuración exportada.");
    } catch (error) {
      showLaunchError(error);
    }
  };

  const handleImport = async () => {
    const confirmed = window.confirm(
      "¿Importar configuración? Se reemplazarán accesos y ajustes actuales.",
    );
    if (!confirmed) return;

    try {
      const imported = await importConfig();
      if (imported) showSuccess("Configuración importada.");
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
        "Fondo personalizado aplicado.",
      );
      setCropEditorOpen(false);
    } catch (error) {
      showLaunchError(error);
    }
  };

  const handleRemoveWallpaper = async () => {
    try {
      await deleteStoredWallpaper();
      await handleUpdate("wallpaper", undefined, "Fondo personalizado eliminado.");
    } catch (error) {
      showLaunchError(error);
    }
  };

  return (
    <div className="page-layout settings-page">
      <SectionBadge label="Preferencias" />

      <div className="settings-panel" role="list">
          <ComicSettingRow
            label="Modo de ventana"
            description="Cómo se abre el launcher al mostrarse."
            rotation={-1}
          >
            <select
              value={settings.windowMode}
              onChange={(event) =>
                void handleUpdate(
                  "windowMode",
                  event.target.value as DesktopSettings["windowMode"],
                  "Modo de ventana actualizado.",
                )
              }
            >
              <option value="window">Ventana</option>
              <option value="maximized">Maximizada</option>
              <option value="fullscreen">Pantalla completa</option>
            </select>
          </ComicSettingRow>

          <ComicSettingRow
            label="Intensidad de animaciones"
            description="Controla la energía visual de transiciones y hover."
            rotation={-1}
          >
            <select
              value={settings.animationIntensity}
              onChange={(event) =>
                void handleUpdate(
                  "animationIntensity",
                  event.target.value as DesktopSettings["animationIntensity"],
                  "Intensidad de animaciones actualizada.",
                )
              }
            >
              <option value="reduced">Reducida</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
            </select>
          </ComicSettingRow>

          <ComicSettingRow
            label="Fondo personalizado"
            description="Elige una imagen y recorta la zona visible bajo el estilo cómic. Se aplica en todas las secciones."
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
                  Elegir imagen
                </CutoutButton>
                {isWallpaperConfigured(settings.wallpaper) ? (
                  <>
                    <CutoutButton variant="default" rotation={0.5} onClick={handleRecropWallpaper}>
                      Recortar
                    </CutoutButton>
                    <CutoutButton variant="default" rotation={1} onClick={() => void handleRemoveWallpaper()}>
                      Quitar
                    </CutoutButton>
                  </>
                ) : null}
              </div>
            </div>
          </ComicSettingRow>

          <ComicSettingRow
            label="Sonidos de interfaz"
            description="Efectos cortos al lanzar, navegar y confirmar acciones."
            rotation={0.5}
          >
            <SettingToggle
              label="Sonidos de interfaz"
              checked={settings.soundEnabled}
              onChange={(value) =>
                void handleUpdate(
                  "soundEnabled",
                  value,
                  value ? "Sonidos activados." : "Sonidos desactivados.",
                )
              }
            />
          </ComicSettingRow>

          <ComicSettingRow
            label="GPU del monitor"
            description="Elige qué GPU mostrar en el pie (uso, VRAM y temperatura). Automática prioriza la dedicada con sensores."
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
                  next ? "GPU del monitor actualizada." : "GPU del monitor en automático.",
                );
              }}
              aria-label="GPU del monitor"
            >
              <option value="">Automática</option>
              {settings.selectedGpuId &&
              !gpuDevices.some((gpu) => gpu.id === settings.selectedGpuId) ? (
                <option value={settings.selectedGpuId}>
                  GPU guardada (no disponible)
                </option>
              ) : null}
              {gpuDevices.map((gpu) => (
                <option key={gpu.id} value={gpu.id}>
                  {gpu.name}
                  {gpu.supportsMetrics ? "" : " (sin sensores)"}
                </option>
              ))}
            </select>
          </ComicSettingRow>

          <ComicSettingRow
            label="Atajo global"
            description="Muestra u oculta el launcher desde cualquier aplicación (p. ej. Ctrl+Space)."
            rotation={-0.5}
          >
            <input
              type="text"
              value={settings.globalShortcut}
              onChange={(event) => void handleShortcutChange(event.target.value)}
              aria-label="Atajo global"
              placeholder="Ctrl+Space"
            />
          </ComicSettingRow>

          <ComicSettingRow
            label="Usar como escritorio (Win+D)"
            description="Pantalla completa detrás de tus ventanas abiertas en todos los monitores. Oculta iconos del escritorio y activa el inicio con Windows."
            rotation={-0.5}
          >
            <SettingToggle
              label="Usar como escritorio (Win+D)"
              checked={settings.desktopMode}
              onChange={(value) =>
                void handleUpdate(
                  "desktopMode",
                  value,
                  value
                    ? "Modo escritorio activado. Pulsa Win+D para ver el launcher."
                    : "Modo escritorio desactivado.",
                )
              }
            />
          </ComicSettingRow>

          <ComicSettingRow
            label="Varios monitores"
            description="El launcher se abre en cada monitor detectado. El estado (accesos y ajustes) se sincroniza entre ventanas."
            rotation={0.4}
          >
            <span className={settingStyles.hint}>Activo automáticamente</span>
          </ComicSettingRow>

          <ComicSettingRow
            label="Recuperación de emergencia"
            description="Si algo falla: bandeja → Restaurar escritorio de Windows, o Ctrl+Shift+Esc para el Administrador de tareas."
            rotation={0.5}
          >
            <span className={settingStyles.hint}>Siempre disponible</span>
          </ComicSettingRow>

          <ComicSettingRow
            label="Iniciar con Windows"
            description="Abre Persona5 Explorer automáticamente al iniciar sesión."
            rotation={1}
          >
            <SettingToggle
              label="Iniciar con Windows"
              checked={settings.launchOnStartup}
              onChange={(value) =>
                void handleUpdate(
                  "launchOnStartup",
                  value,
                  value ? "Autoinicio activado." : "Autoinicio desactivado.",
                )
              }
            />
          </ComicSettingRow>

          <ComicSettingRow
            label="Comportamiento al cerrar"
            description="Con «Ocultar», la app sigue en la bandeja del sistema al pulsar la X."
            rotation={-1}
          >
            <select
              value={settings.closeBehavior}
              onChange={(event) =>
                void handleUpdate(
                  "closeBehavior",
                  event.target.value as DesktopSettings["closeBehavior"],
                  "Comportamiento al cerrar actualizado.",
                )
              }
            >
              <option value="hide">Ocultar</option>
              <option value="exit">Salir</option>
            </select>
          </ComicSettingRow>

          <ComicSettingRow
            label="Bandeja del sistema"
            description="Icono con menú Mostrar, Configuración, Ocultar y Salir."
            rotation={0.5}
          >
            <span className={settingStyles.hint}>Siempre activa</span>
          </ComicSettingRow>

          <ComicSettingRow
            label="Copia de seguridad"
            description="Exporta o importa accesos y ajustes como archivo JSON."
            rotation={-0.5}
          >
            <div className="settings-actions settings-actions--inline">
              <CutoutButton variant="default" rotation={-1} onClick={() => void handleExport()}>
                Exportar
              </CutoutButton>
              <CutoutButton variant="default" rotation={1} onClick={() => void handleImport()}>
                Importar
              </CutoutButton>
            </div>
          </ComicSettingRow>

          <div className="settings-actions">
            <CutoutButton
              variant="default"
              rotation={-1}
              onClick={() => {
                void resetToDefaults().then(() =>
                  showSuccess("Valores predeterminados restaurados."),
                );
              }}
            >
              Restaurar predeterminados
            </CutoutButton>
            <CutoutButton variant="default" rotation={1} onClick={() => void exitAppCompletely()}>
              Salir completamente
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
