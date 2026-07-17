---
name: p5-persistence-schema
description: >-
  Changes Persona5 Explorer persisted launcher state schema (items, settings,
  schemaVersion) across TypeScript types, validators, defaults, and consumers.
  Use when adding settings fields, launcher item fields, wallpaper shape, or migrating
  launcher-state.json.
---

# Persistence schema change

## Workflow

1. Update types in `src/types/desktop.ts` (`LauncherItem`, `DesktopSettings`, `PersistedDesktopState`).
2. Update `DEFAULT_SETTINGS` / seed items in `persistence.ts` / `defaultItems.ts`.
3. Extend `validateSettings` / `validateLauncherItem` / `validatePersistedState` for new/changed fields.
4. If `schemaVersion` must bump, reject old versions or migrate explicitly — do not silently accept unknown versions.
5. Update stores that read/write the field (`settingsStore`, `launcherStore`) and any native sync side-effects.
6. Check Rust persistence path in `src-tauri` if it round-trips the same JSON.
7. Update import/export via `configTransfer.ts` (uses validation + hydrate).
8. Add Vitest cases for valid, invalid, and default-fallback behavior.
9. Run `npm test`.

## Checklist

```
- [ ] desktop.ts types updated
- [ ] Defaults + validators updated
- [ ] Store / native / window side-effects updated
- [ ] Import/export still validates
- [ ] Tests cover new field edge cases
- [ ] npm test passes
```

## Reference

- Field map and files: [reference.md](reference.md)
