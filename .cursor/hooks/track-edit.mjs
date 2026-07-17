import fs from "node:fs";
import path from "node:path";

const MARKER = path.join(".cursor", "hooks", ".pending-tests");
const RELEVANT =
  /(?:^|[\\/])(?:src|src-tauri)(?:[\\/]|$)|\.test\.(ts|tsx|js|jsx|rs)$/;

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(chunks.join("")));
    process.stdin.on("error", () => resolve(""));
  });
}

function normalizePath(filePath) {
  return String(filePath || "").replace(/\\/g, "/");
}

const raw = await readStdin();
let payload = {};
try {
  payload = raw ? JSON.parse(raw) : {};
} catch {
  process.stdout.write("{}\n");
  process.exit(0);
}

const filePath = normalizePath(payload.file_path);
if (filePath && RELEVANT.test(filePath)) {
  fs.mkdirSync(path.dirname(MARKER), { recursive: true });
  const existing = fs.existsSync(MARKER)
    ? fs.readFileSync(MARKER, "utf8").split("\n").filter(Boolean)
    : [];
  if (!existing.includes(filePath)) {
    existing.push(filePath);
    fs.writeFileSync(MARKER, `${existing.join("\n")}\n`, "utf8");
  }
}

process.stdout.write("{}\n");
