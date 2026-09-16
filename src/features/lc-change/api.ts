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
} from "./types";

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
  return runAnalysisJob<LcAnalyzeResponse>("landcover", params, { timeoutMs: 650_000 });
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
