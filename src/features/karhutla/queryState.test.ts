import { describe, expect, it } from "vitest";
import { parseWildfireQuery, writeWildfireQuery } from "./queryState";

describe("wildfire query state", () => {
  it("normalizes invalid map and filter parameters", () => {
    const state = parseWildfireQuery("?from=nope&sensor=unknown&confidence=high,garbage&lat=99&zoom=99");
    expect(state.from).toBe("");
    expect(state.sensor).toBe("all");
    expect(state.confidence).toEqual(["high"]);
    expect(state.lat).toBeNull();
    expect(state.zoom).toBeNull();
  });

  it("round trips shareable state without serializing defaults", () => {
    const state = parseWildfireQuery("?from=2026-08-20&to=2026-08-27&sensor=viirs&province=62&lat=-1.7&lng=113.4&zoom=6");
    const query = writeWildfireQuery(new URLSearchParams(), state).toString();
    expect(query).toContain("from=2026-08-20");
    expect(query).toContain("sensor=viirs");
    expect(query).not.toContain("confidence=");
  });
});
