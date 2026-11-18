import { useEffect, useId } from "react";
import { Link } from "react-router-dom";
import styles from "../../components/Navigation/Dropdown.module.css";
import { useT } from "../../i18n";
import { isWindowsHost } from "../system/platform";
import { ScriptConfirmDialog } from "./ScriptConfirmDialog";
import { getScriptById, SCRIPTS, type ScriptId } from "./scriptRegistry";
import { useScriptsStore } from "./scriptsStore";

export function ScriptsWidget({ id, reducedMotion }: { id: string; reducedMotion: boolean }) {
  const t = useT();
  const titleId = useId();
  const status = useScriptsStore((state) => state.status);
  const activeScriptId = useScriptsStore((state) => state.activeScriptId);
  const confirm = useScriptsStore((state) => state.confirmScript);
  const cancel = useScriptsStore((state) => state.cancelConfirm);
  const run = useScriptsStore((state) => state.runScript);
  const script = activeScriptId ? getScriptById(activeScriptId as ScriptId) : undefined;
  const available = isWindowsHost();

  useEffect(() => () => cancel(), [cancel]);

  return (
    <section
      id={id}
      className={`${styles.dropdown} ${styles.quick}`}
      aria-labelledby={titleId}
      data-reduced-motion={reducedMotion}
    >
      <h2 id={titleId} className={styles.title}>{t("nav.items.scripts")}</h2>
      {available ? (
        <>
          <ul className={styles.actionList}>
            {SCRIPTS.map(({ id: scriptId, name, description }) => (
              <li key={scriptId} className={styles.row}>
                <div>
                  <strong>{name}</strong>
                  <p className={styles.description}>{description}</p>
                </div>
                <button
                  type="button"
                  disabled={status === "running"}
                  onClick={() => confirm(scriptId)}
                >
                  {t(status === "running" ? "scripts.detail.running" : "scripts.confirm.run")}
                </button>
              </li>
            ))}
          </ul>
          <Link className={styles.detailsLink} to="/scripts/details">
            {t("scripts.view.detailSummary")}
          </Link>
          <ScriptConfirmDialog
            open={status === "confirming"}
            script={script ?? null}
            onConfirm={() => { if (script) void run(script.id); }}
            onCancel={cancel}
          />
        </>
      ) : (
        <p>{t("scripts.view.windowsOnly")}</p>
      )}
    </section>
  );
}
