import L from "leaflet";
import { RESULT_PANE } from "@/config/mapPanes";

/**
 * Real map zoom/highlight actions for the Geo-AI Assistant (spec section 3),
 * on top of the actual Leaflet map instance(s) the app already creates via
 * react-leaflet's MapView (see components/map/MapView.tsx). There are two
 * separate map instances in this app - the AOI-drawing map
 * (features/carbon/components/AoiPanel.tsx) and the results map
 * (features/carbon/components/ResultsMapPanel.tsx) - both register
 * themselves here via `registerMap()`; `getActiveMap()` prefers whichever
 * was mounted most recently under the "results" role (what's actually
 * visible once an analysis has run), falling back to "aoi".
 */
export type MapRole = "aoi" | "results";

const registry: Partial<Record<MapRole, L.Map>> = {};
let highlightLayer: L.GeoJSON | null = null;

export function registerMap(role: MapRole, map: L.Map | null): void {
  if (map) registry[role] = map;
  else delete registry[role];
}

export function getActiveMap(): L.Map | null {
  return registry.results || registry.aoi || null;
}

export function zoomToLocation(lat: number, lng: number, zoom = 13): void {
  const map = getActiveMap();
  if (!map) return;
  map.flyTo([lat, lng], zoom, { duration: 1.2 });
}

export function zoomToFeature(geometry: GeoJSON.Geometry | GeoJSON.Feature, options?: { maxZoom?: number }): void {
  const map = getActiveMap();
  if (!map) return;
  try {
    const layer = L.geoJSON(geometry as GeoJSON.GeoJSON);
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: options?.maxZoom ?? 16 });
    }
  } catch (e) {
    console.warn("GeoAI: zoomToFeature failed", e);
  }
}

/** Adds a temporary pulsing highlight layer for one geometry, replacing any previous highlight. */
export function highlightPolygon(
  geometry: GeoJSON.Geometry | GeoJSON.Feature,
  options?: { color?: string; label?: string; zoomTo?: boolean },
): void {
  const map = getActiveMap();
  if (!map) return;

  if (highlightLayer) {
    map.removeLayer(highlightLayer);
    highlightLayer = null;
  }

  try {
    highlightLayer = L.geoJSON(geometry as GeoJSON.GeoJSON, {
      pane: map.getPane(RESULT_PANE) ? RESULT_PANE : undefined,
      style: { color: options?.color || "#facc15", weight: 3, fillColor: "#facc15", fillOpacity: 0.25 },
    }).addTo(map);
    if (options?.label) highlightLayer.bindTooltip(options.label, { permanent: false });
    if (options?.zoomTo !== false) zoomToFeature(geometry);
  } catch (e) {
    console.warn("GeoAI: highlightPolygon failed", e);
  }
}

export function clearHighlight(): void {
  const map = getActiveMap();
  if (map && highlightLayer) map.removeLayer(highlightLayer);
  highlightLayer = null;
}
