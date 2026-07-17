import { useMemo, useState } from "react";
import { SectionBadge } from "../launcher/SectionBadge";
import { SCRIPTS } from "./scriptRegistry";
import { ScriptConfirmDialog } from "./ScriptConfirmDialog";
import { ScriptDetailPanel } from "./ScriptDetailPanel";
import { ScriptTile } from "./ScriptTile";
import { useScriptsStore } from "./scriptsStore";
import styles from "./ScriptView.module.css";

export function ScriptView() {
  const [selectedId, setSelectedId] = useState<string | null>(SCRIPTS[0]?.id ?? null);
  const status = useScriptsStore((state) => state.status);
  const activeScriptId = useScriptsStore((state) => state.activeScriptId);
  const lastResult = useScriptsStore((state) => state.lastResult);
  const error = useScriptsStore((state) => state.error);
  const confirmScript = useScriptsStore((state) => state.confirmScript);
  const cancelConfirm = useScriptsStore((state) => state.cancelConfirm);
  const runScript = useScriptsStore((state) => state.runScript);

  const selectedScript = useMemo(() => {
    const match = selectedId ? SCRIPTS.find((script) => script.id === selectedId) : undefined;
    return match ?? SCRIPTS[0] ?? null;
  }, [selectedId]);

  const confirmScriptDef = useMemo(() => {
    if (!activeScriptId) return null;
    return SCRIPTS.find((script) => script.id === activeScriptId) ?? null;
  }, [activeScriptId]);

  const running = status === "running";

  const handleRun = () => {
    if (!selectedScript || running) return;
    confirmScript(selectedScript.id);
  };

  const handleConfirm = () => {
    if (!activeScriptId) return;
    void runScript(activeScriptId);
  };

  return (
    <div className="page-layout launcher-page">
      <SectionBadge label="Scripts internos" />

      <div className="launcher-layout">
        <div className={styles.main}>
          <div className={styles.gridWrap}>
            <div className={styles.grid} role="list">
              {SCRIPTS.map((script) => (
                <ScriptTile
                  key={script.id}
                  script={script}
                  selected={selectedScript?.id === script.id}
                  running={running && activeScriptId === script.id}
                  onSelect={() => setSelectedId(script.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <aside className={styles.detailAside} aria-label="Panel de detalle del script">
          <details className="context-panel__details launcher-panel__details" open>
            <summary className="context-panel__toggle">Detalle del script</summary>
            <div className="context-panel__content">
              <ScriptDetailPanel
                script={selectedScript}
                running={running}
                lastResult={lastResult}
                error={error}
                onRun={handleRun}
              />
            </div>
          </details>
        </aside>
      </div>

      <ScriptConfirmDialog
        open={status === "confirming"}
        script={confirmScriptDef}
        onConfirm={handleConfirm}
        onCancel={cancelConfirm}
      />
    </div>
  );
}
