import { describe, expect, it } from "vitest";
import { rasterStatistics, runRasterOperation } from "./rasterEngine";
import type { RasterData } from "./rasterTypes";

const raster = (bands: number[][], width = 2, height = 2): RasterData => ({ width, height, bands: bands.map(values => Float32Array.from(values)), nodata: -9999, source: { kind: "array", bounds: [0, 0, width, height] } });

describe("local raster engine", () => {
  it("computes NDVI and propagates nodata", () => {
    const result = runRasterOperation(raster([[2, 2, -9999, 4], [6, 2, 1, 8]]), { operation: "ndvi", bands: { red: 1, nir: 2 } });
    expect(Array.from(result.bands[0])).toEqual([0.5, 0, -9999, 0.3333333432674408]);
  });
  it("supports EVI, NDWI and SAVI", () => {
    const data = raster([[1, 1, 1, 1], [2, 2, 2, 2], [3, 3, 3, 3], [4, 4, 4, 4]]);
    expect(runRasterOperation(data, { operation: "ndwi", bands: { green: 1, nir: 2 } }).bands[0][0]).toBeCloseTo(-0.3333, 3);
    expect(runRasterOperation(data, { operation: "evi", bands: { red: 1, blue: 2, nir: 3 } }).bands[0][0]).toBeCloseTo(-1, 3);
    expect(runRasterOperation(data, { operation: "savi", bands: { red: 1, nir: 2 }, saviL: 0.5 }).bands[0][0]).toBeCloseTo(0.4286, 3);
  });
  it("evaluates safe band math and rejects code", () => {
    const data = raster([[2, 4, 6, 8], [1, 1, 1, 1]]);
    expect(runRasterOperation(data, { operation: "band_math", bands: { A: 1, B: 2 }, expression: "(A + B) / 2" }).bands[0][0]).toBe(1.5);
    expect(() => runRasterOperation(data, { operation: "band_math", bands: { A: 1 }, expression: "A + window.alert(1)" })).toThrow("raster.invalidExpression");
  });
  it("returns statistics and histogram", () => {
    const summary = rasterStatistics(Float32Array.from([1, 2, 3, -9999]), -9999, 4);
    expect(summary.stats.mean).toBe(2); expect(summary.stats.validPixelCount).toBe(3); expect(summary.stats.nodataPixelCount).toBe(1); expect(summary.histogram.reduce((a, b) => a + b, 0)).toBe(3);
  });
  it("supports clip, reclassify, terrain and change detection", () => {
    const data = raster([[1, 2, 3, 4], [5, 6, 7, 8]], 2, 2);
    expect(runRasterOperation(data, { operation: "clip", clipGeometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 2], [0, 2], [0, 0]]] } }).width).toBe(1);
    expect(Array.from(runRasterOperation(data, { operation: "reclassify", reclassRules: [{ min: 0, max: 4, value: 1 }, { min: 4, max: 10, value: 2 }] }).bands[0])).toEqual([1, 1, 1, 2]);
    expect(runRasterOperation(data, { operation: "slope", scale: 1 }).bands[0].every(Number.isFinite)).toBe(true);
    expect(Array.from(runRasterOperation(data, { operation: "change_detection", changeMode: "difference" }, undefined, raster([[2, 4, 6, 8], [1, 1, 1, 1]], 2, 2)).bands[0])).toEqual([1, 2, 3, 4]);
  });
});
