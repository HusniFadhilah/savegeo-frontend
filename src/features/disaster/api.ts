import { apiClient, ApiError } from "@/services/apiClient";
import { userAuthHeader, handleUserUnauthorized } from "@/services/userAuthService";
import type {
  BmkgAlertsData,
  DemSlopeParams,
  DemSlopeResult,
  DisasterAnalysesResponse,
  DisasterEventDetailResponse,
  DisasterEventListParams,
  DisasterEventListResponse,
  DisasterFeaturesResponse,
  DisasterHotspotsResponse,
  DisasterLayersResponse,
  DisasterSourcesMap,
  DisasterStatisticsResponse,
} from "./types";

/**
 * Disaster-mapping API calls. Two families live in this file:
 *
 * 1. Legacy `/disaster/*` sources/BMKG/DEM calls (sources, bmkg-alerts,
 *    dem-slope) - unchanged endpoints, but per the redesign contract doc
 *    (section B) the backend now gates all 3 behind `Depends(get_current_user)`,
 *    so they're called with the *user* bearer token here (not `auth: true`,
 *    which only ever reads the admin token - see the module doc comment on
 *    `userGet`/`userPost` below for why).
 * 2. New `/disasters/*` (plural - NOT `/disaster`, that's the legacy router
 *    above) User-facing Disaster Intelligence Dashboard routes, per contract
 *    doc section B. Every route requires a logged-in user and only ever
 *    returns published data.
 *
 * All responses are the payload directly on 200 (never a `{success,data}`
 * envelope) and non-2xx bodies are `{error}`/`{detail}`, already thrown as
 * ApiError by apiClient - callers try/catch, never branch on `.success`.
 */

/**
 * `apiClient`'s built-in `auth: true` option is hardcoded to attach the
 * *admin* bearer token (it imports `getAuthToken` from `services/authService.ts`
 * directly) and its 401 handler is a single global slot shared app-wide. Both
 * of those are admin-owned and out of bounds for this feature (see file
 * boundary in the module report), so User-authenticated calls never use
 * `auth: true` - they attach the user's own token via a plain `headers`
 * object instead, and handle 401s locally through
 * `services/userAuthService.ts`'s own (independent) unauthorized hook. This
 * keeps admin and user sessions from ever clobbering each other: a 401 on a
 * user request never touches the admin token/handler and vice versa.
 */
async function userGet<T>(path: string): Promise<T> {
  try {
    return await apiClient.get<T>(path, { headers: userAuthHeader() });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) handleUserUnauthorized();
    throw err;
  }
}

async function userPost<T>(path: string, body?: unknown): Promise<T> {
  try {
    return await apiClient.post<T>(path, body, { headers: userAuthHeader() });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) handleUserUnauthorized();
    throw err;
  }
}

// --- legacy /disaster/* (sources / BMKG / DEM) ------------------------------

export function fetchDisasterSources() {
  return userGet<DisasterSourcesMap>("/disaster/sources");
}

export function fetchBmkgAlerts(limit = 20) {
  return userGet<BmkgAlertsData>(`/disaster/bmkg-alerts?limit=${encodeURIComponent(limit)}`);
}

export function analyzeDemSlope(params: DemSlopeParams) {
  return userPost<DemSlopeResult>("/disaster/dem-slope", params);
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
