import type L from "leaflet";
import type { AoiFeature } from "@/types/map";

export type AoiSource = "drawn" | "upload" | "admin" | "coordinate" | "company";

/** Mirrors legacy `currentAOI` (main.js) - single source of truth for the module. */
export interface AoiState {
  source: AoiSource;
  name: string;
  areaKm2: number | null;
  feature: AoiFeature;
  bounds: L.LatLngBounds | null;
}

export type AnalysisType = "landcover" | "vegetation" | "carbon" | "combined";

export type ClipMode = "clipped" | "full";

export interface CarbonReferenceDatasetOption {
  value: string;
  label: string;
  group: string;
  description: string;
  year?: number | string | null;
  yearRange?: number[] | string | null;
  compatibleModelCount?: number;
  source?: "api" | "fallback";
}

export interface CarbonModelCvMetrics {
  n_folds?: number;
  cv_folds?: number;
  rmse_mean?: number;
  r2_mean?: number;
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
}

export interface CarbonStats {
  min?: number;
  mean?: number;
  max?: number;
  std_dev?: number;
}

export interface CarbonLayerResult {
  tile_url?: string;
  statistics?: CarbonStats;
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
}

export interface CarbonAreaInfo {
  area_ha?: number;
  calculation_area_ha?: number;
  filtering_area_ha?: number;
  total_carbon_tons?: number;
  carbon_dioxide_equivalent_tons?: number;
  description?: string;
}

export interface CarbonModelRunInfo {
  calculation_mode?: string;
  display_mode?: string;
  scale?: number;
  reference_dataset?: string;
  reference_dataset_year?: number | string;
  model_name?: string;
  target_pool?: string;
  cv_metrics?: CarbonModelCvMetrics;
}

export interface CarbonResult {
  carbon_estimated: CarbonLayerResult;
  carbon_reference?: CarbonLayerResult & CarbonReferenceInfo;
  area_info: CarbonAreaInfo;
  model_info: CarbonModelRunInfo;
  model_performance?: { rmse?: number; r2_score?: number; cv_folds?: number; rmse_std?: number };
  processing_time?: string;
}

export interface AnalysisProcessingTimes {
  vegetation?: string;
  landcover?: string;
  carbon?: string;
  total?: string;
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
