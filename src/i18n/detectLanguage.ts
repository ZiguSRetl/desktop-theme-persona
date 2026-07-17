import { isAppLanguage, type AppLanguage } from "./types";

/** Map a BCP-47 tag (or primary subtag) to a supported app language; unsupported → `en`. */
export function resolveAppLanguage(tag: string): AppLanguage {
  const primary = tag.trim().toLowerCase().split("-")[0] ?? "";
  if (isAppLanguage(primary)) return primary;
  return "en";
}

/** Detect UI language from the host (Windows WebView reflects OS language). */
export function detectSystemLanguage(): AppLanguage {
  if (typeof navigator === "undefined") return "en";
  const tag = navigator.languages?.[0] ?? navigator.language ?? "en";
  return resolveAppLanguage(tag);
}
