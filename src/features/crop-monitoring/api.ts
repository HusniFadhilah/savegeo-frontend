import { apiClient } from "@/services/apiClient";
import { runAnalysisJob } from "@/services/analysisJobs";
import type {
  CommoditiesResponse,
  CreateFieldPayload,
  CropMonitoringRequest,
  CropMonitoringResult,
  DeleteFieldResponse,
  Field,
  ListFieldsResponse,
  UpdateFieldPayload,
  WeatherProvidersResponse,
} from "./types";

// ---------------------------------------------------------------------------
// Field CRUD - all public routes, no auth header (unlike the Disaster
// Dashboard, Field/crop-monitoring routes require no login).
// ---------------------------------------------------------------------------

/** POST /fields - geojson is a bare Polygon/MultiPolygon geometry, not a
 * Feature and not wrapped in {geojson: ...} at a nested level - send it
 * exactly as the payload's `geojson` key. Returns the created Field with
 * geojson included. */
export function createField(payload: CreateFieldPayload) {
  return apiClient.post<Field>("/fields", payload);
}

/** GET /fields - list view, each Field WITHOUT geojson. */
export function listFields() {
  return apiClient.get<ListFieldsResponse>("/fields");
}

/** GET /fields/{id} - single Field WITH geojson. */
export function getField(id: number) {
  return apiClient.get<Field>(`/fields/${id}`);
}

/** PATCH /fields/{id} - never send geometry, it's immutable after creation. */
export function updateField(id: number, payload: UpdateFieldPayload) {
  return apiClient.patch<Field>(`/fields/${id}`, payload);
}

export function deleteField(id: number) {
  return apiClient.delete<DeleteFieldResponse>(`/fields/${id}`);
}

// ---------------------------------------------------------------------------
// Static catalogs - no auth, no GEE, safe to call on mount.
// ---------------------------------------------------------------------------

export function getCropMonitoringCommodities() {
  return apiClient.get<CommoditiesResponse>("/crop-monitoring/commodities");
}

export function getWeatherProviders() {
  return apiClient.get<WeatherProvidersResponse>("/crop-monitoring/weather-providers");
}

// ---------------------------------------------------------------------------
// Main analysis - GEE-backed, goes through the job queue (never a direct
// synchronous POST), same pattern as features/vegetation/api.ts.
// ---------------------------------------------------------------------------

export function runCropMonitoring(payload: CropMonitoringRequest) {
  return runAnalysisJob<CropMonitoringResult>("crop_monitoring", payload, { timeoutMs: 650_000 });
}
