import { apiClient } from "@/services/apiClient";
import { runAnalysisJob } from "@/services/analysisJobs";
import type {
  LcAnalyzeParams,
  LcAnalyzeResponse,
  LcChangeMapParams,
  LcChangeMapResponse,
  LcIdentifyResponse,
  LcHotspotParams,
  LcHotspotResponse,
  LcTransitionResponse,
  TransitionData,
} from "./types";

export async function analyzeLandCoverTransition(params: LcChangeMapParams): Promise<TransitionData> {
  const response = await runAnalysisJob<LcTransitionResponse>("landcover_transition", params, { timeoutMs: 900_000 });
  const pair = response.pairs.find((item) => item.from_year === params.from_year && item.to_year === params.to_year);
  if (response.method !== "pixel_transition" || !pair) throw new Error("Matriks transisi piksel tidak tersedia.");
  const matrix: TransitionData["matrix"] = {};
  const gains: TransitionData["gains"] = {};
  const losses: TransitionData["losses"] = {};
  const classes = new Set<string>();
  for (const flow of pair.flows) {
    classes.add(flow.from); classes.add(flow.to);
    matrix[flow.from] ??= {};
    matrix[flow.from][flow.to] = (matrix[flow.from][flow.to] ?? 0) + flow.area;
    if (flow.changed) {
      gains[flow.to] = (gains[flow.to] ?? 0) + flow.area;
      losses[flow.from] = (losses[flow.from] ?? 0) + flow.area;
    }
  }
  return { matrix, gains, losses, allClasses: [...classes].sort(), method: response.method,
    totalAreaHa: pair.total_area_ha, changedAreaHa: pair.changed_area_ha,
    stableAreaHa: pair.stable_area_ha, sourceVersion: response.model_version ?? response.collection_version };
}

/**
 * LC-Change module API calls. Endpoint paths/payload/response shapes are
 * ported as-is from the legacy `apiClient.analyzeLandCover` /
 * `apiClient.analyzeLandCoverChangeMap` (frontend-nextjs2/public/main.js).
 * Both endpoints return their payload as a flat JSON body (no
 * {success,data} envelope) - the legacy jQuery client added that wrapper
 * itself, this fetch-based client returns the parsed body directly.
 */

/** POST /analyze/landcover - one request per year, single dataset in the array. */
export function analyzeLandCoverYear(params: LcAnalyzeParams) {
  return runAnalysisJob<LcAnalyzeResponse>("landcover_change", params, { timeoutMs: 650_000 });
}

/** POST /analyze/landcover-change-map - pixel-level diff + tile URLs for a year pair. */
export function analyzeLandCoverChangeMap(params: LcChangeMapParams) {
  return runAnalysisJob<LcChangeMapResponse>("landcover_change_map", params, { timeoutMs: 900_000 });
}

export function identifyLandCoverPoint(params: {
  aoi: { geojson: GeoJSON.Feature | GeoJSON.FeatureCollection | GeoJSON.Geometry };
  dataset: string;
  year: number;
  latitude: number;
  longitude: number;
  start_month: number;
  end_month: number;
  start_date?: string;
  end_date?: string;
  dw_probability_threshold?: number;
}) {
  return apiClient.post<LcIdentifyResponse>("/analyze/landcover-identify", params, { auth: "app" });
}

/** POST /analyze/landcover-hotspots - ranked, vectorized change polygons (P0 hotspot detection). */
export function analyzeLandCoverHotspots(params: LcHotspotParams) {
  return runAnalysisJob<LcHotspotResponse>("landcover_hotspots", params, { timeoutMs: 900_000 });
}
