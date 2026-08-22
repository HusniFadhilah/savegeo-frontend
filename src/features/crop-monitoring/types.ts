/**
 * Crop Monitoring types, matching the live-verified backend contract
 * (savegeo/backend, FastAPI+GEE, /api/fields + /api/crop-monitoring/*).
 * Every sub-analysis result is `{available: true, ...} | {available: false,
 * reason?: string}` so callers must narrow on `.available` before reading
 * anything else - a sub-analysis can legitimately not run (no cloud-free
 * imagery, missing params, etc.), that's a normal outcome, not an error.
 */

// ---------------------------------------------------------------------------
// Field CRUD
// ---------------------------------------------------------------------------

export interface Field {
  id: number;
  name: string;
  area_ha: number;
  commodity: string;
  variety: string | null;
  planting_date: string | null;
  season_label: string | null;
  estimated_harvest_date: string | null;
  created_at: string;
  updated_at: string;
  /** Present on create/get-single, absent on the list endpoint. */
  geojson?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

export interface CreateFieldPayload {
  name: string;
  geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  commodity: string;
  variety?: string;
  planting_date?: string;
  season_label?: string;
}

export type UpdateFieldPayload = Partial<
  Pick<CreateFieldPayload, "name" | "commodity" | "variety" | "planting_date" | "season_label">
>;

export interface ListFieldsResponse {
  fields: Field[];
  count: number;
}

export interface DeleteFieldResponse {
  deleted: true;
  id: number;
}

// ---------------------------------------------------------------------------
// Static catalogs
// ---------------------------------------------------------------------------

export interface Commodity {
  key: string;
  label: string;
  category: "annual" | "perennial";
  estimated_duration_days: number;
}

export interface CommoditiesResponse {
  commodities: Commodity[];
}

export interface WeatherProvider {
  label: string;
  description: string;
  needs_key: boolean;
}

export interface WeatherProvidersResponse {
  providers: Record<string, WeatherProvider>;
  default: string;
}

// ---------------------------------------------------------------------------
// Request payload
// ---------------------------------------------------------------------------

export type CropMonitoringPeriodMode = "current_season" | "30d" | "90d" | "custom";

export interface CropMonitoringPeriodInput {
  mode: CropMonitoringPeriodMode;
  /** Required only when mode === "custom", format "YYYY-MM-DD". */
  start_date?: string;
  end_date?: string;
}

export type SubAnalysisKey =
  | "health"
  | "timeseries"
  | "anomaly"
  | "growth_stage"
  | "water_moisture"
  | "weather"
  | "flood"
  | "productivity_zones"
  | "historical_comparison"
  | "risk_score";

/** Server-side default when `sub_analyses` is omitted. "flood" and
 * "historical_comparison" are NEVER auto-included. */
export const DEFAULT_SUB_ANALYSES: SubAnalysisKey[] = [
  "health",
  "timeseries",
  "anomaly",
  "growth_stage",
  "water_moisture",
  "weather",
  "productivity_zones",
  "risk_score",
];

export interface FloodParams {
  pre_date: string;
  post_date: string;
}

export interface ProductivityZonePeriod {
  year: number;
  start_month: number;
  end_month: number;
}

export interface DataSourcesParams {
  sentinel1?: boolean;
}

export interface CropMonitoringRequest {
  field_id: number;
  period?: CropMonitoringPeriodInput;
  sub_analyses?: SubAnalysisKey[];
  cloud_threshold?: number;
  scale?: number;
  satellite?: string;
  cloud_mask_technique?: string;
  weather_source?: "gee" | "openmeteo";
  timeseries_index?: string;
  historical_years?: number;
  flood?: FloodParams;
  productivity_zone_periods?: ProductivityZonePeriod[];
  data_sources?: DataSourcesParams;
  compare_years?: number[];
}

// ---------------------------------------------------------------------------
// Sub-analysis results
// ---------------------------------------------------------------------------

export interface NdviStats {
  min: number;
  mean: number;
  max: number;
  std_dev: number;
}

export interface HealthClassInfo {
  area: number;
  percentage: number;
  color: string;
  class_value: number;
}

export interface HealthClassification {
  classes: Record<string, HealthClassInfo>;
  total_area_ha: number;
}

export type HealthLabel = "Poor" | "Moderate" | "Good";

export type HealthResult =
  | {
      available: true;
      health_label: HealthLabel;
      ndvi_mean: number;
      ndvi_stats: NdviStats;
      classification: HealthClassification | null;
      healthy_pct: number;
      moderate_pct: number;
      stressed_pct: number;
      change_vs_previous_month_pct: number | null;
      images_used: number;
      valid_pixel_pct: number;
    }
  | { available: false; reason?: string };

export interface TimeseriesPeriodPoint {
  label: string;
  date_range: { start: string; end: string } | null;
  mean: number | null;
  min: number | null;
  max: number | null;
  std_dev: number | null;
}

export type TimeseriesTrend = "naik" | "turun" | "stabil" | "insufficient_data";

export type TimeseriesResult =
  | {
      available: true;
      index: string;
      periods: TimeseriesPeriodPoint[];
      min: number;
      max: number;
      mean: number;
      median: number;
      trend: TimeseriesTrend;
      slope: number;
      anomaly_periods: string[];
      last_image_date: string | null;
    }
  | { available: false };

export type AnomalyCategory = "Normal" | "Watch" | "Moderate" | "High" | "Critical" | "Unknown";

export type AnomalyResult =
  | {
      available: true;
      current_ndvi: number;
      historical_expected_ndvi: number;
      difference_pct: number;
      affected_area_ha: number;
      category: AnomalyCategory;
      tile_url: string | null;
      historical_years_used: number;
    }
  | { available: false; reason?: string };

export type GrowthStageResult =
  | {
      available: true;
      stage: string;
      stage_key: string;
      crop_age_days: number;
      confidence: "high" | "medium" | "low" | string;
      estimated_harvest_date: string | null;
    }
  | { available: false; reason?: string };

export interface WeatherDataQuality {
  images_used: number | null;
  note: string | null;
}

export interface WeatherStats {
  source: "gee" | "openmeteo";
  period: { start: string; end: string };
  rainfall_mm_period: number;
  rainfall_mm_historical_normal: number | null;
  rainfall_deficit_pct: number | null;
  tmax: number | null;
  tmin: number | null;
  humidity: number | null;
  dry_days: number;
  data_quality: WeatherDataQuality;
}

export type WaterStressLabel = "Low" | "Moderate" | "High" | "Unknown";

export type WaterMoistureResult =
  | {
      available: true;
      ndmi_mean: number;
      moisture_stress_area_ha: number;
      rainfall: WeatherStats;
      water_stress_label: WaterStressLabel;
    }
  | { available: false; reason?: string };

export interface WeatherWarning {
  level: "warning" | string;
  message: string;
}

export type WeatherResult =
  | (WeatherStats & { available: true; warnings: WeatherWarning[] })
  | { available: false; reason?: string };

export type FloodSeverity = "Low" | "Moderate" | "High" | "Critical" | "Unknown";

export interface FloodStatistics {
  flooded_area_ha: number;
  new_inundation_ha: number;
  existing_water_ha: number;
  receded_water_ha: number;
}

export interface FloodLegendEntry {
  label: string;
  color: string;
}

export type FloodResult =
  | {
      available: true;
      tile_url: string | null;
      statistics: FloodStatistics;
      legend: FloodLegendEntry[];
      field_area_ha: number;
      flooded_pct_of_field: number | null;
      severity: FloodSeverity;
    }
  | { available: false; reason?: string };

export interface ProductivityZoneInfo {
  area_ha: number;
  percentage: number;
}

export interface ProductivityZoneWeights {
  ndvi: number;
  ndmi: number;
  sentinel1_vv?: number;
  elevation?: number;
}

export type ProductivityZonesResult =
  | {
      available: true;
      zones: Record<string, ProductivityZoneInfo>;
      tile_url: string | null;
      seasons_used: number;
      weights: ProductivityZoneWeights;
    }
  | { available: false; reason?: string };

export interface HistoricalComparisonYear {
  year: number;
  ndvi_mean: number | null;
  available: boolean;
}

export type HistoricalComparisonResult =
  | { available: true; years: HistoricalComparisonYear[]; narrative: string | null }
  | { available: false };

export type RiskLevel = "Low" | "Moderate" | "High" | "Critical" | "Unknown";

export interface RiskBreakdownItem {
  factor: string;
  score: number;
  weight: number;
  level: RiskLevel;
}

export interface RiskWeights {
  vegetation: number;
  moisture: number;
  weather: number;
  flood: number;
  growth_anomaly: number;
}

export type RiskScoreResult =
  | { available: true; score: number; level: RiskLevel; weights: RiskWeights; breakdown: RiskBreakdownItem[] }
  | { available: false };

export interface CropMonitoringSubAnalyses {
  health?: HealthResult;
  timeseries?: TimeseriesResult;
  anomaly?: AnomalyResult;
  growth_stage?: GrowthStageResult;
  water_moisture?: WaterMoistureResult;
  weather?: WeatherResult;
  flood?: FloodResult;
  productivity_zones?: ProductivityZonesResult;
  historical_comparison?: HistoricalComparisonResult;
  risk_score?: RiskScoreResult;
}

export interface CropMonitoringResolvedRange {
  year: number;
  start_month: number;
  end_month: number;
}

export interface CropMonitoringResolvedPeriod {
  start: string;
  end: string;
  mode: string;
  resolved_year_month_range: CropMonitoringResolvedRange;
}

export interface CropMonitoringSkip {
  sub_analysis: string;
  reason: string;
}

export interface CropMonitoringResult {
  field: Field;
  period: CropMonitoringResolvedPeriod;
  cloud_threshold: number;
  scale: number;
  satellite: string;
  weather_source: string;
  sub_analyses: CropMonitoringSubAnalyses;
  skipped: CropMonitoringSkip[];
}
