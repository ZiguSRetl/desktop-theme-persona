import { describe, expect, it } from "vitest";
import { resolveAppLanguage } from "./detectLanguage";
import { t } from "./translate";

describe("resolveAppLanguage", () => {
  it("maps supported primary tags", () => {
    expect(resolveAppLanguage("es-ES")).toBe("es");
    expect(resolveAppLanguage("en-US")).toBe("en");
    expect(resolveAppLanguage("de-DE")).toBe("de");
    expect(resolveAppLanguage("fr-FR")).toBe("fr");
    expect(resolveAppLanguage("ja-JP")).toBe("ja");
  });

  it("falls back to en for unsupported locales", () => {
    expect(resolveAppLanguage("pt-BR")).toBe("en");
    expect(resolveAppLanguage("it-IT")).toBe("en");
    expect(resolveAppLanguage("")).toBe("en");
    expect(resolveAppLanguage("  ")).toBe("en");
  });
});

describe("t", () => {
  it("interpolates params", () => {
    expect(t("en", "launcher.pagination.page", { n: 2 })).toBe("Page 2");
    expect(t("es", "launcher.toasts.removed", { name: "Steam" })).toBe(
      '"Steam" eliminado.',
    );
  });

  it("falls back to english catalog for missing keys in theory via en", () => {
    expect(t("en", "nav.brand.title")).toBe("P5 Explorer");
  });
});
