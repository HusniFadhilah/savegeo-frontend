import type { BasemapDefinition } from "@/types/map";

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
    name: "Satellite",
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
    id: "topo",
    name: "Topographic",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors, SRTM | OpenTopoMap",
    maxZoom: 17,
    isDefault: false,
    order: 3,
  },
  {
    id: "terrain",
    name: "Terrain Relief",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxZoom: 13,
    isDefault: false,
    order: 4,
  },
  {
    id: "dark",
    name: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 19,
    isDefault: false,
    order: 5,
  },
  {
    id: "light",
    name: "Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 19,
    isDefault: false,
    order: 6,
  },
];

export const DEFAULT_BASEMAP_ID = "satellite";
