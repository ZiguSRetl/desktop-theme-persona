#!/usr/bin/env bash
# Parallel Linux release helper (does not replace scripts/release.ps1).
# Bumps version files, commits, tags, and pushes to trigger release-linux.yml
# alongside the existing Windows NSIS workflow on the same tag.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

Bump="${1:-patch}"
SkipPush="${SKIP_PUSH:-0}"

if [[ ! "$Bump" =~ ^(patch|minor|major)$ ]]; then
  echo "Usage: $0 [patch|minor|major]" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash first." >&2
  git status --short
  exit 1
fi

current="$(node -p "require('./package.json').version")"
IFS=. read -r major minor patch <<<"$current"
case "$Bump" in
  major) next="$((major + 1)).0.0" ;;
  minor) next="${major}.$((minor + 1)).0" ;;
  patch) next="${major}.${minor}.$((patch + 1))" ;;
esac

echo "Bumping $current → $next"

python3 - "$next" <<'PY'
import json, re, sys
from pathlib import Path
version = sys.argv[1]
for path in [Path("package.json"), Path("src-tauri/tauri.conf.json")]:
    text = path.read_text(encoding="utf-8")
    updated, n = re.subn(r'("version"\s*:\s*")[^"]+(")', rf'\g<1>{version}\g<2>', text, count=1)
    if n != 1:
        raise SystemExit(f"Could not update version in {path}")
    path.write_text(updated, encoding="utf-8")
cargo = Path("src-tauri/Cargo.toml")
text = cargo.read_text(encoding="utf-8")
updated, n = re.subn(r'(?m)^(version\s*=\s*")[^"]+(")', rf'\g<1>{version}\g<2>', text, count=1)
if n != 1:
    raise SystemExit("Could not update version in Cargo.toml")
cargo.write_text(updated, encoding="utf-8")
print("version files updated")
PY

git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: release v${next}"
git tag "v${next}"

if [[ "$SkipPush" == "1" ]]; then
  echo "Tagged v${next} (push skipped)."
  exit 0
fi

git push origin HEAD
git push origin "v${next}"
echo "Pushed v${next}. Windows NSIS + Linux deb/AppImage workflows should run on the tag."
