import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeLandCover } from "@/features/landcover/api";
import { analyzeVegetation } from "@/features/vegetation/api";
import { runAnalysisJob } from "@/services/analysisJobs";
import { withAoiRegionSelection, type AoiRegionSelection } from "./aoiRegionState";
import type { AoiPayload } from "./geo";
import type { AoiFeature } from "@/types/map";

vi.mock("@/services/analysisJobs", () => ({ runAnalysisJob: vi.fn().mockResolvedValue({}) }));

const feature: AoiFeature = {
  type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [
    Array.from({ length: 4001 }, (_, i) => [96 + Math.cos(i * Math.PI / 2000), 4 + Math.sin(i * Math.PI / 2000)]),
  ] },
};
const selections: AoiRegionSelection[] = [
  { scope: "island", code: "Sumatra" },
  { scope: "admin", level: "city", codes: ["1105"], provinceCodes: ["11"], cityCodes: ["1105"], districtCodes: [], villageCodes: [] },
];

beforeEach(() => vi.clearAllMocks());

describe.each(["landcover", "vegetation"] as const)("%s regional requests", (kind) => {
  const execute = (aoi: AoiPayload) => kind === "landcover"
    ? analyzeLandCover(aoi, 2026, { datasets: ["Dynamic_World"], dwMode: "mode", dateMode: "year", startMonth: 1, endMonth: 11, selectedMonth: 1, includeImprobableClasses: false })
    : analyzeVegetation(aoi, 2026, { indices: ["NDVI", "EVI"], startMonth: 1, endMonth: 11, cloudThreshold: 10, satellite: "sentinel2", cloudMaskTechnique: "scl" });

  it.each(selections)("sends a compact $scope reference instead of boundary coordinates", async (selection) => {
    const aoi = { geojson: withAoiRegionSelection(feature, selection) };
    await execute(aoi);
    const [jobType, payload] = vi.mocked(runAnalysisJob).mock.calls[0];
    const expected = selection.scope === "island" ? { scope: "island", code: "Sumatra" } : { level: "city", codes: ["1105"] };
    expect(jobType).toBe(kind);
    expect(payload).toMatchObject({ aoi: { region: expected }, year: 2026, start_month: 1, end_month: 11 });
    expect(JSON.stringify(payload).length).toBeLessThan(1000);
    expect(aoi.geojson.geometry).toEqual(feature.geometry);
    if (kind === "vegetation") expect(payload).toMatchObject({ indices: ["NDVI", "EVI"], cloud_threshold: 10 });
  });

  it("preserves a manually drawn AOI", async () => {
    const aoi = { geojson: feature };
    await execute(aoi);
    expect(vi.mocked(runAnalysisJob).mock.calls[0][1]).toMatchObject({ aoi });
  });
});
