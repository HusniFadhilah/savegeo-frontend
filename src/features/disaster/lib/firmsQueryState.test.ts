import { describe, expect, it } from "vitest";
import { DEFAULT_FIRMS_QUERY, parseFirmsQuery, writeFirmsQuery } from "./firmsQueryState";

describe("FIRMS query state", () => {
  it("round-trips valid filter controls without storing hotspot data", () => {
    const state = {
      ...DEFAULT_FIRMS_QUERY,
      enabled: true,
      source: "VIIRS_NOAA20_NRT" as const,
      period: "3" as const,
      minConfidence: 80,
      minFrp: "20",
      showLabels: true,
      cluster: false,
      dayOnly: true,
      highOnly: true,
    };
    const params = writeFirmsQuery(new URLSearchParams("event=4"), state);
    const parsed = parseFirmsQuery(params.toString());
    expect(parsed).toEqual(state);
    expect(params.get("event")).toBe("4");
    expect(params.toString()).not.toContain("latitude");
  });

  it("ignores invalid source, period, confidence, and FRP values", () => {
    const parsed = parseFirmsQuery("firms=1&firmsSource=secret&firmsDays=99&firmsConfidence=500&firmsMinFrp=-2");
    expect(parsed.source).toBe("all");
    expect(parsed.period).toBe("1");
    expect(parsed.minConfidence).toBe(0);
    expect(parsed.minFrp).toBe("");
  });
});
