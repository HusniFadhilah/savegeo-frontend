export type RasterOperation =
  | "ndvi" | "evi" | "ndwi" | "savi" | "band_math" | "clip" | "stretch" | "clip_stretch"
  | "reclassify" | "histogram" | "statistics" | "zonal_statistics" | "slope" | "aspect"
  | "hillshade" | "change_detection";

export type RasterSourceKind = "file" | "url" | "cog" | "scene_asset" | "array";
export interface RasterSource {
  kind: RasterSourceKind;
  name?: string;
  url?: string;
  fileName?: string;
  assetKey?: string;
  width?: number;
  height?: number;
  bandCount?: number;
  dataType?: string;
  crs?: string;
  transform?: number[];
  nodata?: number | null;
  bounds?: number[];
  resolution?: number;
}

export interface ReclassRule { min: number; max: number; value: number; label?: string; color?: string; }
export interface RasterOperationParams {
  operation: RasterOperation;
  bands?: Record<string, number>;
  expression?: string;
  clipGeometry?: GeoJSON.Geometry | GeoJSON.Feature;
  stretchMin?: number;
  stretchMax?: number;
  stretchPercentileMin?: number;
  stretchPercentileMax?: number;
  reclassRules?: ReclassRule[];
  threshold?: number;
  nodata?: number | null;
  scale?: number;
  hillshadeAzimuth?: number;
  hillshadeAltitude?: number;
  saviL?: number;
  changeMode?: "difference" | "ratio" | "threshold";
}

export interface RasterStats {
  min?: number; max?: number; mean?: number; median?: number; stdDev?: number; variance?: number;
  p05?: number; p25?: number; p50?: number; p75?: number; p95?: number;
  pixelCount: number; validPixelCount: number; nodataPixelCount: number; sum?: number;
}
export interface RasterResult {
  width: number; height: number; bands: Float32Array[]; nodata: number | null;
  stats?: RasterStats; histogram?: number[]; bins?: number[]; legend?: ReclassRule[];
  source?: RasterSource; operation: RasterOperation; metadata?: Record<string, unknown>;
}
export interface RasterData { width: number; height: number; bands: Float32Array[]; bandCount?: number; nodata: number | null; source?: RasterSource; }
export interface RasterWorkerRequest { id: string; data: RasterData; params: RasterOperationParams; after?: RasterData; }
export type RasterWorkerEvent =
  | { type: "progress"; id: string; progress: number; message: string }
  | { type: "result"; id: string; result: RasterResult }
  | { type: "error"; id: string; message: string; code?: string }
  | { type: "cancelled"; id: string };

export const RASTER_LIMITS = { maxFileMb: 512, maxPixels: 25_000_000, maxOutputPixels: 12_000_000, maxHistogramBins: 512, workerTimeoutMs: 120_000 } as const;
