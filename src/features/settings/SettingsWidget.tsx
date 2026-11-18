import { useId, useState } from "react";
import { Link } from "react-router-dom";
import styles from "../../components/Navigation/Dropdown.module.css";
import { useT } from "../../i18n";
import { showLaunchError, showSuccess } from "../launcher/toastStore";
import { useSettingsMenuStore } from "./settingsMenuStore";
import { useSetting, useSettingsStore } from "./settingsStore";
import type { DesktopSettings } from "../../types/desktop";

export function SettingsWidget({ id, reducedMotion }: { id: string; reducedMotion: boolean }) {
  const t = useT();
  const titleId = useId();
  const soundEnabled = useSetting("soundEnabled");
  const animationIntensity = useSetting("animationIntensity");
  const ready = useSettingsStore((state) => state.status === "ready");
  const updateSetting = useSettingsStore((state) => state.updateSetting);
  const goBackToRoot = useSettingsMenuStore((state) => state.goBackToRoot);
  const [saving, setSaving] = useState(false);

  const save = async <K extends "soundEnabled" | "animationIntensity">(
    key: K,
    value: DesktopSettings[K],
    message: string,
  ) => {
    setSaving(true);
    try {
      await updateSetting(key, value);
      showSuccess(message);
    } catch (error) {
      showLaunchError(typeof error === "string" ? new Error(error) : error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      id={id}
      className={`${styles.dropdown} ${styles.quick}`}
      aria-labelledby={titleId}
      data-reduced-motion={reducedMotion}
    >
      <h2 id={titleId} className={styles.title}>{t("nav.items.settings")}</h2>
      <label className={styles.row}>
        {t("settings.sound.label")}
        <input
          type="checkbox"
          checked={soundEnabled}
          disabled={!ready || saving}
          onChange={(event) => {
            const checked = event.currentTarget.checked;
            void save("soundEnabled", checked, t(checked ? "settings.toasts.soundOn" : "settings.toasts.soundOff"));
          }}
        />
      </label>
      <label className={styles.row}>
        {t("settings.animationIntensity.label")}
        <select
          value={animationIntensity}
          disabled={!ready || saving}
          onChange={(event) => void save(
            "animationIntensity",
            event.currentTarget.value as DesktopSettings["animationIntensity"],
            t("settings.toasts.animationUpdated"),
          )}
        >
          <option value="reduced">{t("settings.animationIntensity.options.reduced")}</option>
          <option value="normal">{t("settings.animationIntensity.options.normal")}</option>
          <option value="high">{t("settings.animationIntensity.options.high")}</option>
        </select>
      </label>
      <Link className={styles.detailsLink} to="/settings/details" onClick={goBackToRoot}>
        {t("settings.quick.all")}
      </Link>
    </section>
  );
}
