import { create } from "zustand";
import { translations, type Language } from "@/i18n/translations";

const STORAGE_KEY = "savegeo_language";

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

function readInitialLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === "en" ? "en" : "id";
}

export const useI18nStore = create<I18nState>((set, get) => ({
  language: readInitialLanguage(),
  setLanguage: (lang) => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    set({ language: lang });
  },
  t: (key) => translations[get().language][key] ?? key,
}));
