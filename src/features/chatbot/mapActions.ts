import L from "leaflet";
import { RESULT_PANE } from "@/config/mapPanes";
import { isFiniteMapBounds, isValidMapCenter } from "@/components/map/mapViewValidation";
import { plainTextContent } from "@/lib/leafletText";

/**
 * The one typed abstraction the SaveGeo Assistant uses to read and drive the
 * Leaflet map(s): find the active map, move/fit/zoom with validated inputs,
 * highlight a geometry, and clean up when a map unmounts.
 *
 * The app creates several map instances (the AOI-drawing map in
 * features/carbon/components/AoiPanel.tsx, the results map in
 * ResultsMapPanel.tsx, one per module via components/map/MapView.tsx). Each
 * registers here; `getActiveMap()` prefers the visible one. The highlight is
 * remembered independently of any map instance and re-applied to whichever map
 * is active, so an AOI picked while one module's map is showing is still
 * highlighted after the user switches to another module.
 */
export type MapRole = "aoi" | "results";

const registry: Partial<Record<MapRole, L.Map>> = {};
const visibleMaps = new Set<L.Map>();
const trackedMaps = new Set<L.Map>();
const listeners = new Set<() => void>();

interface HighlightRequest {
  geometry: GeoJSON.Geometry | GeoJSON.Feature;
  color?: string;
  label?: string;
}
let lastHighlight: HighlightRequest | null = null;
let highlightOwner: L.Map | null = null;
let highlightLayer: L.GeoJSON | null = null;

function notify(): void {
  syncHighlight();
  [...listeners].forEach((listener) => listener());
}

/** Calls `listener` whenever a map registers, unregisters or changes visibility. */
export function subscribeMapChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function registerMap(role: MapRole, map: L.Map | null): void {
  if (map) registry[role] = map;
  else delete registry[role];
  notify();
}

export function registerVisibleMap(map: L.Map, active: boolean): () => void {
  trackedMaps.add(map);
  if (active) visibleMaps.add(map);
  else visibleMaps.delete(map);
  notify();
  return () => {
    visibleMaps.delete(map);
    trackedMaps.delete(map);
    forgetHighlightOn(map);
    notify();
  };
}

function isMountedMap(map: L.Map | undefined | null): map is L.Map {
  if (!map) return false;
  try {
    return map.getContainer().isConnected;
  } catch {
    return false;
  }
}

export function getActiveMap(): L.Map | null {
  for (const map of [...visibleMaps].reverse()) {
    if (isMountedMap(map)) return map;
    visibleMaps.delete(map);
    forgetHighlightOn(map);
  }
  if (trackedMaps.size > 0) return null;
  // MapContainer removes its Leaflet instance when its route unmounts. A
  // stored instance can still exist in this registry, but calling getCenter
  // or flyTo after removal may dereference Leaflet's destroyed map pane.
  if (!isMountedMap(registry.results)) delete registry.results;
  if (!isMountedMap(registry.aoi)) delete registry.aoi;
  return registry.results || registry.aoi || null;
}

/** Resolves with the active map as soon as one is available, or null after `timeoutMs`. */
export function waitForActiveMap(timeoutMs = 4000, signal?: AbortSignal): Promise<L.Map | null> {
  const existing = getActiveMap();
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    // eslint-disable-next-line prefer-const -- referenced by finish() before assignment
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (map: L.Map | null) => {
      clearTimeout(timer);
      unsubscribe();
      signal?.removeEventListener("abort", onAbort);
      resolve(map);
    };
    const onAbort = () => finish(null);
    const unsubscribe = subscribeMapChanges(() => {
      const map = getActiveMap();
      if (map) finish(map);
    });
    timer = setTimeout(() => finish(getActiveMap()), timeoutMs);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function clampZoom(map: L.Map, zoom: number): number {
  const min = map.getMinZoom?.();
  const max = map.getMaxZoom?.();
  let result = Number.isFinite(zoom) ? zoom : 13;
  if (typeof min === "number" && Number.isFinite(min)) result = Math.max(min, result);
  if (typeof max === "number" && Number.isFinite(max)) result = Math.min(max, result);
  return result;
}

export function zoomToLocation(lat: number, lng: number, zoom = 13): boolean {
  const map = getActiveMap();
  if (!map || !isValidMapCenter([lat, lng])) return false;
  map.flyTo([lat, lng], clampZoom(map, zoom), { duration: 1.2 });
  return true;
}

/** Fit validated bounds. Never throws; returns false when the bounds are unusable or no map exists. */
export function fitBoundsSafe(
  bounds: L.LatLngBounds,
  options?: { padding?: [number, number]; maxZoom?: number },
): boolean {
  const map = getActiveMap();
  if (!map || !isFiniteMapBounds(bounds)) return false;
  try {
    map.fitBounds(bounds, {
      padding: options?.padding ?? [30, 30],
      maxZoom: options?.maxZoom === undefined ? undefined : clampZoom(map, options.maxZoom),
    });
    return true;
  } catch (error) {
    console.warn("GeoAI: fitBounds failed", error);
    return false;
  }
}

/** Strict set-view for the typed `set_map_view` command: invalid input is rejected, not clamped. */
export function setMapView(
  center: unknown,
  zoom: unknown,
): { center: [number, number]; zoom: number } {
  const map = getActiveMap();
  if (!map) throw new Error("Peta belum tersedia pada layar.");
  if (
    !isValidMapCenter(center) ||
    typeof zoom !== "number" ||
    !Number.isFinite(zoom) ||
    zoom < map.getMinZoom() ||
    zoom > map.getMaxZoom()
  ) {
    throw new Error("Koordinat atau zoom peta tidak valid.");
  }
  map.setView([center[0], center[1]], zoom);
  const now = map.getCenter();
  return { center: [now.lat, now.lng], zoom: map.getZoom() };
}

export function zoomToFeature(
  geometry: GeoJSON.Geometry | GeoJSON.Feature,
  options?: { maxZoom?: number },
): boolean {
  try {
    const bounds = L.geoJSON(geometry as GeoJSON.GeoJSON).getBounds();
    return fitBoundsSafe(bounds, { padding: [40, 40], maxZoom: options?.maxZoom ?? 16 });
  } catch (e) {
    console.warn("GeoAI: zoomToFeature failed", e);
    return false;
  }
}

function removeHighlightLayer(): void {
  if (highlightLayer && highlightOwner) {
    try {
      highlightOwner.removeLayer(highlightLayer);
    } catch {
      // The owning map was already torn down; the layer went with it.
    }
  }
  highlightLayer = null;
  highlightOwner = null;
}

function forgetHighlightOn(map: L.Map): void {
  if (highlightOwner === map) {
    highlightLayer = null;
    highlightOwner = null;
  }
}

function drawHighlight(map: L.Map, request: HighlightRequest): boolean {
  try {
    const layer = L.geoJSON(request.geometry as GeoJSON.GeoJSON, {
      pane: map.getPane(RESULT_PANE) ? RESULT_PANE : undefined,
      style: {
        color: request.color || "#facc15",
        weight: 3,
        fillColor: "#facc15",
        fillOpacity: 0.25,
      },
    });
    if (!isFiniteMapBounds(layer.getBounds())) return false;
    layer.addTo(map);
    if (request.label) layer.bindTooltip(plainTextContent(request.label), { permanent: false });
    highlightLayer = layer;
    highlightOwner = map;
    return true;
  } catch (e) {
    console.warn("GeoAI: highlight failed", e);
    return false;
  }
}

/** Move the remembered highlight onto the current active map (no-op when already there). */
function syncHighlight(): void {
  if (!lastHighlight) return;
  const map = getActiveMap();
  if (!map || map === highlightOwner) return;
  removeHighlightLayer();
  drawHighlight(map, lastHighlight);
}

/** Highlights one geometry, replacing any previous highlight. Optionally fits the map to it. */
export function highlightPolygon(
  geometry: GeoJSON.Geometry | GeoJSON.Feature,
  options?: { color?: string; label?: string; zoomTo?: boolean },
): boolean {
  const map = getActiveMap();
  if (!map) return false;
  removeHighlightLayer();
  lastHighlight = { geometry, color: options?.color, label: options?.label };
  const drawn = drawHighlight(map, lastHighlight);
  if (!drawn) lastHighlight = null;
  else if (options?.zoomTo !== false) zoomToFeature(geometry);
  return drawn;
}

export function clearHighlight(): void {
  removeHighlightLayer();
  lastHighlight = null;
}
