# Persona5 Explorer

Windows desktop launcher with a Persona 5–inspired comic UI (red and black). Launch apps, games, folders, and URLs; pin favorites; monitor system metrics; run a gaming-oriented Clean script; and optionally run as a multi-monitor desktop shell with tray and autostart support.

## Features

- **Sections:** Home (favorites), Apps, Games, System, Scripts, Settings
- **Launcher tiles:** apps, games, folders, and URLs with native icons, drag-and-drop reorder, and favorites
- **System monitor:** CPU, RAM, disk, network, and GPU with alert tones in the shell footer
- **Clean script:** high-performance power plan, close heavy apps, purge standby RAM, clear caches/shaders, optional NVIDIA GPU reset
- **Desktop mode:** fullscreen behind windows on all monitors, hide Windows desktop icons, force launch on startup
- **Multi-monitor:** one launcher window per monitor with shared state
- **Tray & settings:** show / settings / hide / exit; wallpaper + crop; UI sounds; global shortcut; close-to-hide; autostart; JSON config import/export

The in-app UI is in Spanish.

## Stack

| Layer | Tech |
|-------|------|
| Desktop | [Tauri](https://tauri.app/) 2 |
| Frontend | React 19, TypeScript, Vite 7, Zustand, Vitest |
| Native | Rust (`src-tauri/`), Windows APIs |

## Requirements

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Rust](https://www.rust-lang.org/tools/install) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for Windows
- Windows (NSIS installer target)

## Development

```bash
npm install
npm run tauri dev
```

On Linux, use the parallel harness (does not change Windows/NSIS tooling):

```bash
./scripts/dev-linux.sh
# see LINUX.md
```

Useful scripts:

| Command | Description |
|---------|-------------|
| `npm run tauri dev` | Run the app with hot reload |
| `npm test` | Run Vitest once |
| `npm run check` | Typecheck, lint, and test |
| `npm run tauri:build` | Full check + frontend build + NSIS package |

## Project layout

```
src/
  features/     # Domain logic (launcher, settings, system, scripts, audio)
  pages/        # Thin route entry points
  components/   # Shared UI (comic design system, shell chrome)
  types/        # Shared domain types
src-tauri/
  src/          # Rust commands and Windows integration
```

## IDE setup

[VS Code](https://code.visualstudio.com/) or Cursor with the [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) and [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) extensions.
