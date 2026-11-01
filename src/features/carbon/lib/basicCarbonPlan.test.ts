import { describe, expect, it, vi } from "vitest";
import { buildBasicCarbonPlan, needsRegionalCarbonBaseline, simpleCarbonSummaryScale } from "./basicCarbonPlan";

vi.mock("@/features/carbon/api", () => ({
  listCarbonDatasets: vi.fn(async () => [
    { value: "SPAWN", targetPool: "aboveground_biomass_carbon" },
    { value: "ORNL_BGB", targetPool: "belowground_biomass_carbon" },
    { value: "SOILGRIDS_OCS_0_30CM", targetPool: "soil_organic_carbon" },
  ]),
  listCarbonModels: vi.fn(async () => []),
}));

describe("simple carbon geographic coverage", () => {
  it("uses reference stocks for a province, an island, and Indonesia", async () => {
    for (const aoi of [
      { west: 108.5, south: -8.2, east: 111.7, north: -6.4 },
      { west: 105, south: -9, east: 115, north: -5 },
      { west: 94, south: -11, east: 142, north: 6 },
    ]) {
      const plan = await buildBasicCarbonPlan(2026, aoi);
      expect(plan.map((target) => [target.key, target.dataset.value, target.datasetYear, target.referenceOnly, target.model]))
        .toEqual([["agb", "SPAWN", 2010, true, null], ["bgb", "ORNL_BGB", 2010, true, null], ["soc", "SOILGRIDS_OCS_0_30CM", 2020, true, null]]);
    }
  });

  it("retains annual model selection for city and village AOIs", () => {
    expect(needsRegionalCarbonBaseline({ west: 110.25, south: -7.15, east: 110.52, north: -6.9 })).toBe(false);
    expect(needsRegionalCarbonBaseline({ west: 110.43, south: -7.08, east: 110.45, north: -7.06 })).toBe(false);
  });

  it("uses polygon area in km² and includes the regional training buffer", () => {
    expect(needsRegionalCarbonBaseline({ geojson: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[105, -7], [107, -7], [107, -6], [105, -6], [105, -7]]] } } })).toBe(true);
    expect(needsRegionalCarbonBaseline({ west: 100, south: -5, east: 120, north: -4.99 })).toBe(true);
  });

  it("bounds annual raster statistics while retaining native resolution for small AOIs", () => {
    expect(simpleCarbonSummaryScale({ west:110.43, south:-7.08, east:110.45, north:-7.06 })).toBe(10);
    expect(simpleCarbonSummaryScale({ west:110, south:-7.5, east:110.8, north:-6.8 })).toBeGreaterThan(100);
  });
});
