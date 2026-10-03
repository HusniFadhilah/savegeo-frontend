export const SATELLITE_BASEMAP_GROUPS = [
  { id: "esri", label: "Esri", basemapIds: ["satellite", "satellite_roads"] },
  { id: "nasa-gibs", label: "NASA GIBS", basemapIds: ["nasa-gibs", "nasa-gibs-viirs-night", "nasa-gibs-black-marble", "nasa-gibs-blue-marble"] },
  { id: "eox", label: "EOX", basemapIds: ["eox-sentinel2-cloudless"] },
  { id: "usgs", label: "USGS", basemapIds: ["usgs-imagery"] },
  { id: "mapbox", label: "Mapbox", basemapIds: ["mapbox-satellite"] },
  { id: "google", label: "Google", basemapIds: ["google-satellite"] },
] as const;

export const SATELLITE_BASEMAP_IDS = new Set<string>(SATELLITE_BASEMAP_GROUPS.flatMap((group) => group.basemapIds));

export function satelliteBasemapGroupId(basemapId: string | null): string | null {
  return SATELLITE_BASEMAP_GROUPS.find((group) => group.basemapIds.some((id) => id === basemapId))?.id ?? null;
}
