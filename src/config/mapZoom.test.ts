import { describe, expect, it } from "vitest";
import { nativeZoomForResolution } from "./mapZoom";

describe("native raster zoom", () => {
  it("samples Sentinel-2 at its actual 10/20/60 metre GSD", () => {
    expect([10, 20, 60].map(nativeZoomForResolution)).toEqual([14, 13, 12]);
  });
  it("distinguishes Landsat and sub-metre imagery without interpolation factors", () => {
    expect(nativeZoomForResolution(30)).toBe(13);
    expect(nativeZoomForResolution(.5)).toBe(19);
    expect(nativeZoomForResolution(NaN)).toBe(18);
    expect(nativeZoomForResolution(-1)).toBe(18);
  });
});
