#!/usr/bin/env bash
# Dev harness for Persona5 Explorer on Linux (does not change Windows tooling).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PATH="${HOME}/.cargo/bin:${PATH}"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need node
need npm
need cargo

if ! pkg-config --exists webkit2gtk-4.1 2>/dev/null && ! pkg-config --exists webkit2gtk-4.0 2>/dev/null; then
  echo "WebKitGTK not found. Install Tauri Linux deps, e.g.:" >&2
  echo "  sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf" >&2
  exit 1
fi

echo "Starting Linux Tauri dev (overlay: src-tauri/tauri.linux.conf.json)..."
echo "Known limits until later phases: desktop embed, Windows-only Clean, empty app catalog stubs."
exec npm run tauri:dev:linux
