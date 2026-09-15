import type { RasterData, RasterOperationParams } from "./rasterTypes";
import { dimensions } from "./rasterUtils";
import { RASTER_LIMITS } from "./rasterTypes";

export function validateRaster(data: RasterData) {
  if (!data.width || !data.height || !data.bands.length) throw new Error("raster.invalidMetadata");
  if (dimensions(data) > RASTER_LIMITS.maxPixels) throw new Error("raster.rasterTooLarge");
  if (data.bands.some(b => b.length !== dimensions(data))) throw new Error("raster.invalidMetadata");
}
export function validateOperation(data: RasterData, params: RasterOperationParams) {
  validateRaster(data);
  const required: Record<string, number> = { ndvi: 2, evi: 3, ndwi: 2, savi: 2, slope: 1, aspect: 1, hillshade: 1 };
  if ((required[params.operation] ?? 0) > data.bands.length) throw new Error("raster.missingBand");
  if (params.operation === "reclassify" && !params.reclassRules?.length) throw new Error("raster.invalidMetadata");
  if (params.operation === "change_detection" && !params.changeMode) throw new Error("raster.beforeAfterRequired");
}
