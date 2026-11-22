import { webcrypto } from "node:crypto";
import { expect, it, vi } from "vitest";
import { rasterAnalysisKey } from "./rasterCache";
it("hashes raster contents, not only array size or scene metadata", async () => {
  vi.stubGlobal("crypto", webcrypto);
  try {
    const a = { bands: [new Float32Array([1, 2])], nodata: -9999 };
    const b = { bands: [new Float32Array([1, 3])], nodata: -9999 };
    expect(await rasterAnalysisKey(a)).not.toBe(await rasterAnalysisKey(b));
    expect(await rasterAnalysisKey(a)).toBe(await rasterAnalysisKey({ ...a, bands: [a.bands[0].slice()] }));
  } finally { vi.unstubAllGlobals(); }
});
