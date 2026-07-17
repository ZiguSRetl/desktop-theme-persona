import { useMemo } from "react";
import { useSettingsStore } from "../features/settings/settingsStore";
import { t, type TParams, type TranslationKey } from "./translate";

export function useT() {
  const language = useSettingsStore((state) => state.settings.language);

  return useMemo(() => {
    return (key: TranslationKey, params?: TParams) => t(language, key, params);
  }, [language]);
}
