import { rasterAnalysisKey, getRasterCache, setRasterCache } from "./rasterCache";
import type { RasterData, RasterOperationParams, RasterResult, RasterWorkerEvent, RasterWorkerRequest } from "./rasterTypes";
import { RASTER_LIMITS } from "./rasterTypes";
import { runRasterOperation } from "./rasterEngine";
import { validateOperation, validateRaster } from "./rasterValidation";

let activeWorkers = 0;
function transfer(data: RasterData) { return data.bands.map(band => band.buffer); }
export async function runRasterOperationAsync(data: RasterData, params: RasterOperationParams, options: { signal?: AbortSignal; onProgress?: (progress: number, message: string) => void; after?: RasterData } = {}): Promise<RasterResult> {
  if (options.signal?.aborted) return Promise.reject(new Error("raster.operationCancelled"));
  validateOperation(data, params);
  if (options.after) validateRaster(options.after);
  const key = await rasterAnalysisKey({ data, params, after: options.after });
  if (options.signal?.aborted) throw new Error("raster.operationCancelled");
  const cached = getRasterCache(key); if (cached) { options.onProgress?.(100, "Diambil dari cache"); return cached; }
  if (data.width * data.height < 100_000 || typeof Worker === "undefined") { const result = runRasterOperation(data, params, options.onProgress, options.after); setRasterCache(key, result); return Promise.resolve(result); }
  if (activeWorkers >= 2) throw new Error("raster.workerFailed");
  const id = crypto.randomUUID();
  const requestData: RasterData = { ...data, bands: data.bands.map(band => band.slice()) };
  const requestAfter = options.after ? { ...options.after, bands: options.after.bands.map(band => band.slice()) } : undefined;
  const request: RasterWorkerRequest = { id, data: requestData, params, after: requestAfter };
  // A cancellation must affect only its own operation, including concurrent jobs.
  const workerInstance = new Worker(new URL("./rasterWorker.ts", import.meta.url), { type: "module" });
  activeWorkers += 1;
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      activeWorkers -= 1;
      window.clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
      workerInstance.removeEventListener("message", handle);
      workerInstance.removeEventListener("error", failed);
      workerInstance.removeEventListener("messageerror", failed);
      workerInstance.terminate();
    };
    const fail = (code: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(code));
    };
    const failed = () => fail("raster.workerFailed");
    const cancel = () => fail("raster.operationCancelled");
    const handle = (event: MessageEvent<RasterWorkerEvent>) => {
      const message = event.data;
      if (settled || message.id !== id) return;
      if (message.type === "progress") options.onProgress?.(message.progress, message.message);
      if (message.type === "result") {
        settled = true;
        cleanup();
        setRasterCache(key, message.result);
        resolve(message.result);
      }
      if (message.type === "error") fail(message.code ?? "raster.workerFailed");
      if (message.type === "cancelled") cancel();
    };
    const timer = window.setTimeout(failed, RASTER_LIMITS.workerTimeoutMs);
    workerInstance.addEventListener("message", handle);
    workerInstance.addEventListener("error", failed);
    workerInstance.addEventListener("messageerror", failed);
    options.signal?.addEventListener("abort", cancel, { once: true });
    if (options.signal?.aborted) { cancel(); return; }
    try {
      workerInstance.postMessage(request, transfer(requestData).concat(requestAfter ? transfer(requestAfter) : []));
    } catch { failed(); }
  });
}
