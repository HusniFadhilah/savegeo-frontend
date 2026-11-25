export interface GreenRankingRow {
  code: string;
  name: string;
  rank: number | null;
  eligible: boolean;
  province?: string;
  city?: string;
  district?: string;
  area_ha?: number;
  valid_area_ha?: number;
  green_area_ha?: number;
  green_percent?: number;
  coverage_percent?: number;
  error?: string;
  classes_ha?: Record<string, number | null>;
  /** Area-weighted carbon reference density in Mg C/ha. */
  agb_mg_c_ha?: number | null;
  bgb_mg_c_ha?: number | null;
  soc_mg_c_ha?: number | null;
  litter_mg_c_ha?: number | null;
  deadwood_mg_c_ha?: number | null;
  /** Integrated stocks across valid pixels in Mg C. */
  agb_total_mg_c?: number | null;
  bgb_total_mg_c?: number | null;
  soc_total_mg_c?: number | null;
  litter_total_mg_c?: number | null;
  deadwood_total_mg_c?: number | null;
  carbon_pool_sources?: Record<string, {
    dataset: string;
    name?: string;
    source_year?: number | null;
    estimate_year?: number | null;
    reference_year?: number | null;
    source_period?: string;
    resolution_m?: number | null;
    status: string;
    coverage_type?: string;
    valid_coverage_percent?: number | null;
    total_scope?: string;
    source_url?: string;
    method?: string;
    formula?: string;
  }>;
}
export interface GreenRankingResult {
  run_id: string;
  done: boolean;
  cursor: string;
  status: "complete" | "partial";
  config: { level: string; year: number; start_month: number; end_month: number; scale: number };
  page: number;
  page_size: number;
  records_total?: number;
  records_filtered?: number;
  search?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  snapshot_saved_at?: string;
  snapshot_refresh_due?: boolean;
  rows: GreenRankingRow[];
  statistics: {
    processed: number;
    eligible: number;
    area_ha: number;
    valid_area_ha: number;
    green_area_ha: number;
    mean_percent: number | null;
    min_percent: number | null;
    max_percent: number | null;
    median_percent?: number | null;
    std_dev_percent?: number | null;
    area_weighted_green_percent: number | null;
    failed_geometry?: number;
    trees_ha?: number;
    grass_ha?: number;
    crops_ha?: number;
    shrubs_ha?: number;
    flooded_ha?: number;
    histogram?: { from_percent: number; to_percent: number; count: number }[];
  };
  method: string;
  boundary_source: string;
  source_url: string;
}

export interface GreenRankingHistoryPoint {
  year: number;
  rank?: number | null;
  green_percent: number | null;
}

export interface GreenRankingHistoryRegion {
  code: string;
  name: string;
  points: GreenRankingHistoryPoint[];
}

export interface GreenRankingHistoryYear {
  year: number;
  snapshot_saved_at: string;
  eligible_regions: number;
  top10: GreenRankingRow[];
}

export interface GreenRankingHistory {
  selected_year: number;
  cohort_year: number | null;
  available_years: number[];
  years: GreenRankingHistoryYear[];
  trend: GreenRankingHistoryRegion[];
  period: { start_month: number; end_month: number; level: string };
}
