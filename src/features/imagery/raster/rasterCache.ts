import type { RasterResult } from "./rasterTypes";
const cache = new Map<string, RasterResult>();
export async function rasterAnalysisKey(input: unknown): Promise<string> {
  async function normalize(value: unknown): Promise<unknown> {
    if (value instanceof Float32Array) {
      const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return { type: "Float32Array", length: value.length, sha256: Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("") };
    }
    if (Array.isArray(value)) return Promise.all(value.map(normalize));
    if (value && typeof value === "object") {
      return Object.fromEntries(await Promise.all(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(async ([key, item]) => [key, await normalize(item)])));
    }
    return value;
  }
  return JSON.stringify(await normalize(input));
}
export function getRasterCache(key: string) { return cache.get(key); }
export function setRasterCache(key: string, result: RasterResult) { if (result.width * result.height <= 2_000_000) { if (cache.size >= 16) cache.delete(cache.keys().next().value!); cache.set(key, result); } }
export function clearRasterCache() { cache.clear(); }
