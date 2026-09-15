import { fromBlob, fromUrl } from "geotiff";
import type { ImageryScene } from "../types";
import type { RasterData, RasterSource } from "./rasterTypes";
import { RASTER_LIMITS } from "./rasterTypes";

function metadata(image: Awaited<ReturnType<Awaited<ReturnType<typeof fromBlob>>["getImage"]>>, source: RasterSource): RasterSource {
  const fileDirectory = image.getFileDirectory(); const tags = fileDirectory as unknown as Record<string, unknown>; const origin = image.getOrigin(); const resolution = image.getResolution();
  const bounds = [origin[0], origin[1] + resolution[1] * image.getHeight(), origin[0] + resolution[0] * image.getWidth(), origin[1]];
  return { ...source, width: image.getWidth(), height: image.getHeight(), bandCount: image.getSamplesPerPixel(), dataType: String(image.getSampleFormat()), nodata: image.getGDALNoData(), transform: [origin[0], resolution[0], 0, origin[1], 0, resolution[1]], bounds, resolution: Math.abs(resolution[0]), crs: String(tags.ProjectedCSTypeGeoKey ?? tags.GeographicTypeGeoKey ?? "unknown") };
}
async function read(imageFile: Awaited<ReturnType<typeof fromBlob>>, source: RasterSource): Promise<RasterData> {
  const image = await imageFile.getImage(); const sourceMetadata = metadata(image, source); const pixels = image.getWidth() * image.getHeight();
  if (pixels > RASTER_LIMITS.maxPixels) throw new Error("raster.rasterTooLarge");
  const values = await image.readRasters({ interleave: false });
  const bands = (Array.isArray(values) ? values : [values]).map(value => Float32Array.from(value as ArrayLike<number>));
  return { width: image.getWidth(), height: image.getHeight(), bands, nodata: sourceMetadata.nodata ?? null, source: sourceMetadata };
}
export async function readRasterFile(file: File): Promise<RasterData> {
  if (file.size > RASTER_LIMITS.maxFileMb * 1024 * 1024) throw new Error("raster.fileTooLarge");
  try { return await read(await fromBlob(file), { kind: "file", name: file.name, fileName: file.name }); } catch (caught) { if (caught instanceof Error && caught.message === "raster.rasterTooLarge") throw caught; throw new Error("raster.fileUnreadable"); }
}
export async function readRasterUrl(url: string, kind: "url" | "cog" | "scene_asset" = "cog", signal?: AbortSignal): Promise<RasterData> {
  if (!/^https?:\/\//i.test(url)) throw new Error("raster.sourceUnavailable");
  try {
    const tiff = await fromUrl(url, { allowFullFile: false }, signal);
    return await read(tiff as Awaited<ReturnType<typeof fromBlob>>, { kind, url, name: "Raster URL" });
  } catch { throw new Error("raster.sourceUnavailable"); }
}
export async function readSceneAsset(scene: ImageryScene, assetKey: string, signal?: AbortSignal): Promise<RasterData> {
  const asset = scene.assets?.find(item => item.key === assetKey) ?? scene.assets?.[0];
  if (!asset?.href) throw new Error("raster.sourceUnavailable");
  return readRasterUrl(asset.href, "scene_asset", signal);
}
