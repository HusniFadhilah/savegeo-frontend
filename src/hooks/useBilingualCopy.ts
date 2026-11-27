import { useCallback } from "react";
import { useI18nStore } from "@/hooks/useI18nStore";

export function bilingualCopy(id: string, en: string) {
  return useI18nStore.getState().language === "id" ? id : en;
}

/** Return localized copy for small surfaces that have not migrated to catalog keys yet. */
export function useBilingualCopy() {
  const language = useI18nStore((state) => state.language);
  return useCallback((id: string, en: string) => (language === "id" ? id : en), [language]);
}
