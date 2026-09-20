import { apiClient, ApiError } from "@/services/apiClient";
import { handleAppUnauthorized } from "@/services/appSession";
import type { AoiPayload } from "./types";
import type {
  BmkgAlertsData,
  DemSlopeParams,
  DemSlopeResult,
  DisasterAnalysesResponse,
  DisasterEventDetailResponse,
  DisasterFireSamJob,
  FireMultiSourceResponse,
  FireSourceId,
  DisasterEventMapResponse,
  DisasterEventListParams,
  DisasterEventListResponse,
  DisasterFeaturesResponse,
  DisasterHotspotsResponse,
  DisasterLayersResponse,
  DisasterSourcesMap,
  DisasterStatisticsResponse,
  FirmsFireResponse,
  WindLayerResponse,
  FirmsSourceId,
  FirmsSourcesResponse,
} from "./types";
import type { WildfireEventsResponse, WildfireHotspotsResponse } from "@/features/karhutla/types";

/**
 * Disaster-mapping API calls. Two families live in this file:
 *
 * 1. Legacy `/disaster/*` sources/BMKG/DEM/on-demand event-map calls - gated
 *    behind a disaster-viewer token (public user or admin).
 * 2. New `/disasters/*` (plural - NOT `/disaster`, that's the legacy router
 *    above) Disaster Intelligence Dashboard routes. Every route requires a
 *    logged-in user or admin and only ever returns published data.
 *
 * All responses are the payload directly on 200 (never a `{success,data}`
 * envelope) and non-2xx bodies are `{error}`/`{detail}`, already thrown as
 * ApiError by apiClient - callers try/catch, never branch on `.success`.
 */

/**
 * Prefer the public user token when present; otherwise fall back to admin
 * auth (`auth: true`) so an already logged-in admin can inspect the published
 * disaster dashboard without a duplicate user account. User 401s still clear
 * only the user session; admin 401s use apiClient's existing admin handler.
 */
async function userGet<T>(path: string): Promise<T> {
  try {
    return await apiClient.get<T>(path, { auth: "app" });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) handleAppUnauthorized();
    throw err;
  }
}

async function userPost<T>(path: string, body?: unknown): Promise<T> {
  try {
    return await apiClient.post<T>(path, body, { auth: "app" });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) handleAppUnauthorized();
    throw err;
  }
}

// --- legacy /disaster/* (sources / BMKG / DEM) ------------------------------

export function fetchDisasterSources() {
  return userGet<DisasterSourcesMap>("/disaster/sources");
}

export function fetchFirmsSources() {
  return userGet<FirmsSourcesResponse>("/disaster/firms/sources");
}

export function fetchWindLayer(params: { west: number; south: number; east: number; north: number; date?: string }) {
  const qs = buildQuery(params);
  return userGet<WindLayerResponse>(`/disaster/wind${qs}`);
}

export function fetchFirmsFires(params: {
  source: FirmsSourceId;
  day_range: number;
  date?: string;
  west: number;
  south: number;
  east: number;
  north: number;
  min_confidence?: number;
  min_frp?: number;
  limit?: number;
}) {
  const qs = buildQuery({ ...params, source: params.source });
  return userGet<FirmsFireResponse>(`/disaster/firms/fires${qs}`);
}

export function fetchBmkgAlerts(limit = 20) {
  return userGet<BmkgAlertsData>(`/disaster/bmkg-alerts?limit=${encodeURIComponent(limit)}`);
}

export function analyzeDemSlope(params: DemSlopeParams) {
  return userPost<DemSlopeResult>("/disaster/dem-slope", params);
}

export function analyzeDisasterEvent(params: {
  aoi: AoiPayload;
  event_type: "fire" | "flood" | "landslide";
  before_start: string;
  before_end: string;
  after_start: string;
  after_end: string;
  dnbr_threshold?: number;
  scale?: number;
}) {
  return userPost<DisasterEventMapResponse>("/disaster/event-map", params);
}

export function startFireSamSegmentation(params: {
  aoi: AoiPayload;
  start_date: string;
  end_date: string;
  max_cloud_cover?: number;
  seed_radius_px?: number;
}) {
  return userPost<DisasterFireSamJob>("/disaster/fire-sam/jobs", params);
}

export function fetchFireSamSegmentationJob(jobId: string) {
  return userGet<DisasterFireSamJob>(`/disaster/fire-sam/jobs/${encodeURIComponent(jobId)}`);
}

export function loadFireMultiSource(params: { aoi: AoiPayload; start_date: string; end_date: string; sources: FireSourceId[] }) {
  return userPost<FireMultiSourceResponse>("/disaster/fire-multi-source", params);
}

export function fetchFireBigBoundaries(province: string, city?: string) {
  return userPost<GeoJSON.FeatureCollection>("/disaster/fire-big-boundaries", { province, city });
}

export function importFireObservations(content: string, format: "csv" | "geojson") {
  return userPost<GeoJSON.FeatureCollection>("/disaster/fire-import", { content, format, source: "SIPONGI / impor pengguna" });
}

// --- new /disasters/* (Disaster Intelligence Dashboard) --------------------

function buildQuery(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") usp.set(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

export function fetchDisasterEvents(params: DisasterEventListParams = {}) {
  const qs = buildQuery({
    disaster_type: params.disaster_type,
    year: params.year,
    province: params.province,
    severity: params.severity,
    search: params.search,
  });
  return userGet<DisasterEventListResponse>(`/disasters${qs}`);
}

export function fetchDisasterEvent(eventId: number | string) {
  return userGet<DisasterEventDetailResponse>(`/disasters/${eventId}`);
}

export function fetchDisasterAnalyses(eventId: number | string) {
  return userGet<DisasterAnalysesResponse>(`/disasters/${eventId}/analyses`);
}

export function fetchDisasterLayers(eventId: number | string) {
  return userGet<DisasterLayersResponse>(`/disasters/${eventId}/layers`);
}

export function fetchDisasterStatistics(eventId: number | string) {
  return userGet<DisasterStatisticsResponse>(`/disasters/${eventId}/statistics`);
}

export function fetchDisasterHotspots(eventId: number | string) {
  return userGet<DisasterHotspotsResponse>(`/disasters/${eventId}/hotspots`);
}

/**
 * Defined for contract completeness (route shape is future-proof per the
 * doc) but deliberately not called anywhere in this MVP UI - see the
 * contract doc's "MVP scope reality check": no per-feature data exists yet,
 * so there is nothing to build a filter/click UI against.
 */
export function fetchDisasterFeatures(eventId: number | string, params: { analysis?: string; bbox?: string } = {}) {
  const qs = buildQuery({ analysis: params.analysis, bbox: params.bbox });
  return userGet<DisasterFeaturesResponse>(`/disasters/${eventId}/features${qs}`);
}

// --- standalone wildfire explorer ----------------------------------------

export function fetchWildfireEvents(params: {
  search?: string;
  year?: string;
  status?: string;
  province?: string;
  severity?: string;
  sort?: string;
} = {}) {
  const qs = buildQuery(params);
  return userGet<WildfireEventsResponse>(`/disasters/wildfires/events${qs}`);
}

export function fetchWildfireEvent(slug: string) {
  return userGet<{ event: import("@/features/karhutla/types").WildfireEvent }>(
    `/disasters/wildfires/events/${encodeURIComponent(slug)}`,
  );
}

export function fetchWildfireSummary(slug: string, query: Record<string, string | undefined> = {}) {
  return userGet<import("@/features/karhutla/types").WildfireSummary>(
    `/disasters/wildfires/events/${encodeURIComponent(slug)}/summary${buildQuery(query)}`,
  );
}

export function fetchWildfireHotspots(slug: string, query: Record<string, string | number | undefined> = {}) {
  return userGet<WildfireHotspotsResponse>(
    `/disasters/wildfires/events/${encodeURIComponent(slug)}/hotspots${buildQuery(query)}`,
  );
}

export function syncWildfireHotspots(slug: string, payload: { from_date?: string; to_date?: string } = {}) {
  return apiClient.post<{ stored: number; fetched: number; from: string; to: string; errors: { source: string; message: string; status: number }[] }>(
    `/admin/disasters/wildfires/${encodeURIComponent(slug)}/sync`,
    payload,
    { auth: "admin", timeoutMs: 180_000 },
  );
}

export function fetchWildfireTimeline(slug: string, query: Record<string, string | undefined> = {}) {
  return userGet<{ timeline: { date: string; count: number }[] }>(
    `/disasters/wildfires/events/${encodeURIComponent(slug)}/timeline${buildQuery(query)}`,
  );
}
