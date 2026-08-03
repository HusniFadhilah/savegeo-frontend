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
}

export interface LcChangeMapParams {
  aoi: LcAoiPayload;
  dataset: LcDataset;
  from_year: number;
  to_year: number;
  start_month: number;
  end_month: number;
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
