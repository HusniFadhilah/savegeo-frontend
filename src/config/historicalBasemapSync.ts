export type HistoricalImagerySource =
  | "current-basemap"
  | "mapbox-satellite"
  | "esri-wayback"
  | "nasa-gibs"
  | "nasa-viirs-night"
  | "nasa-black-marble"
  | "eox-cloudless"
  | "copernicus-sentinel2";

/** Basemap to activate when a matching source is selected in the history panel. */
export const BASEMAP_FOR_HISTORICAL_SOURCE: Readonly<Record<HistoricalImagerySource, string | null>> = {
  "current-basemap": null,
  "mapbox-satellite": "mapbox-satellite",
  "esri-wayback": "satellite",
  "nasa-gibs": "nasa-gibs",
  "nasa-viirs-night": "nasa-gibs-viirs-night",
  "nasa-black-marble": "nasa-gibs-black-marble",
  "eox-cloudless": "eox-sentinel2-cloudless",
  "copernicus-sentinel2": null,
};

/** Keep the history selector aligned when a basemap is selected on the map. */
export function historicalSourceForBasemap(basemapId: string | null): HistoricalImagerySource {
  switch (basemapId) {
    case "mapbox-satellite": return "mapbox-satellite";
    case "nasa-gibs": return "nasa-gibs";
    case "nasa-gibs-viirs-night": return "nasa-viirs-night";
    case "nasa-gibs-black-marble": return "nasa-black-marble";
    case "eox-sentinel2-cloudless": return "eox-cloudless";
    default: return "current-basemap";
  }
}
