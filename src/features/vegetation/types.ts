export interface VegetationIndexStats {
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

export interface VegetationResult {
  rgb_tile_url?: string;
  collection_size?: number;
  satellite?: SatelliteProvider;
  data_quality?: VegetationDataQuality;
  indices: Record<string, VegetationIndexStats>;
}

export interface VegetationParams {
  startMonth: number;
  endMonth: number;
  cloudThreshold: number;
  indices: string[];
  /** Satellite provider key (see GET /vegetation/satellites), e.g. "sentinel2" | "landsat8" | "landsat9". */
  satellite: string;
}

/** POST /timeseries response - monthly mean of one vegetation index across one year. */
export interface VegetationTimeSeriesResponse {
  index: string;
  year: number;
  interval: string;
  scale: number;
  satellite?: SatelliteProvider;
  data: { period: string; value: number | null }[];
}
