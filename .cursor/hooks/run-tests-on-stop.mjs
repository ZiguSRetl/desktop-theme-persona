import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const MARKER = path.join(".cursor", "hooks", ".pending-tests");
const MAX_OUTPUT = 4000;

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(chunks.join("")));
    process.stdin.on("error", () => resolve(""));
  });
}

function writeOutput(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

function clearMarker() {
  try {
    if (fs.existsSync(MARKER)) fs.unlinkSync(MARKER);
  } catch {
    // ignore
  }
}

function clip(text) {
  const trimmed = String(text || "").trim();
  if (trimmed.length <= MAX_OUTPUT) return trimmed;
  return `${trimmed.slice(0, MAX_OUTPUT)}\n…(truncated)`;
}

const raw = await readStdin();
let payload = {};
try {
  payload = raw ? JSON.parse(raw) : {};
} catch {
  writeOutput({});
  process.exit(0);
}

const status = payload.status ?? "completed";
const loopCount = Number(payload.loop_count ?? 0);

if (status !== "completed") {
  writeOutput({});
  process.exit(0);
}

const hasPending = fs.existsSync(MARKER);
if (!hasPending && loopCount === 0) {
  writeOutput({});
  process.exit(0);
}

const edited = hasPending
  ? fs.readFileSync(MARKER, "utf8").split("\n").filter(Boolean)
  : [];

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCmd, ["test"], {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: process.platform === "win32",
  env: { ...process.env, FORCE_COLOR: "0", CI: "1" },
});

if (result.status === 0) {
  clearMarker();
  writeOutput({});
  process.exit(0);
}

const failureLog = clip(
  [result.stdout, result.stderr].filter(Boolean).join("\n"),
);

if (loopCount >= 3) {
  clearMarker();
  writeOutput({
    followup_message:
      "npm test failed again after the maximum automatic fix attempts. Stop and report the remaining failures to the user.\n\n" +
      failureLog,
  });
  process.exit(0);
}

const editedHint =
  edited.length > 0
    ? `Edited files that triggered this run:\n${edited.slice(0, 20).join("\n")}\n\n`
    : "";

writeOutput({
  followup_message:
    "Automated Vitest run failed after your code changes. Inspect the failure, fix the root cause, and leave the suite green. Do not skip tests.\n\n" +
    editedHint +
    failureLog,
});
process.exit(0);
