export const APP_LANGUAGES = ["es", "en", "de", "fr", "ja"] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === "string" && (APP_LANGUAGES as readonly string[]).includes(value);
}

export const LOCALE_TAGS: Record<AppLanguage, string> = {
  es: "es-ES",
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
  ja: "ja-JP",
};

export function getLocaleTag(language: AppLanguage): string {
  return LOCALE_TAGS[language];
}
