import { apiClient } from "@/services/apiClient";
import type {
  BmkgAlertsData,
  DemSlopeParams,
  DemSlopeResult,
  DisasterSourcesMap,
  EventMapParams,
  EventMapResult,
} from "./types";

/**
 * Disaster-mapping API calls -> GET /disaster/sources, GET /disaster/
 * bmkg-alerts?limit=, POST /disaster/dem-slope, POST /disaster/event-map.
 * All four return their payload directly (verified against
 * app/services/disaster_service.py) - no {success,data} envelope. dem-slope
 * and event-map happen to include a flat `success: true` field alongside
 * their real data fields (not nested under `.data`); sources/bmkg-alerts
 * don't even have that. Errors are non-2xx `{error: "..."}`, already thrown
 * as ApiError by apiClient - callers should try/catch, not branch on
 * `.success`.
 */

export function fetchDisasterSources() {
  return apiClient.get<DisasterSourcesMap>("/disaster/sources");
}

export function fetchBmkgAlerts(limit = 20) {
  return apiClient.get<BmkgAlertsData>(`/disaster/bmkg-alerts?limit=${encodeURIComponent(limit)}`);
}

export function analyzeDemSlope(params: DemSlopeParams) {
  return apiClient.post<DemSlopeResult>("/disaster/dem-slope", params);
}

export function analyzeDisasterEvent(params: EventMapParams) {
  return apiClient.post<EventMapResult>("/disaster/event-map", params);
}
