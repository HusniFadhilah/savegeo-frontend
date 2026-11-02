import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAnalysisJob } from "@/services/analysisJobs";
import { apiClient } from "@/services/apiClient";
import { withAoiRegionSelection } from "@/features/carbon/lib/aoiRegionState";
import type { AoiFeature } from "@/types/map";
import type { LcAoiPayload } from "./types";
import { analyzeLandCoverYear, analyzeLandCoverTransition, analyzeLandCoverChangeMap,
  analyzeLandCoverHotspots, analyzeLandCoverFusion, identifyLandCoverPoint } from "./api";

vi.mock("@/services/analysisJobs", () => ({ runAnalysisJob: vi.fn() }));
vi.mock("@/services/apiClient", () => ({ apiClient: { post: vi.fn() } }));
const pair = { dataset: "Dynamic_World", from_year: 2015, to_year: 2016, start_month: 1, end_month: 12, dw_probability_threshold: 0.5 };
const operations = [
  (aoi: LcAoiPayload) => analyzeLandCoverYear({ ...pair, aoi, year: 2015, datasets: ["Dynamic_World"] }),
  (aoi: LcAoiPayload) => analyzeLandCoverTransition({ ...pair, aoi }),
  (aoi: LcAoiPayload) => analyzeLandCoverChangeMap({ ...pair, aoi }),
  (aoi: LcAoiPayload) => analyzeLandCoverHotspots({ ...pair, aoi }),
  (aoi: LcAoiPayload) => analyzeLandCoverFusion({ ...pair, aoi, fusion_mode: "routing", q_min: 0.5, tau_change: 0.2 }),
  (aoi: LcAoiPayload) => identifyLandCoverPoint({ ...pair, aoi, year: 2015, latitude: 4, longitude: 96 }),
];
const feature: AoiFeature = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [
  Array.from({ length: 4001 }, (_, i) => [96 + Math.cos(i * Math.PI / 2000), 4 + Math.sin(i * Math.PI / 2000)]),
] } };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(runAnalysisJob).mockResolvedValue({ method: "pixel_transition", resolution: "310m", pairs: [{ from_year: 2015, to_year: 2016, flows: [] }] });
  vi.mocked(apiClient.post).mockResolvedValue({});
});
describe.each(operations)("LC change request %#$", (execute) => {
  it("sends the region identity while preserving periods and threshold", async () => {
    const aoi = { geojson: withAoiRegionSelection(feature, { scope: "island", code: "Sumatra" }) };
    await execute(aoi);
    const payload = vi.mocked(runAnalysisJob).mock.calls[0]?.[1] ?? vi.mocked(apiClient.post).mock.calls[0][1];
    expect(payload).toMatchObject({ aoi: { region: { scope: "island", code: "Sumatra" } }, start_month: 1, end_month: 12, dw_probability_threshold: 0.5 });
    expect(JSON.stringify(payload).length).toBeLessThan(1000);
    expect(aoi.geojson.geometry).toEqual(feature.geometry);
  });
  it("preserves custom polygon coordinates", async () => {
    const aoi = { geojson: feature };
    await execute(aoi);
    const payload = vi.mocked(runAnalysisJob).mock.calls[0]?.[1] ?? vi.mocked(apiClient.post).mock.calls[0][1];
    expect(payload).toMatchObject({ aoi });
  });
});
