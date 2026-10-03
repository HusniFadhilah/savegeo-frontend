import type { BasemapDefinition } from "@/types/map";
import { nasaGibsTrueColorTileUrl } from "@/features/imagery/nasaGibs";

/**
 * Static fallback basemaps, used whenever GET /api/basemaps is unreachable
 * or returns an empty/invalid list. Mirrors the live backend registry
 * (savegeo/backend/app/registries/map_layer_registry.py) key-for-key so the
 * switcher looks identical whether the registry loaded or not. Satellite
 * MUST stay first/default here - this is the last line of defense if the
 * backend registry is down. Attributions kept short (provider + source
 * only) - full legal boilerplate isn't required for these providers.
 */
export const FALLBACK_BASEMAPS: BasemapDefinition[] = [
  {
    id: "satellite",
    name: "Esri Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics",
    maxZoom: 22,
    maxNativeZoom: 18,
    isDefault: true,
    order: 1,
  },
  {
    id: "roads",
    name: "Roads",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
    isDefault: false,
    order: 2,
  },
  {
    id: "satellite_roads",
    name: "Satellite + roads",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    overlayUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics",
    overlayAttribution: "Road reference &copy; Esri",
    maxZoom: 22,
    maxNativeZoom: 18,
    isDefault: false,
    order: 3,
  },
  {
    id: "topo",
    name: "Topographic",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors, SRTM | OpenTopoMap",
    maxZoom: 17,
    isDefault: false,
    order: 4,
  },
  {
    id: "terrain",
    name: "Terrain Relief",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxZoom: 13,
    isDefault: false,
    order: 5,
  },
  {
    id: "dark",
    name: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 19,
    isDefault: false,
    order: 6,
  },
  {
    id: "light",
    name: "Light",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 19,
    isDefault: false,
    order: 7,
  },
];

export const DEFAULT_BASEMAP_ID = "satellite";

/** NASA GIBS True Color is a daily visualization with a service-managed latest date. */
export function withNasaGibsBasemap(basemaps: BasemapDefinition[]): BasemapDefinition[] {
  const nasa: BasemapDefinition = {
    id: "nasa-gibs",
    name: "NASA GIBS MODIS True Color",
    url: nasaGibsTrueColorTileUrl("default"),
    attribution: '<a href="https://earthdata.nasa.gov/" target="_blank" rel="noreferrer">NASA Earthdata GIBS</a> · MODIS Terra Corrected Reflectance True Color',
    maxZoom: 22,
    maxNativeZoom: 9,
    isDefault: false,
    order: 1.5,
  };
  return [...basemaps.filter((basemap) => basemap.id !== nasa.id), nasa]
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

/** Add Mapbox only when a public, domain-restricted browser token is configured. */
export function withOptionalMapboxBasemap(basemaps: BasemapDefinition[]): BasemapDefinition[] {
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) return basemaps;

  const mapbox: BasemapDefinition = {
    id: "mapbox-satellite",
    name: "Mapbox Satellite",
    url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg90?access_token=${encodeURIComponent(token)}`,
    attribution: '<a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer">© Mapbox</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> <a href="https://www.maxar.com/" target="_blank" rel="noreferrer">© Maxar</a> <a href="https://apps.mapbox.com/feedback/" target="_blank" rel="noreferrer">Improve this map</a>',
    maxZoom: 22,
    maxNativeZoom: 22,
    isDefault: false,
    order: 1.8,
  };
  return [...basemaps.filter((basemap) => basemap.id !== mapbox.id), mapbox]
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}
