import { useSettingsStore } from "../features/settings/settingsStore";
import { t, type TParams, type TranslationKey } from "./translate";

/** Translate with the language currently in the settings store. */
export function tt(key: TranslationKey, params?: TParams): string {
  return t(useSettingsStore.getState().settings.language, key, params);
}
