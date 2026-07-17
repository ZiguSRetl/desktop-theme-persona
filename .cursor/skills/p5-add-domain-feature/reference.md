# Domain feature reference

## Existing domains

| Domain | Path | Notes |
|--------|------|-------|
| launcher | `src/features/launcher/` | items grid, search, persistence owner |
| settings | `src/features/settings/` | DesktopSettings, window, wallpaper, native sync |
| system | `src/features/system/` | stats via `get_system_stats` |
| audio | `src/features/audio/` | UI sounds gated by `soundEnabled` |

## Routes

`src/app/router.tsx`: `/`, `/apps`, `/games`, `/system`, `/settings`.

## Patterns to copy

- Store mutations: `launcherStore.ts` / `settingsStore.ts` (persist → set).
- Init: `useDesktopInit.ts`.
- Pure search: `searchSelectors.ts`.
- Selectors: `launcherSelectors.ts`.
