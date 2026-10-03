import { describe, expect, it } from "vitest";
import { BASEMAP_FOR_HISTORICAL_SOURCE, historicalSourceForBasemap } from "./historicalBasemapSync";

describe("historical source and basemap synchronization", () => {
  it("pairs VIIRS nightly imagery and Black Marble with their own basemaps", () => {
    expect(BASEMAP_FOR_HISTORICAL_SOURCE["nasa-viirs-night"]).toBe("nasa-gibs-viirs-night");
    expect(BASEMAP_FOR_HISTORICAL_SOURCE["nasa-black-marble"]).toBe("nasa-gibs-black-marble");
    expect(historicalSourceForBasemap("nasa-gibs-viirs-night")).toBe("nasa-viirs-night");
    expect(historicalSourceForBasemap("nasa-gibs-black-marble")).toBe("nasa-black-marble");
  });

  it("pairs MODIS and EOX and returns to the active basemap for unrelated layers", () => {
    expect(BASEMAP_FOR_HISTORICAL_SOURCE["nasa-gibs"]).toBe("nasa-gibs");
    expect(historicalSourceForBasemap("nasa-gibs")).toBe("nasa-gibs");
    expect(BASEMAP_FOR_HISTORICAL_SOURCE["eox-cloudless"]).toBe("eox-sentinel2-cloudless");
    expect(historicalSourceForBasemap("eox-sentinel2-cloudless")).toBe("eox-cloudless");
    expect(historicalSourceForBasemap("nasa-gibs-blue-marble")).toBe("current-basemap");
    expect(historicalSourceForBasemap("satellite")).toBe("current-basemap");
  });
});
