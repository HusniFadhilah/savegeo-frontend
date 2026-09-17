import { describe, expect, it } from "vitest";
import { formatApiTimestamp, parseApiTimestamp, parseCalendarDate } from "./temporal";

describe("temporal contracts", () => {
  it("normalizes an offset timestamp to UTC", () => {
    expect(formatApiTimestamp("2026-09-17T15:15:30.125+07:00")).toBe("2026-09-17T08:15:30.125Z");
    expect(parseApiTimestamp("2026-09-17T08:15:30.125Z").toISOString()).toBe("2026-09-17T08:15:30.125Z");
  });

  it("rejects timestamps without a timezone", () => {
    expect(() => parseApiTimestamp("2026-09-17T15:15:30")).toThrow(/timezone/i);
  });

  it("keeps a calendar date as a calendar date", () => {
    const date = parseCalendarDate("2026-09-17");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8);
    expect(date.getDate()).toBe(17);
  });
});
