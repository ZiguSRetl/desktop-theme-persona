export type CleanStepStatus = "ok" | "skipped" | "failed";

export interface CleanStepResult {
  id: string;
  label: string;
  status: CleanStepStatus;
  detail?: string;
}

export interface CleanMetricsSnapshot {
  memoryUsedBytes: number;
  vramUsedBytes?: number;
}

export interface CleanScriptResult {
  steps: CleanStepResult[];
  closedApps: string[];
  before: CleanMetricsSnapshot;
  after: CleanMetricsSnapshot;
}

export type ScriptRunStatus = "idle" | "confirming" | "running" | "success" | "error";

export interface ScriptsState {
  status: ScriptRunStatus;
  activeScriptId: string | null;
  lastResult: CleanScriptResult | null;
  error: string | null;
  confirmScript: (scriptId: string) => void;
  cancelConfirm: () => void;
  runScript: (scriptId: string) => Promise<void>;
  reset: () => void;
}
