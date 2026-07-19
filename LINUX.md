# Linux development

Persona5 Explorer is Windows-first. Linux support is added in parallel without changing the NSIS / PowerShell release path.

## Prerequisites (Ubuntu)

```bash
# Node.js LTS (22+)
# Rust via rustup: https://rustup.rs

sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf
```

Ensure Cargo is on `PATH`:

```bash
source "$HOME/.cargo/env"
```

## Dev

```bash
npm install
./scripts/dev-linux.sh
# or: npm run tauri:dev:linux
```

This uses the overlay [`src-tauri/tauri.linux.conf.json`](src-tauri/tauri.linux.conf.json) (opaque window, `deb`/`appimage` bundle targets). The base [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) stays NSIS/Windows.

## Build packages

```bash
npm run tauri:build:linux
```

Artifacts land under `src-tauri/target/release/bundle/`.

On Linux/macOS the launcher opens as a **floating window** by default. **Pantalla completa** asks the compositor to maximize (respects GNOME top bar + dock). It does not use exclusive Wayland fullscreen.

Multi-monitor satellite windows are **Windows desktop-mode only**; they are not created on Linux.

| Feature | Linux |
|---------|--------|
| Windowed launcher UI | Supported |
| Desktop overlay (WorkerW / hide DE icons) | **Windows only** |
| Launch apps / folders / URLs | Supported (xdg-open / spawn) |
| Installed apps catalog | `.desktop` scan |
| Native icons | FreeDesktop themes |
| Scripts / Clean | Hidden on Linux |
| Release updater channel | Windows `latest.json` unchanged; Linux assets published separately |

## Windows release (unchanged)

```bash
npm run release   # PowerShell → NSIS via CI
```
