import { apiClient } from "@/services/apiClient";
import type { HealthStatus, RegionOption } from "@/types/api";

/**
 * Cross-module helpers shared by carbon/vegetation/landcover/lc-change/
 * disaster feature services: backend health and the region-selector chain
 * (province -> city -> district -> village, plus island/Indonesia geometry).
 * Feature-specific analysis calls (run carbon model, fetch LULC classes,
 * etc.) live in each feature's own `api.ts`, not here.
 *
 * IMPORTANT: `savegeo/backend` (the FastAPI backend actually running) does
 * NOT wrap successful responses in `{success, data}` - it returns the
 * payload directly (verified against app/api/routes/regions.py and live
 * curl). Errors come back as non-2xx with `{error: "..."}` (apiClient
 * already throws ApiError for those). Functions here return the final
 * usable shape directly, not a raw response envelope - do not add `.data`
 * unwrapping at call sites.
 */
export function fetchHealth() {
  return apiClient.get<HealthStatus>("/health");
}

/** GET /regions/provinces returns a flat {name: code} dict (proxied from an external admin-boundary API). */
type RegionDropdownDict = Record<string, string>;

function toRegionOptions(dict: RegionDropdownDict): RegionOption[] {
  return Object.entries(dict).map(([name, code]) => ({ code, name }));
}

export async function fetchProvinces(islandFilter?: string): Promise<RegionOption[]> {
  const suffix = islandFilter ? `?island=${encodeURIComponent(islandFilter)}` : "";
  const dict = await apiClient.get<RegionDropdownDict>(`/regions/provinces${suffix}`);
  return toRegionOptions(dict);
}

export function fetchCities(provinceCode: string): Promise<RegionOption[]> {
  return apiClient
    .get<RegionDropdownDict>(`/regions/cities?province_code=${encodeURIComponent(provinceCode)}`)
    .then(toRegionOptions);
}

export function fetchDistricts(cityCode: string): Promise<RegionOption[]> {
  return apiClient
    .get<RegionDropdownDict>(`/regions/districts?city_code=${encodeURIComponent(cityCode)}`)
    .then(toRegionOptions);
}

export function fetchVillages(districtCode: string): Promise<RegionOption[]> {
  return apiClient
    .get<RegionDropdownDict>(`/regions/villages?district_code=${encodeURIComponent(districtCode)}`)
    .then(toRegionOptions);
}

/** GET /regions/islands returns [{name, label}] - `name` is the key used for the geometry endpoint, `label` is display text. */
interface IslandDto {
  name: string;
  label: string;
}

export async function fetchIslands(): Promise<RegionOption[]> {
  const islands = await apiClient.get<IslandDto[]>("/regions/islands");
  return islands.map((i) => ({ code: i.name, name: i.label }));
}

/** GET /regions/islands/{name}/geometry and /regions/indonesia/geometry return the raw GeoJSON object directly. */
export function fetchIslandGeometry(islandName: string): Promise<GeoJSON.GeoJSON> {
  return apiClient.get<GeoJSON.GeoJSON>(`/regions/islands/${encodeURIComponent(islandName)}/geometry`);
}

export function fetchIndonesiaGeometry(): Promise<GeoJSON.GeoJSON> {
  return apiClient.get<GeoJSON.GeoJSON>("/regions/indonesia/geometry");
}

/**
 * GET /regions/geometry passes through the upstream admin-boundary API's response
 * unmodified (matches the legacy Flask contract) - in practice this is usually a
 * FeatureCollection, not a bare Geometry. Callers must normalize via
 * AoiRegionTab's `toFeature()` (or equivalent) before using it as an AOI.
 */
export function fetchRegionGeometry(endpoint: string, code: string): Promise<GeoJSON.GeoJSON> {
  return apiClient.get<GeoJSON.GeoJSON>(
    `/regions/geometry?endpoint=${encodeURIComponent(endpoint)}&code=${encodeURIComponent(code)}`,
  );
}

/**
 * Load all child administrative boundaries for one parent. The backend keeps
 * this request cached and falls back to fetching each child only when the
 * upstream API does not expose a bulk geometry response.
 */
export function fetchRegionChildrenGeometries(
  parentCode: string,
  childEndpoint: "city" | "district" | "village",
  parentEndpoint?: "province" | "city" | "district",
): Promise<GeoJSON.FeatureCollection> {
  const params = new URLSearchParams({ parent_code: parentCode, child_endpoint: childEndpoint });
  if (parentEndpoint) params.set("parent_endpoint", parentEndpoint);
  return apiClient.get<GeoJSON.FeatureCollection>(`/regions/children-geometries?${params.toString()}`);
}

/** One Nominatim search result from GET /utils/geocode/search - a free-text
 * place lookup (city/province/district/village/street/address, like Google
 * Maps' search box), restricted to Indonesia. `geojson` is the real
 * admin-boundary polygon when Nominatim has one (usually true for
 * administrative areas, absent for a plain street address); `bbox` is
 * always present as a fallback rectangle. */
export interface LocationSearchResult {
  osm_id: number;
  lat: number;
  lng: number;
  display_name: string;
  type: string;
  class_: string;
  bbox: [number, number, number, number] | null;
  geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  address_info: { province: string; city: string; district: string; village: string };
}

export async function searchLocations(query: string): Promise<LocationSearchResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const res = await apiClient.get<{ results: LocationSearchResult[] }>(
      `/utils/geocode/search?q=${encodeURIComponent(q)}&limit=8`,
    );
    return res?.results ?? [];
  } catch {
    return [];
  }
}
