---
name: p5-add-domain-feature
description: >-
  Adds or extends a Persona5 Explorer domain feature (launcher, settings, system, audio)
  using feature-slice layout, Zustand stores, and thin pages. Use when creating a new
  feature, page section, store, selector, or feature UI in this project.
---

# Add domain feature

## Workflow

1. Place logic under `src/features/<domain>/` — not in `pages/` or random `components/`.
2. Types: extend `src/types/desktop.ts` if the domain model changes.
3. Store (if stateful): Zustand `create` with `hydrate` + async mutations that call `mergeAndSaveState` first.
4. Services: wrap Tauri `invoke` in `*Service.ts` with `isTauri()` guards.
5. Selectors: pure functions or small hooks (`*Selectors.ts`).
6. UI: feature-local views/tiles, or shared `components/comic/*` primitives.
7. Page: thin wrapper in `src/pages/` + route in `src/app/router.tsx` if needed.
8. Persist user-visible copy via `src/i18n` catalogs (`useT` / `tt`).
9. Add/adjust colocated Vitest coverage for store/selector/validation logic.
10. Run `npm test`.

## Checklist

```
- [ ] Feature files under src/features/<domain>/
- [ ] Types updated if schema/model changed
- [ ] Persistence via mergeAndSaveState when durable
- [ ] Thin page + router entry (if navigable)
- [ ] Tests for non-trivial logic
- [ ] npm test passes
```

## Reference

- Paths and examples: [reference.md](reference.md)
