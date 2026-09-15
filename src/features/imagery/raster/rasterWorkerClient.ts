import { rasterAnalysisKey, getRasterCache, setRasterCache } from "./rasterCache";
import type { RasterData, RasterOperationParams, RasterResult, RasterWorkerEvent, RasterWorkerRequest } from "./rasterTypes";
import { RASTER_LIMITS } from "./rasterTypes";
import { runRasterOperation } from "./rasterEngine";

let worker: Worker | null = null;
function getWorker() { return worker ??= new Worker(new URL("./rasterWorker.ts", import.meta.url), { type: "module" }); }
function transfer(data: RasterData) { return data.bands.map(band => band.buffer); }
export function runRasterOperationAsync(data: RasterData, params: RasterOperationParams, options: { signal?: AbortSignal; onProgress?: (progress: number, message: string) => void; after?: RasterData } = {}): Promise<RasterResult> {
  if (options.signal?.aborted) return Promise.reject(new Error("raster.operationCancelled"));
  const key = rasterAnalysisKey({ source: data.source, params, after: options.after?.source }); const cached = getRasterCache(key); if (cached) { options.onProgress?.(100, "Diambil dari cache"); return Promise.resolve(cached); }
  if (data.width * data.height < 100_000 || typeof Worker === "undefined") { const result = runRasterOperation(data, params, options.onProgress, options.after); setRasterCache(key, result); return Promise.resolve(result); }
  const id = crypto.randomUUID(); const requestData: RasterData = { ...data, bands: data.bands.map(band => band.slice()) }; const requestAfter = options.after ? { ...options.after, bands: options.after.bands.map(band => band.slice()) } : undefined; const request: RasterWorkerRequest = { id, data: requestData, params, after: requestAfter }; const workerInstance = getWorker();
  return new Promise((resolve, reject) => { const timer = window.setTimeout(() => { workerInstance.removeEventListener("message", handle); workerInstance.terminate(); worker = null; reject(new Error("raster.workerFailed")); }, RASTER_LIMITS.workerTimeoutMs); const handle = (event: MessageEvent<RasterWorkerEvent>) => { const message = event.data; if (message.id !== id) return; if (message.type === "progress") options.onProgress?.(message.progress, message.message); if (message.type === "result") { window.clearTimeout(timer); workerInstance.removeEventListener("message", handle); setRasterCache(key, message.result); resolve(message.result); } if (message.type === "error") { window.clearTimeout(timer); workerInstance.removeEventListener("message", handle); reject(new Error(message.code ?? "raster.workerFailed")); } }; workerInstance.addEventListener("message", handle); const cancel = () => { window.clearTimeout(timer); workerInstance.removeEventListener("message", handle); workerInstance.terminate(); worker = null; reject(new Error("raster.operationCancelled")); }; options.signal?.addEventListener("abort", cancel, { once: true }); workerInstance.postMessage(request, transfer(requestData).concat(requestAfter ? transfer(requestAfter) : [])); });
}
