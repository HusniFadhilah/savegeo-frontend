export interface VegetationIndexStats {
  min?: number;
  mean?: number;
  max?: number;
  std_dev?: number;
  description?: string;
  tile_url?: string;
}

export interface VegetationResult {
  rgb_tile_url?: string;
  collection_size?: number;
  indices: Record<string, VegetationIndexStats>;
}

export interface VegetationParams {
  startMonth: number;
  endMonth: number;
  cloudThreshold: number;
  indices: string[];
}
