import { useState, type FormEvent } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { motion } from "motion/react";
import type { LauncherItem, LauncherItemType } from "../../../types/desktop";
import type {
  NewLauncherItemInput,
  UpdateLauncherItemInput,
} from "../../../features/launcher/launcherStore";
import { fetchFileIcon, supportsFileIcon } from "../../../features/launcher/iconService";
import { useEffectiveReducedMotion } from "../../../features/settings/useAnimationProfile";
import {
  AppSearchPicker,
  type AppSearchSelection,
} from "../AppSearchPicker/AppSearchPicker";
import { CutoutButton } from "../CutoutButton";
import { ComicPanel } from "../ComicPanel";
import styles from "./AddShortcutDialog.module.css";

interface ShortcutDialogBaseProps {
  open: boolean;
  onClose: () => void;
}

interface CreateShortcutDialogProps extends ShortcutDialogBaseProps {
  mode?: "create";
  defaultCategory: LauncherItem["category"];
  onSubmit: (input: NewLauncherItemInput) => Promise<void>;
}

interface EditShortcutDialogProps extends ShortcutDialogBaseProps {
  mode: "edit";
  initialItem: LauncherItem;
  onSubmit: (input: UpdateLauncherItemInput) => Promise<void>;
}

export type AddShortcutDialogProps = CreateShortcutDialogProps | EditShortcutDialogProps;

const typeOptions: { value: LauncherItemType; label: string }[] = [
  { value: "application", label: "Aplicación" },
  { value: "game", label: "Juego" },
  { value: "folder", label: "Carpeta" },
  { value: "url", label: "Enlace" },
];

const categoryOptions: { value: LauncherItem["category"]; label: string }[] = [
  { value: "apps", label: "Aplicaciones" },
  { value: "games", label: "Juegos" },
  { value: "system", label: "Sistema" },
];

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function usesAppSearch(type: LauncherItemType, isEdit: boolean): boolean {
  return !isEdit && (type === "application" || type === "game");
}

export function AddShortcutDialog(props: AddShortcutDialogProps) {
  const { open: isOpen } = props;
  const isEdit = props.mode === "edit";
  const reduceMotion = useEffectiveReducedMotion();

  if (!isOpen) return null;

  const dialogKey = isEdit ? `edit-${props.initialItem.id}` : `create-${props.defaultCategory}`;

  return (
    <ShortcutDialogForm
      key={dialogKey}
      isEdit={isEdit}
      reduceMotion={reduceMotion}
      {...props}
    />
  );
}

function ShortcutDialogForm({
  isEdit,
  reduceMotion,
  onClose,
  ...props
}: AddShortcutDialogProps & { isEdit: boolean; reduceMotion: boolean }) {
  const [name, setName] = useState(() =>
    isEdit && props.mode === "edit" ? props.initialItem.name : "",
  );
  const [type, setType] = useState<LauncherItemType>(() =>
    isEdit && props.mode === "edit" ? props.initialItem.type : "application",
  );
  const [target, setTarget] = useState(() =>
    isEdit && props.mode === "edit" ? props.initialItem.target : "",
  );
  const [category, setCategory] = useState<LauncherItem["category"]>(() =>
    isEdit && props.mode === "edit"
      ? props.initialItem.category
      : props.mode === "create"
        ? props.defaultCategory
        : "apps",
  );
  const [favorite, setFavorite] = useState(() =>
    isEdit && props.mode === "edit" ? props.initialItem.favorite : false,
  );
  const [icon, setIcon] = useState<string | undefined>(() =>
    isEdit && props.mode === "edit" ? props.initialItem.icon : undefined,
  );
  const [appSelection, setAppSelection] = useState<AppSearchSelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const showAppSearch = usesAppSearch(type, isEdit);

  const handleBrowse = async () => {
    if (!isTauri()) {
      setError("El selector de archivos solo está disponible en la app de escritorio.");
      return;
    }

    try {
      const selected =
        type === "folder"
          ? await open({ directory: true, multiple: false, title: "Seleccionar carpeta" })
          : await open({
              multiple: false,
              title: "Seleccionar aplicación",
              filters: [{ name: "Ejecutable", extensions: ["exe", "lnk"] }],
            });

      if (typeof selected === "string") {
        const parts = selected.split(/[\\/]/);
        const derivedName = parts[parts.length - 1]?.replace(/\.(exe|lnk)$/i, "") ?? "";
        const nextName = name.trim() || derivedName;

        setTarget(selected);
        if (!name.trim()) {
          setName(derivedName);
        }

        if (supportsFileIcon(type)) {
          const nextIcon = await fetchFileIcon(selected);
          setIcon(nextIcon);
          if (showAppSearch) {
            setAppSelection({ name: nextName, path: selected, icon: nextIcon });
          }
        } else if (showAppSearch) {
          setAppSelection({ name: nextName, path: selected, icon });
        } else {
          setAppSelection(null);
        }
      }
    } catch (browseError) {
      setError(
        browseError instanceof Error
          ? browseError.message
          : "No se pudo abrir el selector de archivos.",
      );
    }
  };

  const handleAppSelection = (selection: AppSearchSelection) => {
    setAppSelection(selection);
    setTarget(selection.path);
    setName(selection.name);
    setIcon(selection.icon);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const resolvedTarget = showAppSearch ? (appSelection?.path ?? target).trim() : target.trim();
    const resolvedName = name.trim() || appSelection?.name.trim() || "";

    if (!resolvedName) {
      setError("El nombre es obligatorio.");
      return;
    }

    if (!resolvedTarget) {
      setError(
        showAppSearch
          ? "Busca y selecciona una aplicación de la lista."
          : "El destino es obligatorio.",
      );
      return;
    }

    if (type === "url" && !/^https?:\/\//i.test(resolvedTarget)) {
      setError("La URL debe empezar por http:// o https://");
      return;
    }

    setIsSaving(true);
    try {
      let resolvedIcon = icon;
      if (supportsFileIcon(type)) {
        resolvedIcon =
          (await fetchFileIcon(resolvedTarget)) ?? appSelection?.icon ?? resolvedIcon;
      } else {
        resolvedIcon = undefined;
      }

      const payload = {
        name: resolvedName,
        type,
        target: resolvedTarget,
        category,
        favorite,
        icon: resolvedIcon,
      };

      await props.onSubmit(payload);

      if (!isEdit) {
        setName("");
        setTarget("");
        setIcon(undefined);
        setAppSelection(null);
        setFavorite(false);
        setType("application");
      }
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar el acceso.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <motion.div
        className={`${styles.dialogWrap} ${showAppSearch ? styles.dialogWrapWide : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-shortcut-title"
        initial={reduceMotion ? false : { scale: 0.92, opacity: 0, rotate: -2 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={(event) => event.stopPropagation()}
      >
        <ComicPanel variant="white" shadowColor="black" rotation={-1}>
          <form className={styles.form} onSubmit={handleSubmit}>
            <h2 id="add-shortcut-title" className={styles.title}>
              {isEdit ? "Editar acceso" : "Nuevo acceso"}
            </h2>

            <label className={styles.field}>
              <span className={styles.label}>Tipo</span>
              <select
                className={styles.select}
                value={type}
                onChange={(event) => {
                  const nextType = event.target.value as LauncherItemType;
                  setType(nextType);
                  if (!usesAppSearch(nextType, isEdit)) {
                    setAppSelection(null);
                  }
                }}
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {showAppSearch ? (
              <div className={styles.field}>
                <span className={styles.label}>Buscar aplicación</span>
                <AppSearchPicker
                  value={appSelection}
                  onChange={handleAppSelection}
                  autoFocus
                  placeholder="Escribe para buscar, como en el menú Inicio…"
                />
                <button
                  type="button"
                  className={styles.manualLink}
                  onClick={() => void handleBrowse()}
                >
                  O seleccionar archivo manualmente
                </button>
              </div>
            ) : (
              <label className={styles.field}>
                <span className={styles.label}>Destino</span>
                <div className={styles.targetRow}>
                  <input
                    className={styles.input}
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    placeholder={
                      type === "url"
                        ? "https://ejemplo.com"
                        : "C:\\ruta\\al\\programa.exe"
                    }
                    autoFocus={!isEdit}
                  />
                  {type !== "url" ? (
                    <button
                      type="button"
                      className={styles.browseBtn}
                      onClick={() => void handleBrowse()}
                    >
                      Examinar
                    </button>
                  ) : null}
                </div>
              </label>
            )}

            <label className={styles.field}>
              <span className={styles.label}>Nombre</span>
              <input
                className={styles.input}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Mi aplicación"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Categoría</span>
              <select
                className={styles.select}
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as LauncherItem["category"])
                }
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={favorite}
                onChange={(event) => setFavorite(event.target.checked)}
              />
              <span>Añadir a favoritos (Inicio)</span>
            </label>

            {error ? <p className={styles.error}>{error}</p> : null}

            <div className={styles.actions}>
              <CutoutButton variant="default" rotation={-1} onClick={onClose} disabled={isSaving}>
                Cancelar
              </CutoutButton>
              <CutoutButton
                variant="active"
                rotation={1}
                htmlType="submit"
                disabled={isSaving}
              >
                {isSaving ? "Guardando…" : "Guardar"}
              </CutoutButton>
            </div>
          </form>
        </ComicPanel>
      </motion.div>
    </div>
  );
}
