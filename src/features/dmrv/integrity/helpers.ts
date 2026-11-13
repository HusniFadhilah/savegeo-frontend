import { useCallback } from "react";
import { useI18nStore } from "@/hooks/useI18nStore";
export function useCopy() {
  const language = useI18nStore((s) => s.language);
  return useCallback((id: string, en: string) => (language === "id" ? id : en), [language]);
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
export function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
export function number(value: number | null | undefined, digits = 2) {
  return value == null
    ? "—"
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);
}
export const references = (value: string) =>
  value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
