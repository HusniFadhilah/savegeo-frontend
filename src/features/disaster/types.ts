import type { AoiFeature, MapLegendEntry } from "@/types/map";

/**
 * Types for the Disaster Mapping module, ported from
 * frontend-nextjs2/public/main.js `DisasterMapping` + `apiClient`
 * (/disaster/* endpoints). Field names mirror the backend response shapes
 * used by the legacy jQuery code (`res.data.*`) - do not rename without
 * checking the backend contract.
 */

/** Payload accepted by every /disaster/* endpoint that takes an AOI. */
export type AoiPayload =
  | { geojson: AoiFeature | GeoJSON.FeatureCollection }
  | { west: number; south: number; east: number; north: number };

export interface DisasterSourceItem {
  name: string;
  type: string;
  configured: boolean;
  official_url?: string;
  tile_url?: string;
  wms_url?: string;
  layers?: string;
}

/** GET /disaster/sources - keyed by source id (e.g. "inarisk", "demnas"). */
export type DisasterSourcesMap = Record<string, DisasterSourceItem>;

export type FirmsSourceId = "all" | "VIIRS_NOAA20_NRT" | "VIIRS_NOAA21_NRT" | "VIIRS_SNPP_NRT" | "MODIS_NRT" | "LANDSAT_NRT";
export type FirmsPeriod = "1" | "2" | "3" | "7" | "historical";
export type FirmsConfidenceLabel = "low" | "nominal" | "high";

export interface FirmsSourceMetadata {
  id: Exclude<FirmsSourceId, "all">;
  label: string;
  sensor: string;
  resolution_m: number;
  available: boolean;
  status: "configured" | "needs_key" | string;
}

export interface FirmsSourcesResponse {
  configured: boolean;
  sources: FirmsSourceMetadata[];
  wms_layers: { id: string; layer: string; available: boolean }[];
  cache_ttl_seconds: number;
  attribution: string;
}

export interface FirmsHotspotProperties {
  latitude: number;
  longitude: number;
  acq_date: string | null;
  acq_time: string;
  acq_datetime_utc: string | null;
  satellite: string | null;
  instrument: string | null;
  confidence: number | string | null;
  confidence_numeric: number | null;
  confidence_label: FirmsConfidenceLabel | null;
  frp: number | null;
  bright_ti4: number | null;
  bright_ti5: number | null;
  scan: number | null;
  track: number | null;
  daynight: string | null;
  source: string;
  source_label: string;
  resolution_m: number;
  is_near_real_time: boolean;
  raw?: Record<string, string | null>;
}

export type FirmsHotspotFeature = GeoJSON.Feature<GeoJSON.Point, FirmsHotspotProperties>;

export interface FirmsSummary {
  total_hotspots: number;
  high_confidence_hotspots: number;
  total_frp: number;
  max_frp: number;
  latest_detection_utc: string | null;
  by_day: { date: string; count: number }[];
  by_source: { source: string; count: number }[];
}

export interface FirmsFireResponse extends GeoJSON.FeatureCollection<GeoJSON.Point, FirmsHotspotProperties> {
  metadata: {
    source: FirmsSourceId | string;
    fetched_at: string;
    count: number;
    raw_count: number;
    is_near_real_time: boolean;
    cached: boolean;
    stale: boolean;
    truncated: boolean;
    errors: { source: string; message: string; status: number }[];
    summary: FirmsSummary;
    attribution: string;
    disclaimer: string;
  };
}

export interface FirmsQueryState {
  enabled: boolean;
  source: FirmsSourceId;
  period: FirmsPeriod;
  historicalDate: string;
  minConfidence: number;
  minFrp: string;
  showLabels: boolean;
  cluster: boolean;
  dayOnly: boolean;
  highOnly: boolean;
}

export interface FirmsLayerState {
  enabled: boolean;
  result: FirmsFireResponse | null;
  features: FirmsHotspotFeature[];
  showLabels: boolean;
  cluster: boolean;
}

export interface BmkgAlert {
  title?: string;
  area?: string;
  published_at?: string;
  description?: string;
}

export interface BmkgAlertsData {
  alerts: BmkgAlert[];
}

export interface DemSlopeParams {
  aoi: AoiPayload;
  scale?: number;
}

export interface DemSlopeStats {
  mean_slope_deg?: number;
  max_slope_deg?: number;
}

export interface DemSlopeResult {
  tile_url: string;
  is_official_demnas: boolean;
  source: string;
  stats?: DemSlopeStats;
  legend?: MapLegendEntry[];
}

export interface DisasterFireHotspotData {
  source: string;
  features: GeoJSON.Feature[];
  count: number;
  note: string;
}

export interface DisasterFireSamResult extends GeoJSON.FeatureCollection {
  metadata?: {
    model?: string;
    object_count?: number;
    automatic_object_count?: number;
    seed_count?: number;
    selection_method?: string;
  };
}

export interface DisasterFireSamJob {
  job_id: string;
  status: "running" | "complete" | "failed";
  message?: string;
  method?: string;
  scene_id?: string;
  scene_acquired_at?: string | null;
  scene_cloud_cover_pct?: number | null;
  seed_source?: string;
  seed_count?: number;
  result?: DisasterFireSamResult;
}

export type FireSourceId = "firms_noaa20" | "firms_noaa21" | "firms_snpp" | "firms_modis" | "bmkg" | "cdse" | "mcd64a1" | "vnp64a1" | "inarisk";

export interface FireSourceResult {
  id: FireSourceId;
  status: "ok" | "needs_key" | "no_data" | "unavailable" | "error";
  label?: string;
  message: string;
  kind?: "footprints" | "burned_area" | "hazard";
  features?: GeoJSON.Feature[];
  truncated?: boolean;
  tile_url?: string | null;
  area_ha?: number;
  resolution_m?: number;
  source?: string;
  wms_url?: string;
  wms_layers?: string;
}

export interface FireMultiSourceResponse {
  sources: FireSourceResult[];
  hotspots: GeoJSON.FeatureCollection;
  raw_count: number;
  merged_count: number;
  generated_at: string;
  period: { start: string; end: string };
  note: string;
}

export interface FireMultiSourceLayerState {
  result: FireMultiSourceResponse | null;
  visibleSources: FireSourceId[];
  showMerged: boolean;
  imported: GeoJSON.FeatureCollection | null;
  showImport: boolean;
}

export interface DisasterEventMapResponse {
  success: boolean;
  event_type: string;
  title: string;
  source: string;
  tile_url: string | null;
  before_tile_url?: string | null;
  after_tile_url?: string | null;
  area_ha: number;
  scale: number;
  before_period: { start: string; end: string };
  after_period: { start: string; end: string };
  legend: MapLegendEntry[];
  method_note: string;
  dnbr_threshold?: number;
  before_scene_count?: number;
  after_scene_count?: number;
  severity_area_ha?: {
    low_ha: number;
    moderate_ha: number;
    high_ha: number;
    very_high_ha: number;
  };
  mean_dnbr_affected?: number | null;
  max_dnbr_affected?: number | null;
  hotspots?: DisasterFireHotspotData;
}

/**
 * --- Disaster Intelligence Dashboard (redesign) types ---------------------
 * Mirrors the shapes documented in
 * `savegeo/backend/docs/disaster-redesign-contract.md` section B (User auth
 * + user disaster routes) exactly - the backend routes matching these were
 * being built in parallel, so these are coded against the doc, not against
 * backend source. Field names mirror the SQLAlchemy models' `.to_dict()`
 * output 1:1 (see `app/db/models/{disaster_event,disaster_aoi,
 * satellite_imagery,analysis_run,analysis_result,hotspot}.py`).
 */

/** `DISASTER_TYPES` in `app/db/models/disaster_event.py`. */
export type EventDisasterType =
  | "flood"
  | "landslide"
  | "forest_fire"
  | "earthquake"
  | "tsunami"
  | "volcanic_eruption"
  | "storm"
  | "drought"
  | "other";

export const EVENT_DISASTER_TYPE_LABELS: Record<EventDisasterType, string> = {
  flood: "Banjir",
  landslide: "Longsor",
  forest_fire: "Kebakaran Hutan/Lahan",
  earthquake: "Gempa Bumi",
  tsunami: "Tsunami",
  volcanic_eruption: "Erupsi Gunung Api",
  storm: "Badai/Puting Beliung",
  drought: "Kekeringan",
  other: "Lainnya",
};

export const EVENT_DISASTER_TYPE_OPTIONS: { value: EventDisasterType; label: string }[] = Object.entries(
  EVENT_DISASTER_TYPE_LABELS,
).map(([value, label]) => ({ value: value as EventDisasterType, label }));

export type EventStatus = "draft" | "processing" | "ready_for_review" | "published" | "archived";

export type EventSeverity = "low" | "medium" | "high" | "critical";

export const SEVERITY_LABELS: Record<EventSeverity, string> = {
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
  critical: "Kritis",
};

export const SEVERITY_OPTIONS: { value: EventSeverity; label: string }[] = Object.entries(SEVERITY_LABELS).map(
  ([value, label]) => ({ value: value as EventSeverity, label }),
);

/** `DisasterEvent.to_dict()`. */
export interface DisasterEventRecord {
  id: number;
  name: string;
  disaster_type: EventDisasterType | string;
  location_name: string | null;
  province: string[];
  district: string[];
  event_date: string | null;
  start_date: string | null;
  end_date: string | null;
  status: EventStatus | string;
  severity: EventSeverity | null;
  description: string | null;
  source: string | null;
  thumbnail: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** `GET /disasters` list item - event fields + published-analysis count. */
export interface DisasterEventListItem extends DisasterEventRecord {
  available_analysis_count: number;
}

export interface DisasterEventListParams {
  disaster_type?: string;
  year?: number | string;
  province?: string;
  severity?: string;
  search?: string;
}

export interface DisasterEventListResponse {
  events: DisasterEventListItem[];
}

/** `DisasterAOI.to_dict()` - read-only on the User side (no write fields). */
export interface DisasterAoiRecord {
  id: number;
  event_id: number;
  area_ha: number | null;
  centroid: { lat: number; lng: number } | null;
  bbox: [number, number, number, number] | null;
  source: string;
  created_at: string | null;
  geojson: GeoJSON.Feature | GeoJSON.Geometry;
}

/** `SatelliteImagery.to_dict()`. */
export interface SatelliteImageryRecord {
  id: number;
  event_id: number;
  phase: "pre" | "post";
  satellite: string;
  acquisition_date: string;
  sensor: string | null;
  resolution_m: number | null;
  cloud_coverage_pct: number | null;
  data_source: string | null;
  is_primary: boolean;
  preview_tile_url: string | null;
  source_kind?: "gee" | "local_upload" | string;
  created_at: string | null;
}

export interface DisasterImageryGroup {
  pre: SatelliteImageryRecord[];
  post: SatelliteImageryRecord[];
}

export interface DisasterPrimaryImagery {
  pre: SatelliteImageryRecord | null;
  post: SatelliteImageryRecord | null;
}

/** `GET /disasters/{id}`. */
export interface DisasterEventDetailResponse {
  event: DisasterEventRecord;
  aoi: DisasterAoiRecord | null;
  imagery: DisasterImageryGroup;
  primary_imagery: DisasterPrimaryImagery;
}

export type AnalysisRunStatus = "queued" | "processing" | "completed" | "failed" | "review_required" | "published";

/** `AnalysisRun.to_dict()`. */
export interface AnalysisRunRecord {
  id: number;
  event_id: number;
  model_id: string;
  model_version: string | null;
  aoi_id: number;
  pre_imagery_id: number | null;
  post_imagery_id: number | null;
  status: AnalysisRunStatus;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string | null;
}

/** `AnalysisResult.to_dict()` (`include_features` never requested by User
 * routes - features are always null/empty for the 3 MVP models anyway, see
 * contract doc's "MVP scope reality check"). */
export interface AnalysisResultRecord {
  comparison?: import("@/features/disaster/components/SegmentationComparison").SegmentationResult | null;
  id: number;
  run_id: number;
  tile_url: string | null;
  statistics: Record<string, number | string | null> | null;
  legend: MapLegendEntry[];
  confidence_summary: Record<string, number | string | null> | null;
  is_published: boolean;
  published_at: string | null;
  publication_version: number;
  created_at: string | null;
}

/** One entry per *enabled* registry model - `GET /disasters/{id}/analyses`
 * and `GET /disasters/{id}/layers` share this exact shape. */
export interface DisasterAnalysisEntry {
  model_id: string;
  user_label: string;
  category: string;
  result_semantics?: string | null;
  damage_model?: boolean;
  validation_status?: string | null;
  limitations?: string[];
  available: boolean;
  run: AnalysisRunRecord | null;
  result: AnalysisResultRecord | null;
}

export interface DisasterAnalysesResponse {
  analyses: DisasterAnalysisEntry[];
}

export interface DisasterSatelliteLayers {
  pre_tile_url: string | null;
  post_tile_url: string | null;
}

/** `GET /disasters/{id}/layers`. */
export interface DisasterLayersResponse {
  satellite: DisasterSatelliteLayers;
  analyses: DisasterAnalysisEntry[];
}

/** Only ever flood x forest per the contract doc - never fabricate other
 * combinations client-side. Extra numeric fields (e.g.
 * `forest_in_flood_extent_ha`) vary by pair, so this stays an index type. */
export interface CrossLayerStat {
  layers: string[];
  label: string;
  [key: string]: unknown;
}

/** `GET /disasters/{id}/statistics` - `kpis` flattened from each published
 * result's statistics, namespaced by model_id. */
export interface DisasterStatisticsResponse {
  event?: Pick<DisasterEventRecord, "id" | "name" | "disaster_type" | "event_date" | "start_date" | "end_date">;
  kpis: Record<string, Record<string, number | string | null>>;
  cross_layer: CrossLayerStat[];
}

/** `Hotspot.to_dict()`. */
export interface HotspotRecord {
  id: number;
  event_id: number;
  analysis_result_id: number | null;
  name: string;
  impact_level: EventSeverity | string;
  geojson: GeoJSON.Feature | GeoJSON.Geometry;
  stats: Record<string, unknown> | null;
  is_published: boolean;
  created_at: string | null;
}

export interface DisasterHotspotsResponse {
  hotspots: HotspotRecord[];
}

/** `GET /disasters/{id}/features` - always this empty shape for MVP (no
 * per-object model output exists yet); still a real endpoint so the frontend
 * doesn't need to special-case it. Not wired into any UI per the contract's
 * "MVP scope reality check" (no feature-level filter/click UI for now). */
export interface DisasterFeaturesResponse {
  features: GeoJSON.FeatureCollection;
  note: string;
}
