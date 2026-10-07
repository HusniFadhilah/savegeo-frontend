import type { FirmsHotspotFeature } from "@/features/disaster/types";

export type WildfireStatus = "active" | "monitoring" | "completed" | "archived";
export type WildfireConfidence = "low" | "nominal" | "high";

export interface WildfireEvent {
  id: number | string;
  slug: string;
  title: string;
  short_title: string;
  description: string;
  disaster_type: "forest_fire";
  status: WildfireStatus;
  start_date: string;
  end_date: string | null;
  monitoring_from: string;
  monitoring_to: string | null;
  published_at: string | null;
  last_data_at: string | null;
  last_synced_at: string | null;
  year: number;
  country_code: string;
  province_codes: string[];
  city_codes: string[];
  provinces: string[];
  bbox: [number, number, number, number];
  center_lat: number;
  center_lon: number;
  default_zoom: number;
  thumbnail: string | null;
  severity: "low" | "medium" | "high" | "critical";
  source_ids: string[];
  source: string;
  boundary_source: string | null;
  methodology: string | null;
  limitations: string[];
  is_featured: boolean;
  is_public: boolean;
  hotspot_count: number;
  high_confidence_count: number;
  burned_area_ha: number | null;
  burned_area_source: string | null;
  updated_at: string | null;
}
export interface WildfireSummary {
  total_hotspots: number;
  high_confidence_hotspots: number;
  nominal_confidence_hotspots: number;
  low_confidence_hotspots: number;
  affected_regions: number;
  total_frp: number | null;
  average_frp: number | null;
  latest_acquisition_time: string | null;
  burned_area_ha: number | null;
  burned_area_source: string | null;
  previous_period_change_pct: number | null;
}

export interface WildfireTimelinePoint {
  date: string;
  count: number;
}

export type WildfireTimelineChart = "bar" | "line" | "area";
export type WildfireTimelineSort = "date-asc" | "date-desc" | "count-desc" | "count-asc";

export interface WildfireEventsResponse {
  events: WildfireEvent[];
  updated_at: string | null;
  total: number;
}

export interface WildfireHotspotsResponse {
  features: FirmsHotspotFeature[];
  summary: WildfireSummary;
  timeline?: WildfireTimelinePoint[];
  metadata: {
    source: string;
    storage?: "database" | "curated" | string;
    fetched_at: string;
    last_synced_at?: string | null;
    total_features?: number;
    returned_features?: number;
    truncated_for_map?: boolean;
    features_included?: boolean;
    stale: boolean;
    attribution: string;
    disclaimer: string;
  };
}

export type WildfireRegionLevel = "province" | "city" | "district" | "village";

export interface WildfireRegionStatistic {
  code: string;
  name: string;
  hotspot_count: number;
  high_confidence_count: number;
}

export interface WildfireRegionStatisticsResponse {
  level: WildfireRegionLevel;
  parent_code: string | null;
  total_hotspots: number;
  regions: WildfireRegionStatistic[];
  attribution: string;
}

export interface WildfireCamsProduct {
  id: string;
  label: string;
  dataset_id: string;
  source_url: string;
  provider: string;
  license: string;
  doi: string;
  resolution_degrees: number;
  spatial_coverage: string;
  time_basis: string;
  products?: Array<{
    version: string;
    coverage_start: string;
    coverage_end: string | null;
    temporal_steps: string[];
    notes: string;
  }>;
  variables: Record<string, {
    label: string;
    symbol: string;
    source_name: string;
    unit: string;
    kind: string;
    temporal_resolution_hours?: number;
    vertical_product?: string;
  }>;
  method: string;
  data_kind: string;
  initialization_hours_utc?: number[];
  forecast_horizon_hours?: number;
  single_level_step_hours?: number;
}

export interface WildfireCamsCapabilities {
  status:
    | "invalid_configuration"
    | "needs_credentials"
    | "needs_terms_acceptance"
    | "upstream_validation_blocked"
    | "ready";
  credentials_configured: boolean;
  terms_accepted_by_operator: boolean;
  provider_ready: boolean;
  data_available: boolean;
  blocked_reason: string | null;
  integration_stage: string;
  products: WildfireCamsProduct[];
  attribution: string;
  disclaimer: string;
}

export interface WildfireFilters {
  search: string;
  year: string;
  status: string;
  province: string;
  severity: string;
  sort: "latest" | "hotspots" | "region";
}

export interface CamsSummary {
  unit: string;
  valid_cell_count: number;
  missing_cell_count: number;
  integrated_mass_kg?: number | null;
  area_weighted_mean?: number | null;
  maximum?: number | null;
}

export interface CamsFrame {
  id: string;
  version: string;
  valid_at: string;
  interval_end: string | null;
  forecast_reference_time: string | null;
  leadtime_hours: number | null;
  is_forecast: boolean;
  sha256: string;
  summary: CamsSummary;
  regions: Array<{ code: string; name: string; summary: CamsSummary }>;
  provenance: { source_url: string; source_unit: string; source_valid_at: string; retrieved_at: string; fire_only: boolean };
}

export interface CamsArchive {
  event_slug: string;
  updated_at: string;
  bbox: [number, number, number, number];
  layers: Record<string, {
    product: string;
    variable: string;
    source_unit: string;
    display_unit: string;
    palette: string[];
    resolution_degrees: number;
    maximum: number;
    rendering?: { minimum: number; maximum: number; interpolation: "bilinear" | "nearest" };
    frames: CamsFrame[];
  }>;
}

export interface CamsPointSample {
  layer_id: string;
  frame_id: string;
  product: string;
  valid_at: string;
  interval_end: string | null;
  is_forecast: boolean;
  forecast_reference_time: string | null;
  leadtime_hours: number | null;
  data_available: boolean;
  reason: "outside_coverage" | "nodata" | null;
  value: number | null;
  unit: string;
  source_value: number | null;
  source_unit: string;
  center: { lat: number; lon: number } | null;
  cell_area_km2: number | null;
  mass_tonnes: number | null;
}

export interface CamsAggregateSummary {
  valid_cell_count: number;
  missing_cell_count: number;
  maximum: number | null;
  area_weighted_mean: number | null;
  integrated_mass_kg: number | null;
  unit: string;
  duration_seconds: number | null;
  area_km2: number;
}

export interface CamsGridAggregate extends GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon> {
  features: Array<GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, { value: number; unit: string }>>;
  summary: CamsAggregateSummary;
  maximum: number;
  unit: string;
}

export interface CamsAreaAggregate {
  summary: CamsAggregateSummary;
  unit: string;
}
