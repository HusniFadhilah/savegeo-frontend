import { describe, expect, it, beforeEach } from "vitest";
import { translations, interpolate } from "@/i18n/translations";
import { formatDate, formatNumber, formatPercent, translate, useI18nStore } from "@/hooks/useI18nStore";

const placeholders = (value: string) => [...value.matchAll(/\{\{?\s*([\w.-]+)\s*\}?\}|%[sd]/g)].map((match) => match[0]).sort();

describe("SaveGeo i18n", () => {
  beforeEach(() => {
    localStorage.clear();
    useI18nStore.setState({ language: "id" });
    document.documentElement.lang = "id";
  });

  it("keeps the merged ID and EN catalogs structurally equal", () => {
    expect(Object.keys(translations.id).sort()).toEqual(Object.keys(translations.en).sort());
    for (const key of Object.keys(translations.id)) {
      expect(translations.id[key].trim(), key).not.toBe("");
      expect(translations.en[key].trim(), key).not.toBe("");
      expect(placeholders(translations.id[key]), key).toEqual(placeholders(translations.en[key]));
    }
  });

  it("does not contain known mojibake or replacement characters", () => {
    const bad = /Ã¢|Ã‚|Ãƒ|Ã°Å¸|Ã¯Â¿Â½|ï¿½|�|&nbsp;|&#x/iu;
    for (const language of ["id", "en"] as const) {
      for (const [key, value] of Object.entries(translations[language])) expect(value, key).not.toMatch(bad);
    }
  });

  it("keeps locale formatting in the active language", () => {
    expect(formatNumber(1234.56, "id")).toBe("1.234,56");
    expect(formatNumber(1234.56, "en")).toBe("1,234.56");
    expect(formatPercent(40, "id", 0)).toBe("40%");
    expect(formatDate("2026-09-16T00:00:00Z", "id")).toContain("September");
    expect(formatDate("2026-09-16T00:00:00Z", "en")).toContain("September");
  });

  it("does not show an Indonesian value when an English key is missing", () => {
    expect(translate("this.key.does.not.exist", "en")).toBe("exist");
  });

  it("persists a language switch and updates the document language", () => {
    useI18nStore.getState().setLanguage("en");
    expect(localStorage.getItem("savegeo_language")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(useI18nStore.getState().t("sidebar.language")).toBe("Language");
  });

  it("interpolates values without dropping missing placeholders", () => {
    expect(interpolate("{count} results for {name}", { count: 2, name: "AOI" })).toBe("2 results for AOI");
    expect(interpolate("{count} results for {name}", { count: 2 })).toBe("2 results for {name}");
  });
});
