import { afterEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_BASEMAPS, withEoxCloudlessBasemap, withNasaGibsBasemap, withOptionalMapboxBasemap, withUsgsImageryBasemap } from "./basemaps";
import { SATELLITE_BASEMAP_GROUPS } from "./satelliteBasemapGroups";

describe("NASA GIBS basemap", () => {
  it("is available as a daily, coarse-resolution satellite layer", () => {
    const basemap = withNasaGibsBasemap(FALLBACK_BASEMAPS).find((item) => item.id === "nasa-gibs");
    expect(basemap?.url).toContain("MODIS_Terra_CorrectedReflectance_TrueColor/default/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg");
    expect(basemap?.maxNativeZoom).toBe(9);
    expect(basemap?.attribution).toContain("NASA Earthdata GIBS");
  });

  it("includes fixed VIIRS night lights and Blue Marble source imagery", () => {
    const basemaps = withNasaGibsBasemap(FALLBACK_BASEMAPS);
    const nightLights = basemaps.find((item) => item.id === "nasa-gibs-viirs-night");
    const blackMarble = basemaps.find((item) => item.id === "nasa-gibs-black-marble");
    const blueMarble = basemaps.find((item) => item.id === "nasa-gibs-blue-marble");

    expect(nightLights?.url).toContain("VIIRS_CityLights_2012/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg");
    expect(nightLights?.maxNativeZoom).toBe(8);
    expect(blackMarble?.url).toContain("VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png");
    expect(blackMarble?.name).toContain("Black Marble");
    expect(blueMarble?.url).toContain("BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg");
    expect(blueMarble?.maxNativeZoom).toBe(8);
  });
});

describe("optional Mapbox satellite basemap", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is omitted when no public token is configured", () => {
    vi.stubEnv("VITE_MAPBOX_ACCESS_TOKEN", "");
    const basemaps = withOptionalMapboxBasemap(FALLBACK_BASEMAPS);
    expect(basemaps.some((basemap) => basemap.id === "mapbox-satellite")).toBe(false);
    expect(basemaps.some((basemap) => basemap.id === "mapbox-satellite-roads")).toBe(false);
  });

  it("provides Mapbox satellite-only and satellite-with-roads layers when a token is configured", () => {
    vi.stubEnv("VITE_MAPBOX_ACCESS_TOKEN", "pk.example");
    const basemaps = withOptionalMapboxBasemap(FALLBACK_BASEMAPS);
    const satellite = basemaps.find((item) => item.id === "mapbox-satellite");
    const satelliteRoads = basemaps.find((item) => item.id === "mapbox-satellite-roads");

    expect(satellite?.url).toBe("https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=pk.example");
    expect(satellite?.attribution).toContain("Maxar");
    expect(satellite?.maxNativeZoom).toBe(22);
    expect(satelliteRoads?.url).toBe("https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}?access_token=pk.example");
    expect(satelliteRoads?.attribution).toContain("OpenStreetMap");
    expect(satelliteRoads?.maxNativeZoom).toBe(22);
    expect(basemaps.findIndex((item) => item.id === "mapbox-satellite-roads"))
      .toBe(basemaps.findIndex((item) => item.id === "mapbox-satellite") + 1);
  });
});

describe("Mapbox satellite basemap group", () => {
  it("shows plain and road-overlay styles together under Mapbox", () => {
    const group = SATELLITE_BASEMAP_GROUPS.find((item) => item.id === "mapbox");
    expect(group?.basemapIds).toEqual(["mapbox-satellite", "mapbox-satellite-roads"]);
  });
});

describe("EOX Sentinel-2 Cloudless basemap", () => {
  it("adds the latest annual mosaic with attribution and zoom limits", () => {
    const basemap = withEoxCloudlessBasemap(FALLBACK_BASEMAPS).find((item) => item.id === "eox-sentinel2-cloudless");
    expect(basemap?.url).toContain("s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg");
    expect(basemap?.attribution).toContain("CC BY-NC-SA 4.0");
    expect(basemap?.maxNativeZoom).toBe(14);
  });
});

describe("USGS US Imagery basemap", () => {
  it("uses the USGS National Map cached imagery tiles and attribution", () => {
    const basemap = withUsgsImageryBasemap(FALLBACK_BASEMAPS).find((item) => item.id === "usgs-imagery");
    expect(basemap?.url).toBe("https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}");
    expect(basemap?.attribution).toContain("USGS");
    expect(basemap?.maxNativeZoom).toBe(16);
  });
});
