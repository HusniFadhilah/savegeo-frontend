import { describe, expect, it } from "vitest";
import { rasterStatistics, runRasterOperation } from "./rasterEngine";
import type { RasterData } from "./rasterTypes";

const raster = (bands: number[][], width = 2, height = 2): RasterData => ({ width, height, bands: bands.map(values => Float32Array.from(values)), nodata: -9999, source: { kind: "array", crs: "EPSG:4326", bounds: [0, 0, width, height] } });

describe("local raster engine", () => {
  it("computes NDVI and propagates nodata", () => {
    const result = runRasterOperation(raster([[2, 2, -9999, 4], [6, 2, 1, 8]]), { operation: "ndvi", bands: { red: 1, nir: 2 } });
    expect(Array.from(result.bands[0])).toEqual([0.5, 0, -9999, 0.3333333432674408]);
  });
  it('ignores unused UI band choices and validates only the selected index inputs', () => {
    const data = raster([[2,2,2,2],[6,6,6,6]]);
    expect(runRasterOperation(data, { operation: 'ndvi', bands: { red: 1, nir: 2, blue: 3, green: 4 } }).bands[0][0]).toBe(0.5);
    expect(runRasterOperation(data, { operation: 'ndwi', bands: { green: 1, nir: 2, red: 99 } }).bands[0][0]).toBe(-0.5);
  });
  it('uses the actual SAVI denominator when red plus NIR is zero', () => {
    expect(runRasterOperation(raster([[-1,-1,-1,-1],[1,1,1,1]]), { operation: 'savi', bands: { red: 1, nir: 2 }, saviL: 0.5 }).bands[0][0]).toBe(6);
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
  it("rejects fractional and out-of-range band references", () => {
    for (const index of [0, -1, 1.5, 5, NaN]) {
      expect(() => runRasterOperation(raster([[1,2,3,4]]), { operation: "band_math", bands: { A: index }, expression: "A" })).toThrow("raster.missingBand");
    }
  });
  it("propagates nodata across the terrain kernel and leaves edge cells without a complete neighborhood", () => {
    const values = Array(49).fill(10); values[24] = -9999;
    for (const operation of ["slope", "aspect", "hillshade"] as const) {
      const result = runRasterOperation(raster([values], 7, 7), { operation, scale: 1 });
      for (const index of [16,17,18,23,24,25,30,31,32]) expect(result.bands[0][index]).toBe(-9999);
      expect(result.bands[0][0]).toBe(-9999);
    }
  });
  it("converts geographic DEM pixel spacing to metres at the raster latitude", () => {
    const heights = [0,10,20, 0,10,20, 0,10,20];
    const atEquator = raster([heights], 3, 3);
    atEquator.source = { kind: "array", crs: "EPSG:4326", bounds: [0, 0, 0.03, 0.03] };
    const atHighLatitude = raster([heights], 3, 3);
    atHighLatitude.source = { kind: "array", crs: "EPSG:4326", bounds: [0, 59.985, 0.03, 60.015] };
    const equatorSlope = runRasterOperation(atEquator, { operation: "slope" }).bands[0][4];
    const highLatitudeSlope = runRasterOperation(atHighLatitude, { operation: "slope" }).bands[0][4];
    expect(equatorSlope).toBeGreaterThan(0.5);
    expect(equatorSlope).toBeLessThan(0.6);
    expect(highLatitudeSlope).toBeGreaterThan(equatorSlope * 1.9);
  });
  it("rejects rotated or degenerate raster transforms for terrain analysis", () => {
    const data = raster([[1,2,3,4,5,6,7,8,9]], 3, 3);
    data.source!.transform = [0, 1, 0.25, 3, 0, -1];
    expect(() => runRasterOperation(data, { operation: "slope" })).toThrow("raster.reprojectionRequired");
    data.source!.transform = [0, 1, 2, 3, 2, 4];
    expect(() => runRasterOperation(data, { operation: "slope" })).toThrow("raster.invalidMetadata");
  });
  it("rejects same-sized rasters with different extents", () => {
    const before = raster([[1,2,3,4]]); const after = raster([[2,3,4,5]]);
    after.source!.bounds = [1,0,3,2];
    expect(() => runRasterOperation(before, { operation: "change_detection", changeMode: "difference" }, undefined, after)).toThrow("raster.gridMismatch");
  });
  it("rejects change detection when the rasters lack a comparable coordinate grid", () => {
    const before = raster([[1,2,3,4]]); const after = raster([[2,3,4,5]]);
    delete before.source;
    delete after.source;
    expect(() => runRasterOperation(before, { operation: "change_detection", changeMode: "difference" }, undefined, after)).toThrow("raster.gridMismatch");
  });
  it("requires AOI for zonal statistics and uses it for histogram and mean", () => {
    const data = raster([[1,100,3,200]]);
    expect(() => runRasterOperation(data, { operation: "zonal_statistics" })).toThrow("raster.invalidAoi");
    const result = runRasterOperation(data, { operation: "zonal_statistics", clipGeometry: { type: "Polygon", coordinates: [[[0,0],[1,0],[1,2],[0,2],[0,0]]] } });
    expect(result.stats!.mean).toBe(2);
    expect(result.stats!.pixelCount).toBe(2);
    expect(result.histogram!.reduce((a,b) => a+b, 0)).toBe(2);
  });
  it("supports clip, reclassify, terrain and change detection", () => {
    const data = raster([[1, 2, 3, 4], [5, 6, 7, 8]], 2, 2);
    expect(runRasterOperation(data, { operation: "clip", clipGeometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 2], [0, 2], [0, 0]]] } }).width).toBe(1);
    expect(Array.from(runRasterOperation(data, { operation: "reclassify", reclassRules: [{ min: 0, max: 4, value: 1 }, { min: 4, max: 10, value: 2 }] }).bands[0])).toEqual([1, 1, 1, 2]);
    const dem = raster([[1,2,3,4,5,6,7,8,9]], 3, 3);
    const slope = runRasterOperation(dem, { operation: "slope", scale: 1 });
    expect(Number.isFinite(slope.bands[0][4])).toBe(true);
    expect(slope.bands[0][0]).toBe(-9999);
    expect(Array.from(runRasterOperation(data, { operation: "change_detection", changeMode: "difference" }, undefined, raster([[2, 4, 6, 8], [1, 1, 1, 1]], 2, 2)).bands[0])).toEqual([1, 2, 3, 4]);
  });
});
