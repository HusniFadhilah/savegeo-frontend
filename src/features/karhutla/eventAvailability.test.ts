import { describe, expect, it } from "vitest";
import { isConfirmedWildfireEventForRoute } from "./eventAvailability";

describe("isConfirmedWildfireEventForRoute", () => {
  it("does not treat a matching static fallback as an API-confirmed event", () => {
    expect(isConfirmedWildfireEventForRoute("kalimantan-2026", "kalimantan-2026", "loading")).toBe(false);
    expect(isConfirmedWildfireEventForRoute("kalimantan-2026", "kalimantan-2026", "unavailable")).toBe(false);
  });

  it("allows event data requests only for the loaded event matching the current route", () => {
    expect(isConfirmedWildfireEventForRoute("kalimantan-2026", "kalimantan-2026", "ready")).toBe(true);
    expect(isConfirmedWildfireEventForRoute("sumatra-2026", "kalimantan-2026", "ready")).toBe(false);
  });
});
