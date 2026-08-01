import L from "leaflet";
import type { AoiFeature } from "@/types/map";

/**
 * Spherical-excess polygon area (m^2), ported 1:1 from legacy
 * `calculateAreaFromGeoJSON` in frontend-nextjs2/public/main.js. Works on
 * Polygon/MultiPolygon/GeometryCollection/Feature/FeatureCollection.
 */
export function calculateAreaFromGeoJSON(geojson: unknown): number | null {
  if (!geojson) return null;
  const EARTH_RADIUS = 6378137;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  function ringArea(ring: number[][]): number {
    if (!Array.isArray(ring) || ring.length < 3) return 0;
    let area = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const current = ring[i];
      const previous = ring[j];
      if (!current || !previous) continue;
      const lonDelta = toRad(current[0] - previous[0]);
      const currentLat = toRad(current[1]);
      const previousLat = toRad(previous[1]);
      area += lonDelta * (2 + Math.sin(previousLat) + Math.sin(currentLat));
    }
    return (area * EARTH_RADIUS * EARTH_RADIUS) / 2;
  }

  function geometryArea(geometry: GeoJSON.Geometry | null | undefined): number {
    if (!geometry) return 0;
    if (geometry.type === "Polygon") {
      const rings = geometry.coordinates || [];
      if (!rings.length) return 0;
      const outer = Math.abs(ringArea(rings[0] as number[][]));
      const holes = rings
        .slice(1)
        .reduce((sum: number, ring) => sum + Math.abs(ringArea(ring as number[][])), 0);
      return Math.max(outer - holes, 0);
    }
    if (geometry.type === "MultiPolygon") {
      return (geometry.coordinates || []).reduce(
        (sum: number, polygon) => sum + geometryArea({ type: "Polygon", coordinates: polygon }),
        0,
      );
    }
    if (geometry.type === "GeometryCollection") {
      return (geometry.geometries || []).reduce(
        (sum: number, child) => sum + geometryArea(child),
        0,
      );
    }
    return 0;
  }

  let areaM2 = 0;
  const gj = geojson as GeoJSON.GeoJSON;
  if (gj.type === "FeatureCollection") {
    areaM2 = (gj.features || []).reduce((sum, f) => sum + geometryArea(f.geometry), 0);
  } else if (gj.type === "Feature") {
    areaM2 = geometryArea(gj.geometry);
  } else {
    areaM2 = geometryArea(gj as GeoJSON.Geometry);
  }

  return areaM2 > 0 ? areaM2 / 1_000_000 : null;
}

/** Bounding box area (km^2) fallback, ported from `calculateAreaFromBounds`. */
export function calculateAreaFromBounds(bounds: L.LatLngBounds): number {
  const latDiff = Math.abs(bounds.getSouth() - bounds.getNorth());
  const lonDiff = Math.abs(bounds.getWest() - bounds.getEast());
  return latDiff * 111 * lonDiff * 111 * Math.cos((bounds.getCenter().lat * Math.PI) / 180);
}

/** Area in km^2 for a GeoJSON geometry/feature, with bounding-box fallback. */
export function areaKm2(geojson: unknown, bounds?: L.LatLngBounds | null): number | null {
  const fromGeom = calculateAreaFromGeoJSON(geojson);
  if (fromGeom !== null) return fromGeom;
  if (bounds) return calculateAreaFromBounds(bounds);
  return null;
}

/** Leaflet bounds for a GeoJSON feature/geometry, without needing a live map. */
export function boundsFromGeoJSON(geojson: unknown): L.LatLngBounds | null {
  try {
    const layer = L.geoJSON(geojson as GeoJSON.GeoJSON);
    const bounds = layer.getBounds();
    return bounds.isValid() ? bounds : null;
  } catch {
    return null;
  }
}

/** Bounding-box AOI payload shape expected by /analyze/* endpoints. */
export interface AoiBoundsPayload {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Union AOI payload sent to the backend: prefer the real polygon geometry. */
export type AoiPayload = { geojson: AoiFeature } | AoiBoundsPayload;

export function boundsToPayload(bounds: L.LatLngBounds): AoiBoundsPayload {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return { west: sw.lng, south: sw.lat, east: ne.lng, north: ne.lat };
}
