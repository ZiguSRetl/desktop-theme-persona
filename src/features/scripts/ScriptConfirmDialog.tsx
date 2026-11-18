import { useEffect, useId, useRef } from "react";
import { useT } from "../../i18n";
import { CutoutButton } from "../../components/comic/CutoutButton";
import { ComicPanel } from "../../components/comic/ComicPanel";
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const visible = open && script !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!visible || !dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [visible]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialogWrap}
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      {script ? (
        <ComicPanel variant="white" rotation={1} shadowColor="red">
          <div className={styles.content}>
            <h2 id={titleId} className={styles.title}>
              {t("scripts.confirm.title", { name: script.name })}
            </h2>
            <p className={styles.lead}>{t("scripts.confirm.lead")}</p>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>{t("scripts.detail.stepsTitle")}</h3>
              <ul className={styles.list}>
                {script.plannedSteps.map((step) => <li key={step.id}>{t(step.labelKey)}</li>)}
              </ul>
            </section>

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
              <CutoutButton variant="ghost" htmlType="button" onClick={onCancel}>
                {t("scripts.confirm.cancel")}
              </CutoutButton>
              <CutoutButton variant="active" htmlType="button" onClick={onConfirm}>
                {t("scripts.confirm.run")}
              </CutoutButton>
            </div>
          </div>
        </ComicPanel>
      ) : null}
    </dialog>
  );
}
