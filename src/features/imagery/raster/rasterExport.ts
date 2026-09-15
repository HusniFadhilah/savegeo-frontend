import { writeArrayBuffer } from "geotiff";
import type { RasterResult } from "./rasterTypes";

export interface CogExportOptions {
  tileSize?: number;
  compression?: "none" | "deflate";
  overviewLevels?: number[];
  sourceDatasetId?: string;
  workflowRunId?: string;
}

export function estimateRasterExportBytes(result: RasterResult, options: CogExportOptions = {}): number {
  const bytesPerSample = 4;
  const raw = result.width * result.height * result.bands.length * bytesPerSample;
  const compressionFactor = options.compression === "deflate" ? 0.65 : 1;
  return Math.ceil(raw * compressionFactor * 1.15);
}

export function rasterToGeoTiff(result: RasterResult): Blob {
  const source = result.source; const width = result.width; const height = result.height; const bands = result.bands.length;
  const values = bands === 1 ? result.bands[0] : result.bands;
  const metadata: Record<string, unknown> = { width, height, SamplesPerPixel: bands, BitsPerSample: 32, SampleFormat: 3, GDAL_NODATA: result.nodata == null ? undefined : String(result.nodata), Software: "SaveGeo local raster toolbox", ImageDescription: JSON.stringify({ operation: result.operation, source: source?.name ?? source?.kind, created_at: new Date().toISOString(), crs: source?.crs, transform: source?.transform, bounds: source?.bounds, resolution: source?.resolution, source_dataset_id: result.metadata?.sourceDatasetId, workflow_run_id: result.metadata?.workflowRunId }) };
  if (source?.transform && source.transform.length >= 6) { metadata.ModelTransformation = [source.transform[1], source.transform[2], 0, source.transform[0], source.transform[4], source.transform[5], 0, source.transform[3], 0, 0, 1, 0, 0, 0, 0, 1]; }
  else if (source?.bounds) { metadata.ModelPixelScale = [(source.bounds[2] - source.bounds[0]) / width, (source.bounds[3] - source.bounds[1]) / height, 0]; metadata.ModelTiepoint = [0, 0, 0, source.bounds[0], source.bounds[3], 0]; }
  return new Blob([writeArrayBuffer(values as never, metadata as never)], { type: "image/tiff" });
}

/** Browser-safe export entry point. For large results the caller should use
 * the server job API; geotiff's browser writer intentionally remains the
 * small-result fallback and preserves georeferencing/nodata metadata. */
export function rasterToCog(result: RasterResult, options: CogExportOptions = {}): Blob {
  if (result.width * result.height > 12_000_000) throw new Error("raster.serverExportRequired");
  const enriched: RasterResult = { ...result, metadata: { ...result.metadata, ...options } };
  return rasterToGeoTiff(enriched);
}

export function downloadCog(result: RasterResult, name = `savegeo_${result.operation}_cog.tif`, options?: CogExportOptions) {
  const url = URL.createObjectURL(rasterToCog(result, options)); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
}
export function downloadRaster(result: RasterResult, name = `savegeo_${result.operation}.tif`) {
  const url = URL.createObjectURL(rasterToGeoTiff(result)); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
}
