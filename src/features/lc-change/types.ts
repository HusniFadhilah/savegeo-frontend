import type { AoiFeature } from "@/types/map";

/**
 * Dataset ids accepted by POST /analyze/landcover (and change-map). Widened
 * from a fixed 6-value union to `string` - the actual catalog is fetched
 * live from GET /landcover/datasets (16 datasets as of writing, same
 * endpoint the Landcover feature already calls via
 * `features/landcover/api.ts`'s `fetchLandCoverDatasets()`), so pinning the
 * type to a stale hardcoded list would fight the dynamic dropdown.
 */
export type LcDataset = string;

export interface LcClassInfo {
  area: number;
  percentage: number;
  color: string;
}

/** Dynamic World per-pixel classification-confidence summary (see backend `_dw_confidence_stats`). */
export interface LcDwConfidence {
  mean_confidence: number | null;
  min_confidence: number | null;
  low_confidence_threshold: number;
  low_confidence_pixel_pct: number | null;
}

/** One dataset bucket as returned by POST /analyze/landcover, keyed by dataset id. */
export interface LcYearResult {
  classes: Record<string, LcClassInfo>;
  tile_url: string | null;
  total_area_ha: number;
  year: number;
  requested_year?: number;
  resolution?: string;
  dataset_name?: string;
  date_range?: { start: string; end: string };
  fallback_reason?: string | null;
  /** Dynamic World only - the probability threshold actually applied (null = no threshold). */
  dw_probability_threshold?: number | null;
  /** Dynamic World only - present regardless of whether a threshold was applied. */
  confidence?: LcDwConfidence | null;
  /** Dynamic World only - non-null when the requested window starts before
   * the collection's first image (2015-06-27) or extends past today (YTD). */
  coverage_note?: string | null;
}

/** Response body of POST /analyze/landcover - flat dict keyed by dataset id (not success/data wrapped). */
export type LcAnalyzeResponse = Partial<Record<LcDataset, LcYearResult>>;

export interface LcAoiPayload {
  geojson: GeoJSON.Feature | GeoJSON.FeatureCollection | GeoJSON.Geometry;
}

export interface LcAnalyzeParams {
  aoi: LcAoiPayload;
  year: number;
  datasets: LcDataset[];
  start_month: number;
  end_month: number;
  /** "Mode Tanggal Analisis: Tanggal" - explicit day-level window (Dynamic World
   * only; other datasets always use the full `year` regardless). Backend derives
   * `year` from `start_date` itself when both are given - see analyze_landcover. */
  start_date?: string;
  end_date?: string;
  /** Dynamic World only - min per-pixel class probability to keep (0-1). Omit/undefined = no threshold (backend default). */
  dw_probability_threshold?: number;
}

export interface LcChangeMapParams {
  aoi: LcAoiPayload;
  dataset: LcDataset;
  from_year: number;
  to_year: number;
  start_month: number;
  end_month: number;
  /** Same day-level window as LcAnalyzeParams, reapplied to both from_year and
   * to_year (only the month/day portion is used - see backend _reyear_date). */
  start_date?: string;
  end_date?: string;
  /** Dynamic World only - min per-pixel class probability to keep (0-1). */
  dw_probability_threshold?: number;
}

/** Response body of POST /analyze/landcover-change-map (flat dict, not success/data wrapped). */
export interface LcChangeMapResponse {
  dataset: LcDataset;
  dataset_name: string;
  from_year: number;
  to_year: number;
  from_effective_year: number;
  to_effective_year: number;
  resolution: string;
  changed_tile_url: string | null;
  destination_tile_url: string | null;
  from_tile_url: string | null;
  to_tile_url: string | null;
  changed_area_ha: number;
  stable_area_ha: number;
  changed_percentage: number;
  stable_percentage: number;
}

export interface LcIdentifyResponse {
  dataset: LcDataset;
  dataset_name: string;
  year: number;
  effective_year?: number;
  latitude: number;
  longitude: number;
  class_value: number | null;
  class_name: string | null;
  color: string | null;
  area_ha: number | null;
  percentage: number | null;
  total_area_ha: number | null;
}

/**
 * Overlay mode for the "after" map panel. The legacy module had one shared
 * map with 4 modes (changed/destination/before/after); this port uses two
 * always-visible panels (before=yearA, after=yearB raw classification is
 * already the "before"/"after" modes), so the toggle only needs to add an
 * extra overlay on the after panel: "normal" (no overlay, just yearB's raw
 * classification), "changed" (red highlight of changed pixels), or
 * "destination" (destination-class colors on changed pixels only).
 */
export type ChangeMapMode = "normal" | "changed" | "destination";

export interface LcHotspotParams {
  aoi: LcAoiPayload;
  dataset: LcDataset;
  from_year: number;
  to_year: number;
  start_month: number;
  end_month: number;
  /** Coarser than the classification's native resolution (default 3x) - keeps reduceToVectors fast. */
  vector_scale?: number;
  /** Drop connected-component slivers smaller than this before ranking (default 1 ha). */
  min_area_ha?: number;
  /** Cap on ranked results returned (default 20, max 100). */
  top_n?: number;
  /** Same day-level window as LcChangeMapParams (reapplied per from_year/to_year). */
  start_date?: string;
  end_date?: string;
  /** Dynamic World only - min per-pixel class probability to keep (0-1). */
  dw_probability_threshold?: number;
}

export interface LcClassBadge {
  value: number;
  label: string;
  color: string;
}

/** One ranked change polygon from POST /analyze/landcover-hotspots. */
export interface LcHotspot {
  area_ha: number;
  from_class: LcClassBadge;
  to_class: LcClassBadge;
  centroid: [number, number] | null;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  /** Mean Dynamic World classification confidence (0-1) for this polygon, null for datasets with no per-pixel confidence source. */
  confidence: number | null;
}

/** Response body of POST /analyze/landcover-hotspots (flat dict, not success/data wrapped). */
export interface LcHotspotResponse {
  dataset: LcDataset;
  dataset_name: string;
  from_year: number;
  to_year: number;
  from_effective_year: number;
  to_effective_year: number;
  resolution: string;
  vector_scale: number;
  min_area_ha: number;
  hotspot_count: number;
  confidence_available: boolean;
  hotspots: LcHotspot[];
}

export interface TransitionData {
  matrix: Record<string, Record<string, number>>;
  allClasses: string[];
  gains: Record<string, number>;
  losses: Record<string, number>;
}

export interface YearRow {
  id: string;
  year: number;
}

export interface LcModuleState {
  aoi: AoiFeature | null;
  dataset: LcDataset;
  years: number[];
  startMonth: number;
  endMonth: number;
  yearData: Record<number, LcYearResult>;
  activeYears: number[];
}
