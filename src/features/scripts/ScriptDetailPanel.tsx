import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { ComicPanel } from "../../components/comic/ComicPanel";
import { formatBytes } from "../system/systemService";
import type { ScriptDefinition } from "./scriptRegistry";
import type { CleanScriptResult, CleanStepResult } from "./types";
import styles from "./ScriptDetailPanel.module.css";

interface ScriptDetailPanelProps {
  script: ScriptDefinition | null;
  running: boolean;
  lastResult: CleanScriptResult | null;
  error: string | null;
  onRun: () => void;
}

function StepIcon({ step, running }: { step?: CleanStepResult; running: boolean }) {
  if (running && !step) {
    return <Loader2 className={styles.stepSpinner} size={16} aria-hidden="true" />;
  }
  if (!step) {
    return <Circle className={styles.stepPending} size={16} aria-hidden="true" />;
  }
  if (step.status === "ok") {
    return <CheckCircle2 className={styles.stepOk} size={16} aria-hidden="true" />;
  }
  if (step.status === "failed") {
    return <XCircle className={styles.stepFailed} size={16} aria-hidden="true" />;
  }
  return <Circle className={styles.stepSkipped} size={16} aria-hidden="true" />;
}

function MetricsBlock({
  label,
  before,
  after,
}: {
  label: string;
  before?: number;
  after?: number;
}) {
  if (before === undefined && after === undefined) return null;

  return (
    <div className={styles.metricRow}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>
        {before !== undefined ? formatBytes(before) : "—"} →{" "}
        {after !== undefined ? formatBytes(after) : "—"}
      </span>
    </div>
  );
}

export function ScriptDetailPanel({
  script,
  running,
  lastResult,
  error,
  onRun,
}: ScriptDetailPanelProps) {
  if (!script) {
    return (
      <ComicPanel variant="white" rotation={-1} shadowColor="red" className={styles.panel}>
        <p className={styles.empty}>Selecciona un script para ver detalles y ejecutarlo.</p>
      </ComicPanel>
    );
  }

  const Icon = script.icon;
  const stepsById = new Map((lastResult?.steps ?? []).map((step) => [step.id, step] as const));

  return (
    <ComicPanel variant="white" rotation={-1} shadowColor="red" className={styles.panel}>
      <div className={styles.hero}>
        <span className={styles.iconWrap} aria-hidden="true">
          <Icon size={48} />
        </span>
        <h2 className={styles.name}>{script.name}</h2>
        <p className={styles.description}>{script.description}</p>
      </div>

      <div className={styles.primaryActions}>
        <button type="button" className={styles.runBtn} onClick={onRun} disabled={running}>
          {running ? "Ejecutando…" : "Ejecutar Clean"}
        </button>
      </div>

      <section className={styles.section} aria-label="Pasos del script">
        <h3 className={styles.sectionTitle}>Pasos</h3>
        <ul className={styles.stepList}>
          {script.plannedSteps.map((planned) => {
            const step = stepsById.get(planned.id);
            return (
              <li key={planned.id} className={styles.stepItem}>
                <StepIcon step={step} running={running && !lastResult} />
                <div className={styles.stepBody}>
                  <span className={styles.stepLabel}>{planned.label}</span>
                  {step?.detail ? <span className={styles.stepDetail}>{step.detail}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {lastResult ? (
        <section className={styles.section} aria-label="Resultado">
          <h3 className={styles.sectionTitle}>Antes / Después</h3>
          <MetricsBlock
            label="RAM usada"
            before={lastResult.before.memoryUsedBytes}
            after={lastResult.after.memoryUsedBytes}
          />
          <MetricsBlock
            label="VRAM usada"
            before={lastResult.before.vramUsedBytes}
            after={lastResult.after.vramUsedBytes}
          />
          {lastResult.closedApps.length > 0 ? (
            <p className={styles.closedApps}>
              Apps cerradas: {lastResult.closedApps.join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
    </ComicPanel>
  );
}
