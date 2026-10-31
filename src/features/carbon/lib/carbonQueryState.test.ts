import { describe, expect, it } from "vitest";
import { parseCarbonQuery, serializeCarbonQuery } from "./carbonQueryState";

describe("carbon query state for vegetation time series", () => {
  it("round-trips Semarang using flat region fields and accepts legacy links", () => {
    const region = JSON.stringify({ scope: "admin", level: "city", codes: ["3374"], provinceCodes: ["33"], cityCodes: ["3374"], districtCodes: [], villageCodes: [] });
    const query = serializeCarbonQuery({ mode: "carbon", aoiRegion: region, year: 2026 });
    expect(query.has("aoi_region")).toBe(false);
    expect(query.get("aoi_codes")).toBe("3374");
    expect(query.toString()).not.toContain("%7B");
    expect(JSON.parse(parseCarbonQuery(`?${query}`).aoiRegion!)).toEqual(JSON.parse(region));
    expect(parseCarbonQuery(`?aoi_region=${encodeURIComponent(region)}`).aoiRegion).toBe(region);
  });

  it("reads the shared month range and cloud threshold from the carbon URL", () => {
    const state = parseCarbonQuery("?mode=vegetation&year=2026&month_from=1&month_to=12&cloud=10&clip=clipped&show_reference=true");

    expect(state.mode).toBe("vegetation");
    expect(state.year).toBe(2026);
    expect(state.monthFrom).toBe(1);
    expect(state.monthTo).toBe(12);
    expect(state.cloudThreshold).toBe(10);
  });

  it("round-trips multiple indices, bands, and monthly-series state", () => {
    const query = serializeCarbonQuery({
      mode: "vegetation",
      year: 2026,
      monthFrom: 1,
      monthTo: 12,
      cloudThreshold: 10,
      index: "NDVI",
      indices: ["NDVI", "EVI"],
      bands: ["B2", "B8"],
      timeSeries: true,
    });
    const state = parseCarbonQuery(`?${query.toString()}`);

    expect(state.indices).toEqual(["NDVI", "EVI"]);
    expect(state.bands).toEqual(["B2", "B8"]);
    expect(state.timeSeries).toBe(true);
    expect(state.monthFrom).toBe(1);
    expect(state.monthTo).toBe(12);
  });
});
