import { describe, expect, it, vi } from "vitest";
import { buildBasicCarbonPlan, needsNationalCarbonModel, simpleCarbonSummaryScale } from "./basicCarbonPlan";
import { listCarbonModels } from "@/features/carbon/api";

vi.mock("@/features/carbon/api", () => ({
  listCarbonDatasets: vi.fn(async () => [
    { value: "SPAWN", targetPool: "aboveground_biomass_carbon" },
    { value: "ORNL_BGB", targetPool: "belowground_biomass_carbon" },
    { value: "SOILGRIDS_OCS_0_30CM", targetPool: "soil_organic_carbon" },
    { value: "TROPICAL_LITTER_REFERENCE", targetPool: "litter_carbon" },
    { value: "TROPICAL_DEADWOOD_REFERENCE", targetPool: "deadwood_carbon" },
  ]),
  listCarbonModels: vi.fn(async (dataset: string) => [{
    name: `reference_${dataset}_indonesia`,
    metadata_json: { method: "saved_reference_ensemble", training_domain: "indonesia", gee_deployable: true },
  }]),
}));

describe("simple carbon geographic coverage", () => {
  it.each([2025, 2026])("selects annual national models for large AOIs in %i", async (year) => {
    for (const aoi of [
      { west: 108.5, south: -8.2, east: 111.7, north: -6.4 },
      { west: 95, south: -6, east: 106, north: 6 },
      { west: 105, south: -9, east: 115, north: -5 },
      { west: 94, south: -11, east: 142, north: 6 },
    ]) {
      const plan = await buildBasicCarbonPlan(year, aoi);
      expect(plan.map((target) => target.key)).toEqual(["agb", "bgb", "soc", "litter", "deadwood"]);
      expect(plan.map((target) => target.referenceOnly)).toEqual([false, false, false, false, false]);
      expect(plan.map((target) => target.datasetYear)).toEqual([2010, 2010, 2020, 2010, 2010]);
      expect(plan.slice(0, 3).every((target) => target.model?.metadata_json?.training_domain === "indonesia")).toBe(true);
      expect(plan.slice(3).every((target) => !target.referenceOnly)).toBe(true);
    }
  });

  it("uses the reference directly only for its available year", async () => {
    const aoi = { west: 94, south: -11, east: 142, north: 6 };
    expect((await buildBasicCarbonPlan(2010, aoi)).map((target) => target.referenceOnly)).toEqual([true, true, false, true, true]);
    expect((await buildBasicCarbonPlan(2020, aoi)).map((target) => target.referenceOnly)).toEqual([false, false, true, false, false]);
  });

  it("uses the built-in AOI calibrated models when a frozen national release is unavailable", async () => {
    vi.mocked(listCarbonModels).mockImplementation(async (dataset: string) => [{
      name: `pool_rf_${dataset.toLowerCase()}`,
      algorithm: "Random Forest",
      metadata_json: { builtin: true, training_mode: "reference_raster", gee_deployable: true },
    }]);
    const plan = await buildBasicCarbonPlan(2026, { west: 94, south: -11, east: 142, north: 6 });
    expect(plan.map((target) => target.key)).toEqual(["agb", "bgb", "soc", "litter", "deadwood"]);
    expect(plan.every((target) => target.model?.metadata_json?.builtin && !target.referenceOnly)).toBe(true);
  });

  it("does not silently substitute a static raster when no annual model is available", async () => {
    vi.mocked(listCarbonModels).mockResolvedValue([]);
    await expect(buildBasicCarbonPlan(2026, { west: 94, south: -11, east: 142, north: 6 }))
      .rejects.toThrow("Model tahunan litter belum tersedia");
  });

  it("retains annual model selection for city and village AOIs", () => {
    expect(needsNationalCarbonModel({ west: 110.25, south: -7.15, east: 110.52, north: -6.9 })).toBe(false);
    expect(needsNationalCarbonModel({ west: 110.43, south: -7.08, east: 110.45, north: -7.06 })).toBe(false);
  });

  it("uses polygon area in km² and includes the regional training buffer", () => {
    expect(needsNationalCarbonModel({ geojson: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[105, -7], [107, -7], [107, -6], [105, -6], [105, -7]]] } } })).toBe(true);
    expect(needsNationalCarbonModel({ west: 100, south: -5, east: 120, north: -4.99 })).toBe(true);
  });

  it("bounds annual raster statistics while retaining native resolution for small AOIs", () => {
    expect(simpleCarbonSummaryScale({ west:110.43, south:-7.08, east:110.45, north:-7.06 })).toBe(10);
    expect(simpleCarbonSummaryScale({ west:110, south:-7.5, east:110.8, north:-6.8 })).toBeGreaterThan(100);
  });
});
