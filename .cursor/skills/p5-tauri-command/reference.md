# Tauri command reference

## Registered commands (typical)

| Command | Frontend |
|---------|----------|
| `launch_item` | `features/launcher/launchItem.ts` |
| `get_file_icon` | `features/launcher/iconService.ts` |
| `search_installed_apps` | `features/launcher/appSearchService.ts` |
| `reveal_item_in_dir` | `features/launcher/revealItem.ts` |
| `load_launcher_state` / `save_launcher_state` | `features/launcher/persistence.ts` |
| `sync_native_settings` | `features/settings/nativeSettings.ts` |
| `exit_app` | `features/settings/nativeSettings.ts` |
| `get_system_stats` | `features/system/systemService.ts` |
| `enable_desktop_mode` / `disable_desktop_mode` / `is_desktop_mode_active_cmd` | via settings / tray |
| `sync_monitor_windows` / `hide_launcher_windows` | `features/settings/monitorWindowsService.ts`, `windowService.ts` |
| `save_wallpaper` / `remove_wallpaper` / `load_image_data_url` | `features/settings/wallpaperService.ts` |

## Events from Rust

- `navigate-settings`
- `desktop-mode-changed`

## Events from frontend

- `persisted-state-changed` — `{ origin: windowLabel }` after `save_launcher_state` (cross-window hydrate)

## Plugins used from TS

dialog, fs, window, autostart, global-shortcut, opener — prefer official `@tauri-apps/*` APIs over new custom commands when the plugin already covers the need.
