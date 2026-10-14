import type { LatLngBounds, LatLngTuple } from "leaflet";

export function isValidMapCenter(center: unknown): center is LatLngTuple {
  if (!Array.isArray(center) || center.length < 2) return false;
  const [lat, lng] = center;
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  );
}

export function safeMapCenter(
  center: LatLngTuple | undefined,
  fallback: [number, number],
): [number, number] {
  return isValidMapCenter(center) ? [center[0], center[1]] : fallback;
}

export function safeMapZoom(zoom: number | undefined, maxZoom: number, fallback: number): number {
  if (typeof zoom !== "number" || !Number.isFinite(zoom)) return fallback;
  const safeMax = Number.isFinite(maxZoom) ? Math.min(22, Math.max(0, maxZoom)) : 22;
  return Math.min(Math.max(0, zoom), safeMax);
}

export function safeTileSize(tileSize: number | undefined): number {
  return typeof tileSize === "number" &&
    Number.isFinite(tileSize) &&
    Number.isInteger(tileSize) &&
    tileSize > 0 &&
    tileSize <= 1024
    ? tileSize
    : 256;
}

export function safeZoomOffset(offset: number | undefined): number {
  return typeof offset === "number" && Number.isFinite(offset) && Math.abs(offset) <= 22
    ? offset
    : 0;
}

/** Leaflet considers bounds valid when endpoints exist, even if they contain NaN/Infinity. */
export function isFiniteMapBounds(bounds: LatLngBounds | null | undefined): bounds is LatLngBounds {
  if (!bounds?.isValid()) return false;
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();
  return (
    [south, north, west, east].every(Number.isFinite) &&
    south >= -90 &&
    north <= 90 &&
    south <= north &&
    west >= -180 &&
    east <= 180 &&
    west <= east
  );
}
