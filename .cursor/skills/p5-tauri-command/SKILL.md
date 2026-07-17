---
name: p5-tauri-command
description: >-
  Adds or wire a Tauri 2 Rust command to the Persona5 Explorer frontend with invoke
  wrappers, camelCase payloads, and non-Tauri fallbacks. Use when adding Rust commands,
  invoke handlers, capabilities, or desktop bridge services.
---

# Add Tauri command

## Workflow

1. Implement `#[tauri::command]` in the right Rust module under `src-tauri/src/`.
2. Register it in `lib.rs` `tauri::generate_handler![...]`.
3. Update `src-tauri/capabilities/default.json` if the command needs new permissions/plugins.
4. Add a frontend wrapper in the owning feature (`*Service.ts` or dedicated helper).
5. Guard with `isTauri()` / `__TAURI_INTERNALS__`; define browser behavior (no-op, throw Spanish error, or localStorage).
6. Align serde rename / camelCase with TS payload types.
7. Prefer Spanish error strings for user-facing failures.
8. Keep Win32-only code behind `#[cfg(windows)]` with stubs.
9. Run `npm test` for TS changes; build/check Tauri when the command surface changes.

## Checklist

```
- [ ] Command implemented + registered in generate_handler!
- [ ] Capabilities updated if required
- [ ] TS wrapper in features/*/ (not in UI components)
- [ ] Non-Tauri path defined
- [ ] Payload types camelCase-aligned
- [ ] npm test passes for frontend changes
```

## Reference

- Command inventory and call sites: [reference.md](reference.md)
