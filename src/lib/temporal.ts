import type { Language } from "@/i18n/approvedTranslations";

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseApiTimestamp(value: string): Date {
  if (!RFC3339.test(value)) throw new Error("Timestamp must be RFC 3339 and include a timezone");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Timestamp is invalid");
  return parsed;
}

export function formatApiTimestamp(value: Date | string): string {
  const parsed = value instanceof Date ? value : parseApiTimestamp(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Timestamp is invalid");
  const iso = parsed.toISOString();
  return `${iso.slice(0, 19)}.${iso.slice(20, 23)}Z`;
}

/** Construct a local calendar date so `YYYY-MM-DD` never shifts by timezone. */
export function parseCalendarDate(value: string): Date {
  const match = CALENDAR_DATE.exec(value);
  if (!match) throw new Error("Calendar date must use YYYY-MM-DD");
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (parsed.getFullYear() !== Number(match[1]) || parsed.getMonth() !== Number(match[2]) - 1 || parsed.getDate() !== Number(match[3])) {
    throw new Error("Calendar date is invalid");
  }
  return parsed;
}

export function formatDisplayTemporal(value: string | Date, language: Language, withTime = false): string {
  const locale = language === "id" ? "id-ID" : "en-US";
  const date = value instanceof Date
    ? value
    : CALENDAR_DATE.test(value) ? parseCalendarDate(value) : parseApiTimestamp(value);
  if (Number.isNaN(date.getTime())) throw new Error("Temporal value is invalid");
  return new Intl.DateTimeFormat(locale, withTime ? { dateStyle: "long", timeStyle: "short" } : { dateStyle: "long" }).format(date);
}
