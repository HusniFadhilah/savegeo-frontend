import { fromBlob, fromUrl } from "geotiff";
import { validateDatasetReference } from "./datasetReference";
import type { CloudDatasetReference, CogReader, RasterChunk, RasterMetadata, RasterWindow, ReadOptions } from "./types";

type ImageLike = Awaited<ReturnType<Awaited<ReturnType<typeof fromBlob>>["getImage"]>>;
type TiffLike = Awaited<ReturnType<typeof fromBlob>>;

function imageMetadata(image: ImageLike): RasterMetadata {
  const directory = image.getFileDirectory() as unknown as Record<string, unknown>;
  const origin = image.getOrigin();
  const resolution = image.getResolution();
  const width = image.getWidth();
  const height = image.getHeight();
  const bounds: [number, number, number, number] = [
    origin[0], origin[1] + resolution[1] * height, origin[0] + resolution[0] * width, origin[1],
  ];
  const rawNoData = image.getGDALNoData();
  const overviews = Array.isArray(directory.SubIFDs) ? directory.SubIFDs.map(() => 1) : [];
  return {
    width, height, bandCount: image.getSamplesPerPixel(), dataType: String(image.getSampleFormat()),
    nodata: rawNoData, crs: String(directory.ProjectedCSTypeGeoKey ?? directory.GeographicTypeGeoKey ?? "unknown"),
    transform: [origin[0], resolution[0], 0, origin[1], 0, resolution[1]], bounds,
    resolution: [Math.abs(resolution[0]), Math.abs(resolution[1])], overviews,
    bands: Array.from({ length: image.getSamplesPerPixel() }, (_, index) => ({ index, nodata: rawNoData })),
  };
}

function clampWindow(window: RasterWindow, metadata: RasterMetadata): RasterWindow {
  const x = Math.max(0, Math.min(metadata.width, Math.floor(window.x)));
  const y = Math.max(0, Math.min(metadata.height, Math.floor(window.y)));
  const right = Math.max(x, Math.min(metadata.width, Math.ceil(window.x + window.width)));
  const bottom = Math.max(y, Math.min(metadata.height, Math.ceil(window.y + window.height)));
  if (right <= x || bottom <= y) throw new Error("raster.invalidWindow");
  return { x, y, width: right - x, height: bottom - y };
}

class GeotiffCogReader implements CogReader {
  private tiff: TiffLike | null = null;
  private image: ImageLike | null = null;
  private metadata: RasterMetadata | null = null;
  private readonly sourceFile?: File;

  constructor(sourceFile?: File) { this.sourceFile = sourceFile; }

  async open(source: CloudDatasetReference): Promise<RasterMetadata> {
    validateDatasetReference(source);
    if (source.format !== "cog") throw new Error("raster.invalidFormat");
    if (this.sourceFile) this.tiff = await fromBlob(this.sourceFile);
    else if (source.url || source.assetUrl) {
      try { this.tiff = await fromUrl(source.url ?? source.assetUrl!, { allowFullFile: false }); }
      catch (error) { if (error instanceof Error && error.message.includes("full file")) throw new Error("cloud.rangeUnsupported"); throw new Error("raster.sourceUnavailable"); }
    }
    else throw new Error("raster.sourceUnavailable");
    this.image = await this.tiff.getImage();
    this.metadata = imageMetadata(this.image);
    return this.metadata;
  }

  async getMetadata(): Promise<RasterMetadata> {
    if (!this.metadata) throw new Error("raster.notOpen");
    return this.metadata;
  }

  async readWindow(window: RasterWindow, options: ReadOptions = {}): Promise<RasterChunk> {
    if (!this.image || !this.metadata) throw new Error("raster.notOpen");
    const selected = clampWindow(window, this.metadata);
    const samples = options.samples ?? Array.from({ length: this.metadata.bandCount }, (_, index) => index);
    options.onProgress?.(5);
    const values = await this.image.readRasters({
      window: [selected.x, selected.y, selected.x + selected.width, selected.y + selected.height],
      samples, interleave: false, signal: options.signal,
    });
    options.onProgress?.(100);
    return { width: selected.width, height: selected.height, bands: values as ArrayLike<number>[], window: selected, metadata: this.metadata };
  }

  async readOverview(level: number, options: ReadOptions = {}): Promise<RasterChunk> {
    if (!Number.isInteger(level) || level < 0) throw new Error("raster.invalidOverview");
    if (!this.tiff) throw new Error("raster.notOpen");
    const overview = await this.tiff.getImage(level);
    const metadata = imageMetadata(overview);
    const values = await overview.readRasters({ samples: options.samples, interleave: false, signal: options.signal });
    options.onProgress?.(100);
    return { width: metadata.width, height: metadata.height, bands: values as ArrayLike<number>[], window: { x: 0, y: 0, width: metadata.width, height: metadata.height }, metadata };
  }

  async close(): Promise<void> { this.tiff = null; this.image = null; this.metadata = null; }
}

export function createCogReader(file?: File): CogReader { return new GeotiffCogReader(file); }

export async function openCog(source: CloudDatasetReference, file?: File): Promise<CogReader> {
  const reader = createCogReader(file);
  await reader.open(source);
  return reader;
}
