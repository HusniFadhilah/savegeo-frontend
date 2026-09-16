import { create } from "zustand";
import { translations, interpolate, type Language } from "@/i18n/translations";

const STORAGE_KEY = "savegeo_language";

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function readInitialLanguage(): Language {
  if (typeof window === "undefined") return "id";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "id" || saved === "en") return saved;
  return window.navigator.language.toLowerCase().startsWith("en") ? "en" : "id";
}

/** Translate a UI key with locale and default-language fallback. Missing keys
 * are logged in development while keeping a readable label on screen. */
export function translate(key: string, language: Language, params?: Record<string, string | number>): string {
  const raw = translations[language][key] ?? translations.id[key];
  const value = raw ?? key.split(".").pop()?.replace(/[-_]/g, " ") ?? key;
  if (!raw && import.meta.env.DEV) console.warn(`[i18n] Missing translation key: ${key}`);
  return params ? interpolate(value, params) : value;
}

export function formatNumber(value: number, language: Language, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(language === "id" ? "id-ID" : "en-US", options).format(value);
}

export function formatPercent(value: number, language: Language, digits = 1): string {
  return formatNumber(value, language, { minimumFractionDigits: digits, maximumFractionDigits: digits }) + "%";
}

export function formatDate(value: string | number | Date, language: Language, withTime = false): string {
  return new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", withTime
    ? { dateStyle: "long", timeStyle: "short" } : { dateStyle: "long" }).format(new Date(value));
}

export const useI18nStore = create<I18nState>((set, get) => ({
  language: readInitialLanguage(),
  setLanguage: (lang) => {
    localStorage.setItem(STORAGE_KEY, lang);
    if (typeof document !== "undefined") document.documentElement.lang = lang;
    // Recreate the translator reference so components selecting only `t`
    // also re-render when the locale changes.
    set({ language: lang, t: (key, params) => translate(key, lang, params) });
  },
  t: (key, params) => translate(key, get().language, params),
}));

if (typeof document !== "undefined") document.documentElement.lang = useI18nStore.getState().language;
