import { describe, expect, it } from "vitest";
import { formatStatistic, statisticMetric } from "./statisticMetrics";

describe("disaster statistics units", () => {
  it("separates area, distance, counts and percentage", () => {
    expect(statisticMetric("buildings_exposed")?.unit).toBe("objek");
    expect(statisticMetric("road_length_exposed_m")?.unit).toBe("m");
    expect(statisticMetric("coverage_pct")?.unit).toBe("%");
    expect(statisticMetric("changed_area_ha")?.unit).toBe("ha");
    expect(formatStatistic("buildings_exposed", 0)).toBe("0 objek");
  });
  it("omits algorithm parameters and rejects invalid numeric output", () => {
    expect(statisticMetric("threshold")).toBeNull();
    expect(formatStatistic("changed_area_ha", NaN)).toBe("Belum tersedia");
  });
});
