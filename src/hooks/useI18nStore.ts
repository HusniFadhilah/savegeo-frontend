import { create } from "zustand";
import { translations, interpolate, type Language } from "@/i18n/translations";
import { formatDisplayTemporal } from "@/lib/temporal";

const STORAGE_KEY = "savegeo_language";

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function readInitialLanguage(): Language {
  if (typeof window === "undefined") return "id";
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable in private browsing or embedded contexts.
  }
  if (saved === "id" || saved === "en") return saved;
  return window.navigator.language.toLowerCase().startsWith("en") ? "en" : "id";
}

/** Translate a UI key without silently falling back to Indonesian in English. */
export function translate(key: string, language: Language, params?: Record<string, string | number>): string {
  const raw = translations[language][key];
  const value = raw ?? key.split(".").pop()?.replace(/[-_]/g, " ") ?? key;
  if (!raw && import.meta.env.DEV) console.warn(`[i18n] Missing translation key: ${key}`);
  return params ? interpolate(value, params) : value;
}

export function localeFor(language: Language): "id-ID" | "en-US" {
  return language === "id" ? "id-ID" : "en-US";
}

export function formatNumber(value: number, language: Language, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(localeFor(language), options).format(value);
}

export function formatPercent(value: number, language: Language, digits = 1): string {
  return formatNumber(value, language, { minimumFractionDigits: digits, maximumFractionDigits: digits }) + "%";
}

export function formatDate(value: string | number | Date, language: Language, withTime = false): string {
  if (typeof value === "number") {
    return new Intl.DateTimeFormat(localeFor(language), withTime
      ? { dateStyle: "long", timeStyle: "short" } : { dateStyle: "long" }).format(new Date(value));
  }
  return formatDisplayTemporal(value, language, withTime);
}

export const useI18nStore = create<I18nState>((set, get) => ({
  language: readInitialLanguage(),
  setLanguage: (lang) => {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // The in-memory Zustand state still keeps the active locale for this tab.
    }
    if (typeof document !== "undefined") document.documentElement.lang = lang;
    // Recreate the translator reference so components selecting only `t`
    // also re-render when the locale changes.
    set({ language: lang, t: (key, params) => translate(key, lang, params) });
  },
  t: (key, params) => translate(key, get().language, params),
}));

if (typeof document !== "undefined") document.documentElement.lang = useI18nStore.getState().language;
