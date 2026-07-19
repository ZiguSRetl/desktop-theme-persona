import { useState, type FormEvent } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { motion } from "motion/react";
import { useT } from "../../../i18n";
import type { LauncherItem, LauncherItemType } from "../../../types/desktop";
import type {
  NewLauncherItemInput,
  UpdateLauncherItemInput,
} from "../../../features/launcher/launcherStore";
import { fetchFileIcon, supportsFileIcon } from "../../../features/launcher/iconService";
import { useEffectiveReducedMotion } from "../../../features/settings/useAnimationProfile";
import { isLinuxHost } from "../../../features/system/platform";
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

function getTypeOptions(
  t: ReturnType<typeof useT>,
): { value: LauncherItemType; label: string }[] {
  return [
    { value: "application", label: t("shortcutDialog.types.application") },
    { value: "game", label: t("shortcutDialog.types.game") },
    { value: "folder", label: t("shortcutDialog.types.folder") },
    { value: "url", label: t("shortcutDialog.types.url") },
  ];
}

function getCategoryOptions(
  t: ReturnType<typeof useT>,
): { value: LauncherItem["category"]; label: string }[] {
  return [
    { value: "apps", label: t("shortcutDialog.categories.apps") },
    { value: "games", label: t("shortcutDialog.categories.games") },
    { value: "system", label: t("shortcutDialog.categories.system") },
  ];
}

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
  const t = useT();
  const typeOptions = getTypeOptions(t);
  const categoryOptions = getCategoryOptions(t);
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
      setError(t("shortcutDialog.errors.desktopOnly"));
      return;
    }

    try {
      const selected =
        type === "folder"
          ? await open({
              directory: true,
              multiple: false,
              title: t("shortcutDialog.dialogTitles.folder"),
            })
          : await open({
              multiple: false,
              title: t("shortcutDialog.dialogTitles.application"),
              filters: isLinuxHost()
                ? [
                    {
                      name: t("shortcutDialog.filters.linuxApps"),
                      extensions: ["desktop", "AppImage", "appimage"],
                    },
                    { name: t("shortcutDialog.filters.executable"), extensions: ["*"] },
                  ]
                : [
                    {
                      name: t("shortcutDialog.filters.executable"),
                      extensions: ["exe", "lnk"],
                    },
                  ],
            });

      if (typeof selected === "string") {
        const parts = selected.split(/[\\/]/);
        const derivedName =
          parts[parts.length - 1]?.replace(/\.(exe|lnk|desktop|AppImage|appimage)$/i, "") ?? "";
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
          : t("shortcutDialog.errors.browseFailed"),
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
      setError(t("shortcutDialog.errors.nameRequired"));
      return;
    }

    if (!resolvedTarget) {
      setError(
        showAppSearch
          ? t("shortcutDialog.errors.selectApp")
          : t("shortcutDialog.errors.targetRequired"),
      );
      return;
    }

    if (type === "url" && !/^https?:\/\//i.test(resolvedTarget)) {
      setError(t("shortcutDialog.errors.urlScheme"));
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
          : t("shortcutDialog.errors.saveFailed"),
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
              {isEdit ? t("shortcutDialog.title.edit") : t("shortcutDialog.title.create")}
            </h2>

            <label className={styles.field}>
              <span className={styles.label}>{t("shortcutDialog.fields.type")}</span>
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
                <span className={styles.label}>{t("shortcutDialog.fields.searchApp")}</span>
                <AppSearchPicker
                  value={appSelection}
                  onChange={handleAppSelection}
                  autoFocus
                  placeholder={t("search.appPicker.placeholderDialog")}
                />
                <button
                  type="button"
                  className={styles.manualLink}
                  onClick={() => void handleBrowse()}
                >
                  {t("shortcutDialog.manualBrowse")}
                </button>
              </div>
            ) : (
              <label className={styles.field}>
                <span className={styles.label}>{t("shortcutDialog.fields.target")}</span>
                <div className={styles.targetRow}>
                  <input
                    className={styles.input}
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    placeholder={
                      type === "url"
                        ? t("shortcutDialog.placeholders.url")
                        : t(
                            isLinuxHost()
                              ? "shortcutDialog.placeholders.pathLinux"
                              : "shortcutDialog.placeholders.path",
                          )
                    }
                    autoFocus={!isEdit}
                  />
                  {type !== "url" ? (
                    <button
                      type="button"
                      className={styles.browseBtn}
                      onClick={() => void handleBrowse()}
                    >
                      {t("shortcutDialog.browse")}
                    </button>
                  ) : null}
                </div>
              </label>
            )}

            <label className={styles.field}>
              <span className={styles.label}>{t("shortcutDialog.fields.name")}</span>
              <input
                className={styles.input}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("shortcutDialog.placeholders.name")}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>{t("shortcutDialog.fields.category")}</span>
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
              <span>{t("shortcutDialog.favorite")}</span>
            </label>

            {error ? <p className={styles.error}>{error}</p> : null}

            <div className={styles.actions}>
              <CutoutButton variant="default" rotation={-1} onClick={onClose} disabled={isSaving}>
                {t("shortcutDialog.cancel")}
              </CutoutButton>
              <CutoutButton
                variant="active"
                rotation={1}
                htmlType="submit"
                disabled={isSaving}
              >
                {isSaving ? t("shortcutDialog.saving") : t("shortcutDialog.save")}
              </CutoutButton>
            </div>
          </form>
        </ComicPanel>
      </motion.div>
    </div>
  );
}
