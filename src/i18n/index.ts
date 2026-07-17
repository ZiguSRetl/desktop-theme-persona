import { detectSystemLanguage, resolveAppLanguage } from "./detectLanguage";
import { t, tSystem, type TParams, type TranslationKey } from "./translate";
import { tt } from "./tt";
import { APP_LANGUAGES, getLocaleTag, isAppLanguage, LOCALE_TAGS, type AppLanguage } from "./types";
import { useT } from "./useT";

export type { AppLanguage, TranslationKey, TParams };
export {
  APP_LANGUAGES,
  detectSystemLanguage,
  getLocaleTag,
  isAppLanguage,
  LOCALE_TAGS,
  resolveAppLanguage,
  t,
  tSystem,
  tt,
  useT,
};
