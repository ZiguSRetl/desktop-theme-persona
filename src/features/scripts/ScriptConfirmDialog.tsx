import { motion } from "motion/react";
import { useT } from "../../i18n";
import { CutoutButton } from "../../components/comic/CutoutButton";
import { ComicPanel } from "../../components/comic/ComicPanel";
import { useEffectiveReducedMotion } from "../settings/useAnimationProfile";
import type { ScriptDefinition } from "./scriptRegistry";
import styles from "./ScriptConfirmDialog.module.css";

interface ScriptConfirmDialogProps {
  open: boolean;
  script: ScriptDefinition | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ScriptConfirmDialog({
  open,
  script,
  onConfirm,
  onCancel,
}: ScriptConfirmDialogProps) {
  const t = useT();
  const reduceMotion = useEffectiveReducedMotion();

  if (!open || !script) return null;

  return (
    <div className={styles.backdrop} role="presentation" onClick={onCancel}>
      <motion.div
        className={styles.dialogWrap}
        role="dialog"
        aria-modal="true"
        aria-labelledby="script-confirm-title"
        initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(event) => event.stopPropagation()}
      >
        <ComicPanel variant="white" rotation={1} shadowColor="red">
          <div className={styles.content}>
            <h2 id="script-confirm-title" className={styles.title}>
              {t("scripts.confirm.title", { name: script.name })}
            </h2>
            <p className={styles.lead}>{t("scripts.confirm.lead")}</p>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>{t("scripts.confirm.appsTitle")}</h3>
              <ul className={styles.list}>
                {script.appsToClose.map((app) => (
                  <li key={app}>{app}</li>
                ))}
              </ul>
            </section>

            <p className={styles.note}>{t("scripts.confirm.uacNote")}</p>

            <div className={styles.actions}>
              <CutoutButton variant="active" htmlType="button" onClick={onConfirm}>
                {t("scripts.confirm.run")}
              </CutoutButton>
              <CutoutButton variant="ghost" htmlType="button" onClick={onCancel}>
                {t("scripts.confirm.cancel")}
              </CutoutButton>
            </div>
          </div>
        </ComicPanel>
      </motion.div>
    </div>
  );
}
