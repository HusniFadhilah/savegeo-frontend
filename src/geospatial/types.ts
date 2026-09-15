export type CloudDatasetFormat = "cog" | "geoparquet" | "pmtiles";
export type DatasetAccess = "public" | "private" | "signed";
export type DatasetSourceType = "local-file" | "browser-cache" | "backend" | "remote";

export interface RasterBandMetadata {
  index: number;
  name?: string;
  description?: string;
  dataType?: string;
  nodata?: number | null;
  unit?: string;
}

export interface CloudDatasetReference {
  id: string;
  name: string;
  format: CloudDatasetFormat;
  url?: string;
  assetUrl?: string;
  metadataUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  checksum?: string;
  crs?: string;
  bbox?: [number, number, number, number];
  bands?: RasterBandMetadata[];
  timeExtent?: { start?: string; end?: string };
  access: DatasetAccess;
  sourceType: DatasetSourceType;
  version?: string;
  module?: string;
}

export interface RasterMetadata {
  width: number;
  height: number;
  bandCount: number;
  dataType?: string;
  nodata?: number | null;
  crs?: string;
  transform?: number[];
  bounds?: [number, number, number, number];
  resolution?: [number, number];
  overviews?: number[];
  bands?: RasterBandMetadata[];
}

export interface RasterWindow {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RasterChunk {
  width: number;
  height: number;
  bands: ArrayLike<number>[];
  window: RasterWindow;
  metadata: RasterMetadata;
}

export interface ReadOptions {
  signal?: AbortSignal;
  samples?: number[];
  onProgress?: (progress: number) => void;
}

export interface CogReader {
  open(source: CloudDatasetReference): Promise<RasterMetadata>;
  getMetadata(): Promise<RasterMetadata>;
  readWindow(window: RasterWindow, options?: ReadOptions): Promise<RasterChunk>;
  readOverview(level: number, options?: ReadOptions): Promise<RasterChunk>;
  close(): Promise<void>;
}

export interface PMTilesLayerDefinition {
  id: string;
  name: string;
  url?: string;
  kind: "vector" | "raster";
  minZoom?: number;
  maxZoom?: number;
  bounds?: [number, number, number, number];
  style?: Record<string, unknown>;
}

export interface TableInfo { name: string; schema?: string; rows?: number; }
export interface ColumnInfo { name: string; type: string; nullable?: boolean; }

export interface SpatialQueryService {
  initialize(): Promise<void>;
  registerFile(file: File, name?: string): Promise<void>;
  registerUrl(url: string, name: string): Promise<void>;
  listTables(): Promise<TableInfo[]>;
  describeTable(table: string): Promise<ColumnInfo[]>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  cancel(queryId: string): Promise<void>;
  clearCache(): Promise<void>;
  dispose(): Promise<void>;
}

