import type { RasterResult } from "./rasterTypes";
const cache = new Map<string, RasterResult>();
export function rasterAnalysisKey(input: unknown) { return JSON.stringify(input, (_key, value) => value instanceof Float32Array ? { length: value.length } : value); }
export function getRasterCache(key: string) { return cache.get(key); }
export function setRasterCache(key: string, result: RasterResult) { if (result.width * result.height <= 2_000_000) cache.set(key, result); }
export function clearRasterCache() { cache.clear(); }
