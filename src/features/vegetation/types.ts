export interface VegetationIndexStats {
  native_scale_m?: number;
  min?: number;
  mean?: number;
  max?: number;
  std_dev?: number;
  description?: string;
  tile_url?: string;
}

export interface SatelliteProvider {
  key: string;
  name: string;
  provider: string;
  gee_collection: string;
  resolution_m: number;
  resolution_label: string;
  revisit_days: number;
  swath_km: number;
  launch: string;
  start_year: number;
  bands_available: string[];
  description: string;
}

export interface VegetationDataQuality {
  valid_pixel_pct: number | null;
  images_used: number | null;
}

export interface SkippedVegetationIndex {
  index: string;
  reason: string;
}

export interface VegetationResult {
  rgb_tile_url?: string;
  collection_size?: number;
  satellite?: SatelliteProvider;
  data_quality?: VegetationDataQuality;
  indices: Record<string, VegetationIndexStats>;
  skipped_indices?: SkippedVegetationIndex[];
}

export interface VegetationParams {
  startMonth: number;
  endMonth: number;
  cloudThreshold: number;
  indices: string[];
  /** Satellite provider key (see GET /vegetation/satellites), e.g. "sentinel2" | "landsat8" | "landsat9". */
  satellite: string;
  /** "scl" | "qa60" | "s2cloudless" - see GET /vegetation/cloud-mask-techniques. Sentinel-2 only, ignored for Landsat. */
  cloudMaskTechnique: CloudMaskTechnique;
}

export type CloudMaskTechnique = "scl" | "qa60" | "s2cloudless";

export interface CloudMaskTechniqueInfo {
  label: string;
  description: string;
}

/** GET /vegetation/cloud-mask-techniques response - shared by both the
 * Vegetation and Carbon params panels (same Sentinel-2 masking options). */
export interface CloudMaskTechniqueCatalogResponse {
  techniques: Record<CloudMaskTechnique, CloudMaskTechniqueInfo>;
  default: CloudMaskTechnique;
}

export interface VegetationTimeSeriesMetric {
  kind: "index" | "band";
  unit: "index" | "surface_reflectance";
  data: { period: string; value: number | null }[];
  availability?: string;
}

/** POST /timeseries response - monthly means for selected indices and bands. */
export interface VegetationTimeSeriesResponse {
  index?: string | null;
  indices?: string[];
  bands?: string[];
  year: number;
  interval: string;
  start_month?: number;
  end_month?: number;
  scale: number;
  satellite?: SatelliteProvider;
  periods?: string[];
  series?: Record<string, VegetationTimeSeriesMetric>;
  period_errors?: string[];
  /** Legacy single-index series retained for older clients. */
  data: { period: string; value: number | null }[];
}
