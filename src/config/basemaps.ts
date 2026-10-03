import type { BasemapDefinition } from "@/types/map";
import { nasaGibsBlackMarbleTileUrl, nasaGibsTrueColorTileUrl } from "@/features/imagery/nasaGibs";

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

/** Adds NASA GIBS daily imagery and fixed global composite basemaps. */
export function withNasaGibsBasemap(basemaps: BasemapDefinition[]): BasemapDefinition[] {
  const nasa: BasemapDefinition = {
    id: "nasa-gibs",
    name: "NASA GIBS MODIS Terra True Color",
    url: nasaGibsTrueColorTileUrl("default"),
    attribution: '<a href="https://earthdata.nasa.gov/" target="_blank" rel="noreferrer">NASA Earthdata GIBS</a> · MODIS Terra Corrected Reflectance True Color',
    maxZoom: 22,
    maxNativeZoom: 9,
    isDefault: false,
    order: 1.5,
  };
  const viirsNight: BasemapDefinition = {
    id: "nasa-gibs-viirs-night",
    name: "NASA GIBS VIIRS Day/Night 2012 composite",
    url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CityLights_2012/default//GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg",
    attribution: '<a href="https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs" target="_blank" rel="noreferrer">NASA Global Imagery Browse Services (GIBS)</a> - VIIRS Earth at Night 2012 composite',
    maxZoom: 22,
    maxNativeZoom: 8,
    isDefault: false,
    order: 1.6,
  };
  const blackMarble: BasemapDefinition = {
    id: "nasa-gibs-black-marble",
    name: "NASA GIBS VIIRS Black Marble 2016",
    url: nasaGibsBlackMarbleTileUrl(2016),
    attribution: '<a href="https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs" target="_blank" rel="noreferrer">NASA Global Imagery Browse Services (GIBS)</a> - VIIRS Black Marble 2016',
    maxZoom: 22,
    maxNativeZoom: 8,
    isDefault: false,
    order: 1.65,
  };
  const blueMarble: BasemapDefinition = {
    id: "nasa-gibs-blue-marble",
    name: "NASA GIBS Blue Marble",
    url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
    attribution: '<a href="https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs" target="_blank" rel="noreferrer">NASA Global Imagery Browse Services (GIBS)</a> - Blue Marble Next Generation',
    maxZoom: 22,
    maxNativeZoom: 8,
    isDefault: false,
    order: 1.7,
  };
  const nasaIds = new Set([nasa.id, viirsNight.id, blackMarble.id, blueMarble.id]);
  return [...basemaps.filter((basemap) => !nasaIds.has(basemap.id)), nasa, viirsNight, blackMarble, blueMarble]
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

/** Adds USGS The National Map imagery tiles. High-resolution coverage focuses on the United States. */
export function withUsgsImageryBasemap(basemaps: BasemapDefinition[]): BasemapDefinition[] {
  const usgs: BasemapDefinition = {
    id: "usgs-imagery",
    name: "USGS US Imagery",
    url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}",
    attribution: '<a href="https://www.usgs.gov/" target="_blank" rel="noreferrer">USGS</a>, USDA NAIP, The National Map',
    maxZoom: 22,
    maxNativeZoom: 16,
    isDefault: false,
    order: 1.45,
  };
  return [...basemaps.filter((basemap) => basemap.id !== usgs.id), usgs]
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

/** Adds the latest annual EOxCloudless mosaic as a selectable satellite basemap. */
export function withEoxCloudlessBasemap(basemaps: BasemapDefinition[]): BasemapDefinition[] {
  const eox: BasemapDefinition = {
    id: "eox-sentinel2-cloudless",
    name: "EOX Sentinel-2 Cloudless 2025",
    url: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg",
    attribution: '<a href="https://cloudless.eox.at/" target="_blank" rel="noreferrer">EOxCloudless</a> by <a href="https://eox.at/" target="_blank" rel="noreferrer">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data 2025; <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0, non-commercial use</a>)',
    maxZoom: 22,
    maxNativeZoom: 14,
    isDefault: false,
    order: 1.75,
  };
  return [...basemaps.filter((basemap) => basemap.id !== eox.id), eox]
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
