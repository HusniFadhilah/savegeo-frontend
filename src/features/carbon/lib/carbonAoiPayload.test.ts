import { describe, expect, it } from "vitest";
import { carbonJobAoi } from "./carbonAoiPayload";
import { withAoiRegionSelection } from "./aoiRegionState";
import type { AoiFeature } from "@/types/map";

describe("administrative carbon request", () => {
  it("sends the exact region reference instead of thousands of boundary vertices", () => {
    const feature: AoiFeature = { type: "Feature", geometry: { type: "Polygon", coordinates: [Array.from({ length: 4000 }, () => [110.4, -7])] }, properties: {} };
    const aoi = { geojson: withAoiRegionSelection(feature, { scope: "admin", level: "city", codes: ["3374"], provinceCodes: ["33"], cityCodes: ["3374"], districtCodes: [], villageCodes: [] }) };
    const result = carbonJobAoi(aoi);
    expect(result).toEqual({ region: { level: "city", codes: ["3374"] } });
    expect(JSON.stringify(result).length).toBeLessThan(100);
    expect(aoi.geojson.geometry.coordinates[0]).toHaveLength(4000);
  });

  it("preserves custom AOIs", () => {
    const aoi = { west: 110, south: -7, east: 111, north: -6 };
    expect(carbonJobAoi(aoi)).toBe(aoi);
  });

  it.each([{ scope: "indonesia" } as const, { scope: "island", code: "Jawa" } as const])("sends a compact $scope reference", (selection) => {
    const feature: AoiFeature = { type: "Feature", geometry: { type: "Polygon", coordinates: [[[110, -7], [111, -7], [111, -6], [110, -7]]] }, properties: {} };
    expect(carbonJobAoi({ geojson: withAoiRegionSelection(feature, selection) })).toEqual({ region: selection });
  });
});
