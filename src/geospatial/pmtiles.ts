import { FileSource, PMTiles } from "pmtiles";
import type { PMTilesLayerDefinition } from "./types";

export interface PMTilesMetadata {
  name?: string;
  format?: string;
  minZoom: number;
  maxZoom: number;
  bounds?: [number, number, number, number];
  tileType?: string;
  vectorLayers?: unknown[];
}

export async function readPMTilesMetadata(source: PMTilesLayerDefinition, file?: File): Promise<PMTilesMetadata> {
  if (!file && !source.url) throw new Error("pmtiles.sourceUnavailable");
  const archive = file ? new PMTiles(new FileSource(file)) : new PMTiles(source.url!);
  const header = await archive.getHeader();
  const metadata = await archive.getMetadata() as Record<string, unknown>;
  const bounds: [number, number, number, number] = [header.minLon, header.minLat, header.maxLon, header.maxLat];
  return {
    name: typeof metadata.name === "string" ? metadata.name : source.name,
    format: typeof metadata.format === "string" ? metadata.format : undefined,
    minZoom: header.minZoom, maxZoom: header.maxZoom, bounds,
    tileType: header.tileType === 1 ? "mvt" : header.tileType === 2 ? "png" : header.tileType === 3 ? "jpeg" : "unknown",
    vectorLayers: Array.isArray(metadata.vector_layers) ? metadata.vector_layers : undefined,
  };
}

export function pmtilesProtocolUrl(archiveUrl: string, z: number, x: number, y: number): string {
  if (!/^https?:\/\//i.test(archiveUrl)) throw new Error("pmtiles.invalidUrl");
  return `pmtiles://${archiveUrl}/${z}/${x}/${y}`;
}

