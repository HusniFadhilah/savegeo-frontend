import { afterEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { runRasterOperationAsync } from './rasterWorkerClient';
import type { RasterWorkerRequest, RasterResult } from './rasterTypes';

class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = [];
  request?: RasterWorkerRequest;
  terminate = vi.fn();
  constructor() { super(); FakeWorker.instances.push(this); }
  postMessage(request: RasterWorkerRequest) { this.request = request; }
  finish(result: RasterResult) { this.dispatchEvent(new MessageEvent('message', { data: { type: 'result', id: this.request!.id, result } })); }
}
afterEach(() => { vi.unstubAllGlobals(); FakeWorker.instances = []; });
it('cancels only its own job and removes listeners when another job succeeds', async () => {
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('Worker', FakeWorker);
  const data = { width: 1000, height: 100, bands: [new Float32Array(100_000)], nodata: null };
  const a = new AbortController(), b = new AbortController();
  const removed = vi.spyOn(b.signal, 'removeEventListener');
  const first = runRasterOperationAsync(data, { operation: 'statistics' }, { signal: a.signal });
  const firstRejected = expect(first).rejects.toThrow('raster.operationCancelled');
  const second = runRasterOperationAsync(data, { operation: 'histogram' }, { signal: b.signal });
  await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
  a.abort();
  await firstRejected;
  expect(FakeWorker.instances[1].terminate).not.toHaveBeenCalled();
  const result: RasterResult = { ...data, operation: 'histogram' };
  FakeWorker.instances[1].finish(result);
  await expect(second).resolves.toBe(result);
  expect(removed).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(FakeWorker.instances[1].terminate).toHaveBeenCalledOnce();
});
