import { runRasterOperation } from "./rasterEngine";
import { wasmAdd } from "./rasterWasm";
import type { RasterWorkerEvent, RasterWorkerRequest } from "./rasterTypes";

self.onmessage = async (event: MessageEvent<RasterWorkerRequest>) => {
  const request = event.data;
  try {
    await wasmAdd(0, 0);
    const result = runRasterOperation(request.data, request.params, (progress, message) => self.postMessage({ type: "progress", id: request.id, progress, message } satisfies RasterWorkerEvent), request.after);
    const transfer = result.bands.flatMap(band => [band.buffer]);
    self.postMessage({ type: "result", id: request.id, result } satisfies RasterWorkerEvent, { transfer } as unknown as StructuredSerializeOptions);
  } catch (error) { self.postMessage({ type: "error", id: request.id, message: error instanceof Error ? error.message : "raster.workerFailed", code: error instanceof Error ? error.message : undefined } satisfies RasterWorkerEvent); }
};
