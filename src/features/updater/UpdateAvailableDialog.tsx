import { motion } from "motion/react";
import { useT } from "../../i18n";
import { CutoutButton } from "../../components/comic/CutoutButton";
import { ComicPanel } from "../../components/comic/ComicPanel";
import { useEffectiveReducedMotion } from "../settings/useAnimationProfile";
import { useUpdateStore } from "./updateStore";
import styles from "./UpdateAvailableDialog.module.css";

export function UpdateAvailableDialog() {
  const t = useT();
  const reduceMotion = useEffectiveReducedMotion();
  const dialogOpen = useUpdateStore((state) => state.dialogOpen);
  const available = useUpdateStore((state) => state.available);
  const installing = useUpdateStore((state) => state.installing);
  const installUpdate = useUpdateStore((state) => state.installUpdate);
  const dismissDialog = useUpdateStore((state) => state.dismissDialog);

  if (!dialogOpen || !available) return null;

  return (
    <div className={styles.backdrop} role="presentation" onClick={() => !installing && dismissDialog()}>
      <motion.div
        className={styles.dialogWrap}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-available-title"
        initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(event) => event.stopPropagation()}
      >
        <ComicPanel variant="white" rotation={1} shadowColor="red">
          <div className={styles.content}>
            <h2 id="update-available-title" className={styles.title}>
              {t("updater.dialog.title")}
            </h2>
            <p className={styles.lead}>
              {t("updater.dialog.lead", { version: available.version })}
            </p>
            {available.body ? (
              <section className={styles.block}>
                <h3 className={styles.blockTitle}>{t("updater.dialog.notesTitle")}</h3>
                <p className={styles.notes}>{available.body}</p>
              </section>
            ) : null}
            <p className={styles.note}>{t("updater.dialog.restartNote")}</p>
            <div className={styles.actions}>
              <CutoutButton
                variant="active"
                htmlType="button"
                disabled={installing}
                onClick={() => void installUpdate()}
              >
                {installing ? t("updater.dialog.installing") : t("updater.dialog.update")}
              </CutoutButton>
              <CutoutButton
                variant="ghost"
                htmlType="button"
                disabled={installing}
                onClick={dismissDialog}
              >
                {t("updater.dialog.later")}
              </CutoutButton>
            </div>
          </div>
        </ComicPanel>
      </motion.div>
    </div>
  );
}
