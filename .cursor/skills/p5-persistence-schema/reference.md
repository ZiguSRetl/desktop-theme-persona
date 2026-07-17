# Persistence schema reference

## File of truth

Shared file: app-data `launcher-state.json` (`schemaVersion: 1`).

Browser fallback key: `persona5-explorer-launcher-state`.

## Core files

| Concern | File |
|---------|------|
| Types | `src/types/desktop.ts` |
| Validate/load/save/merge | `src/features/launcher/persistence.ts` |
| Seeds | `src/features/launcher/defaultItems.ts` |
| Items store | `src/features/launcher/launcherStore.ts` |
| Settings store | `src/features/settings/settingsStore.ts` |
| Import/export | `src/features/launcher/configTransfer.ts` |
| Boot hydrate | `src/features/launcher/useDesktopInit.ts` |

## Rules already encoded

- Invalid items dropped; empty list → seed items.
- Invalid `windowMode` → `"maximized"`.
- Invalid wallpaper path/crop → omitted.
- Unsupported `schemaVersion` → throw.
