import { afterEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_BASEMAPS, withNasaGibsBasemap, withOptionalMapboxBasemap } from "./basemaps";

describe("NASA GIBS basemap", () => {
  it("is available as a daily, coarse-resolution satellite layer", () => {
    const basemap = withNasaGibsBasemap(FALLBACK_BASEMAPS).find((item) => item.id === "nasa-gibs");
    expect(basemap?.url).toContain("MODIS_Terra_CorrectedReflectance_TrueColor/default/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg");
    expect(basemap?.maxNativeZoom).toBe(9);
    expect(basemap?.attribution).toContain("NASA Earthdata GIBS");
  });
});

describe("optional Mapbox satellite basemap", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is omitted when no public token is configured", () => {
    vi.stubEnv("VITE_MAPBOX_ACCESS_TOKEN", "");
    expect(withOptionalMapboxBasemap(FALLBACK_BASEMAPS).some((basemap) => basemap.id === "mapbox-satellite")).toBe(false);
  });

  it("uses Mapbox's raster satellite tiles when a token is configured", () => {
    vi.stubEnv("VITE_MAPBOX_ACCESS_TOKEN", "pk.example");
    const basemap = withOptionalMapboxBasemap(FALLBACK_BASEMAPS).find((item) => item.id === "mapbox-satellite");
    expect(basemap?.url).toBe("https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg90?access_token=pk.example");
    expect(basemap?.attribution).toContain("© Maxar");
    expect(basemap?.maxNativeZoom).toBe(22);
  });
});
