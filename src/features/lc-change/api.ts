import { apiClient } from "@/services/apiClient";
import type {
  LcAnalyzeParams,
  LcAnalyzeResponse,
  LcChangeMapParams,
  LcChangeMapResponse,
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
  return apiClient.post<LcAnalyzeResponse>("/analyze/landcover", params);
}

/** POST /analyze/landcover-change-map - pixel-level diff + tile URLs for a year pair. */
export function analyzeLandCoverChangeMap(params: LcChangeMapParams) {
  return apiClient.post<LcChangeMapResponse>("/analyze/landcover-change-map", params);
}

/** POST /analyze/landcover-hotspots - ranked, vectorized change polygons (P0 hotspot detection). */
export function analyzeLandCoverHotspots(params: LcHotspotParams) {
  return apiClient.post<LcHotspotResponse>("/analyze/landcover-hotspots", params);
}
