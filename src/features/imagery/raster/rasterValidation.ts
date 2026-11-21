import type { RasterData, RasterOperationParams } from "./rasterTypes";
import { dimensions } from "./rasterUtils";
import { RASTER_LIMITS } from "./rasterTypes";

export function validateRaster(data: RasterData) {
  if (!Number.isInteger(data.width) || !Number.isInteger(data.height) || data.width <= 0 || data.height <= 0 || !data.bands.length) throw new Error("raster.invalidMetadata");
  if (dimensions(data) > RASTER_LIMITS.maxPixels || dimensions(data) * data.bands.length > 64_000_000) throw new Error("raster.rasterTooLarge");
  if (data.bands.some(b => b.length !== dimensions(data))) throw new Error("raster.invalidMetadata");
  if (data.nodata != null && !Number.isFinite(data.nodata) && !Number.isNaN(data.nodata)) throw new Error("raster.invalidMetadata");
  const bounds = data.source?.bounds;
  if (bounds && (bounds.length !== 4 || bounds.some(value => !Number.isFinite(value)) || bounds[0] >= bounds[2] || bounds[1] >= bounds[3])) throw new Error("raster.invalidMetadata");
  const transform = data.source?.transform;
  if (transform && (transform.length !== 6 || transform.some(value => !Number.isFinite(value))
    || Math.abs(transform[1] * transform[5] - transform[2] * transform[4]) < 1e-15)) throw new Error("raster.invalidMetadata");
}
export function validateOperation(data: RasterData, params: RasterOperationParams) {
  validateRaster(data);
  const selectedBands: Record<string, string[]> = { ndvi: ['red','nir'], savi: ['red','nir'], evi: ['red','nir','blue'], ndwi: ['green','nir'], slope: ['dem'], aspect: ['dem'], hillshade: ['dem'] };
  const names = params.operation === 'band_math' ? Object.keys(params.bands ?? {}) : selectedBands[params.operation] ?? [];
  for (const name of names) {
    const index = params.bands?.[name];
    if (index == null) continue;
    if (!Number.isInteger(index) || index < 1 || index > data.bands.length) throw new Error("raster.missingBand");
  }
  for (const number of [params.scale, params.threshold, params.saviL, params.hillshadeAltitude, params.hillshadeAzimuth]) {
    if (number != null && !Number.isFinite(number)) throw new Error("raster.invalidMetadata");
  }
  if (params.scale != null && params.scale <= 0) throw new Error("raster.invalidMetadata");
  if (["slope", "aspect", "hillshade"].includes(params.operation) && data.source?.transform
    && (Math.abs(data.source.transform[2]) > 1e-12 || Math.abs(data.source.transform[4]) > 1e-12)) throw new Error("raster.reprojectionRequired");
  if (params.operation === "zonal_statistics" && !params.clipGeometry) throw new Error("raster.invalidAoi");
  if (["zonal_statistics", "clip", "clip_stretch"].includes(params.operation)) {
    if (!data.source?.bounds) throw new Error("raster.invalidAoi");
    if (data.source.crs && !["EPSG:4326", "CRS:84"].includes(data.source.crs)) throw new Error("raster.reprojectionRequired");
  }
  const required: Record<string, number> = { ndvi: 2, evi: 3, ndwi: 2, savi: 2, slope: 1, aspect: 1, hillshade: 1 };
  if ((required[params.operation] ?? 0) > data.bands.length) throw new Error("raster.missingBand");
  if (params.operation === "reclassify" && !params.reclassRules?.length) throw new Error("raster.invalidMetadata");
  if (params.operation === "change_detection" && !params.changeMode) throw new Error("raster.beforeAfterRequired");
}
