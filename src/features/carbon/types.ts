/** AoiState/AoiSource moved to @/hooks/useAoiStore (shared cross-module store,
 * mirrors legacy `currentAOI` from main.js) - re-exported here so existing
 * `from "@/features/carbon/types"` imports keep working. */
export type { AoiState, AoiSource } from "@/hooks/useAoiStore";

export type AnalysisType = "landcover" | "vegetation" | "carbon" | "combined";

export type ClipMode = "clipped" | "full";

export interface CarbonReferenceDatasetOption {
  value: string;
  label: string;
  group: string;
  description: string;
  year?: number | string | null;
  yearRange?: number[] | string | null;
  availableYears?: number[] | null;
  selectionYear?: number | null;
  yearSelectable?: boolean;
  deprecated?: boolean;
  replacementKey?: string | null;
  compatibleModelCount?: number;
  isConfigured?: boolean;
  requiresConfiguration?: boolean;
  availabilityError?: string | null;
  ingestionMethod?: string | null;
  referenceOnlyCapable?: boolean;
  source?: "api" | "fallback";
}

export interface CarbonModelCvMetrics {
  n_folds?: number;
  cv_folds?: number;
  rmse_mean?: number;
  rmse_std?: number;
  r2_mean?: number;
  r2_std?: number;
  mae_mean?: number;
  mae_std?: number;
}

/** Per-run data-quality/uncertainty signal (P0), distinct from the model's own
 * training-time cv_metrics: this describes *this specific* AOI/date-range
 * composite, not the model in general. See backend carbon_service.analyze_carbon. */
export interface CarbonDataQuality {
  valid_pixel_pct: number | null;
  gap_filled: boolean | null;
  images_used: number | null;
  /** Spatial variability inside the AOI (std_dev/mean * 100), not a formal
   * confidence interval - imagery pixels are spatially correlated, so a CI
   * assuming independent samples would overstate precision. */
  coefficient_of_variation_pct: number | null;
  model_r2: number | null;
  model_rmse: number | null;
}

export interface CarbonModelMeta {
  provider?: string;
  gee_deployable?: boolean;
  gee_algorithm_type?: string;
  preliminary?: boolean;
  algorithm?: string;
  trained_at?: string;
  n_samples?: number;
  cv_metrics?: CarbonModelCvMetrics;
  feature_importance?: Record<string, number>;
  [key: string]: unknown;
}

export interface CarbonModelListItem {
  name: string;
  algorithm?: string;
  uploaded_at?: string;
  metrics?: { cv_metrics?: CarbonModelCvMetrics; r2_mean?: number };
  metadata_json?: CarbonModelMeta;
}

export interface CarbonModelInfo {
  name?: string;
  algorithm?: string;
  version?: string;
  trained_at?: string;
  n_samples?: number;
  cv_metrics?: CarbonModelCvMetrics;
  metrics?: { cv_metrics?: CarbonModelCvMetrics; n_samples?: number; trained_at?: string };
  metadata_json?: CarbonModelMeta;
  feature_importance?: Record<string, number>;
}

export interface CarbonParams {
  year: number;
  startMonth: number;
  endMonth: number;
  cloudThreshold: number;
  clipMode: ClipMode;
  referenceDataset: string;
  datasetYear: number;
  modelName: string | null;
  showReference: boolean;
  /** "scl" | "qa60" | "s2cloudless" - see GET /vegetation/cloud-mask-techniques (shared catalog). */
  cloudMaskTechnique: string;
  /** Run the selected reference directly, without a trained model. */
  referenceOnly: boolean;
  /** Load the selected reference layer only; skip statistics, area, and model inference. */
  loadOnly: boolean;
}

export interface CarbonStats {
  min?: number;
  mean?: number;
  max?: number;
  std_dev?: number;
}

export interface CarbonLayerResult {
  tile_url?: string;
  statistics?: CarbonStats | null;
  unit?: string;
  vis_params?: {
    min?: number;
    max?: number;
    palette?: string[];
  };
  inference_mode?: string;
}

export interface CarbonReferenceInfo {
  name?: string;
  full_name?: string;
  resolution?: number;
  year?: number | string;
  tile_url?: string;
  /** Registry notes - for several datasets (e.g. ESA_CCI) this is the only
   * place the AGB→carbon conversion factor (×0.47) is documented; the
   * backend has always sent it, the UI just never rendered it. */
  description?: string;
}

export interface CarbonAreaInfo {
  area_ha?: number | null;
  calculation_area_ha?: number | null;
  filtering_area_ha?: number | null;
  total_carbon_tons?: number | null;
  carbon_dioxide_equivalent_tons?: number | null;
  description?: string;
}

export interface CarbonModelRunInfo {
  calculation_mode?: string;
  display_mode?: string;
  scale?: number;
  reference_dataset?: string;
  reference_dataset_year?: number | string;
  model_name?: string;
  load_only?: boolean;
  statistics_available?: boolean;
  model_version?: string | null;
  target_pool?: string;
  cv_metrics?: CarbonModelCvMetrics;
  images_used?: number | null;
  /** Satellite-imagery year the model ran inference on - distinct from
   * `carbon_reference.year`, the (usually much older) vintage of the
   * biomass ground-truth dataset the model was trained against. */
  analysis_year?: number;
}

export interface CarbonResult {
  carbon_estimated: CarbonLayerResult;
  carbon_reference?: CarbonLayerResult & CarbonReferenceInfo;
  area_info: CarbonAreaInfo;
  model_info: CarbonModelRunInfo;
  /** @deprecated never actually populated by the backend (verified against
   * app/services/carbon_service.py's real return shape) - R²/RMSE live under
   * `model_info.cv_metrics` instead. Kept only so old cached report exports
   * embedding this shape don't break the type; do not read this at a new
   * call site, read `data_quality`/`model_info.cv_metrics`. */
  model_performance?: { rmse?: number; r2_score?: number; cv_folds?: number; rmse_std?: number };
  data_quality?: CarbonDataQuality;
  processing_time?: string;
}

export interface AnalysisProcessingTimes {
  vegetation?: string;
  landcover?: string;
  carbon?: string;
  total?: string;
}

export interface CarbonDeltaSeriesPoint {
  year: number;
  mean_density: number;
  std_dev: number;
  min: number;
  max: number;
  area_ha: number;
  total_carbon_tons: number;
  carbon_dioxide_equivalent_tons: number;
  /** Only present when the request set include_tiles:true (timelapse playback). */
  tile_url: string | null;
  /** Data quality for THIS year's composite specifically - use this before reading a
   * year-over-year swing as real biomass change (see analyze_carbon_delta docs). */
  images_used: number | null;
  valid_pixel_pct: number | null;
  gap_filled: boolean | null;
}

export interface CarbonDeltaEntry {
  from_year: number;
  to_year: number;
  delta_total_carbon_tons: number;
  delta_mean_density: number;
  delta_co2e_tons: number;
  delta_total_carbon_percent: number;
  direction: "increase" | "decrease" | "stable";
}

/** POST /analyze/carbon-delta response - multi-year carbon time series + year-over-year deltas. */
export interface CarbonDeltaResponse {
  series: CarbonDeltaSeriesPoint[];
  deltas: CarbonDeltaEntry[];
  summary: {
    start_year: number;
    end_year: number;
    start_total_carbon_tons: number;
    end_total_carbon_tons: number;
    net_delta_total_carbon_tons: number;
    net_delta_co2e_tons: number;
  };
  parameters: { start_month: number; end_month: number; cloud_threshold: number; scale: number; interval: number };
  /** Exact visualization parameters used to create all timelapse tiles. */
  visualization?: { min: number; max: number; palette: string[]; legend_bins: number };
  model_info: { model_name: string; algorithm?: string; scale: number };
}

export interface CompanyBoundary {
  id: string;
  name: string;
  company_name?: string;
  industry_type: "mining" | "forestry" | "plantation" | "energy" | string;
  sub_type?: string;
  province?: string;
  area_ha?: number;
}
