import { es, type TranslationKey } from "./locales/es";
import { en } from "./locales/en";
import { de } from "./locales/de";
import { fr } from "./locales/fr";
import { ja } from "./locales/ja";
import { detectSystemLanguage } from "./detectLanguage";
import type { AppLanguage } from "./types";

export type { TranslationKey };

const catalogs: Record<AppLanguage, Record<TranslationKey, string>> = {
  es,
  en,
  de,
  fr,
  ja,
};

export type TParams = Record<string, string | number>;

function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    params[key] !== undefined ? String(params[key]) : `{{${key}}}`,
  );
}

export function t(language: AppLanguage, key: TranslationKey, params?: TParams): string {
  const catalog = catalogs[language] ?? catalogs.en;
  const text = catalog[key] ?? catalogs.en[key] ?? key;
  return interpolate(text, params);
}

/** Translate using detected system language (for boot / pre-store errors). */
export function tSystem(key: TranslationKey, params?: TParams): string {
  return t(detectSystemLanguage(), key, params);
}
