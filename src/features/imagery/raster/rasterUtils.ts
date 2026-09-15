import type { RasterData } from "./rasterTypes";

export function valid(value: number, nodata: number | null): boolean {
  return Number.isFinite(value) && (nodata == null || value !== nodata);
}
export function clamp(value: number, min = -Infinity, max = Infinity) { return Math.min(max, Math.max(min, value)); }
export function percentile(values: number[], p: number): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b); const index = (sorted.length - 1) * clamp(p, 0, 100) / 100;
  const lower = Math.floor(index); const upper = Math.ceil(index); return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}
export function firstBand(data: RasterData) { if (!data.bands[0]) throw new Error("raster.noValidPixels"); return data.bands[0]; }
export function bboxOfGeometry(geometry: GeoJSON.Geometry | GeoJSON.Feature): [number, number, number, number] {
  const g = "geometry" in geometry ? geometry.geometry : geometry; const positions: number[][] = [];
  const visit = (value: unknown): void => { if (Array.isArray(value) && typeof value[0] === "number") positions.push(value as number[]); else if (Array.isArray(value)) value.forEach(visit); };
  if (g.type === "GeometryCollection") g.geometries.forEach((geometry) => { if (geometry.type === "GeometryCollection") geometry.geometries.forEach((nested) => { if ("coordinates" in nested) visit(nested.coordinates); }); else if ("coordinates" in geometry) visit(geometry.coordinates); });
  else if ("coordinates" in g) visit(g.coordinates);
  if (!positions.length) throw new Error("raster.invalidAoi");
  const xs = positions.map(p => p[0]); const ys = positions.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
export function pointInGeometry(x: number, y: number, geometry: GeoJSON.Geometry | GeoJSON.Feature): boolean {
  const g = "geometry" in geometry ? geometry.geometry : geometry; if (!g || g.type === "Point") return false;
  const insideRing = (ring: GeoJSON.Position[]) => { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]; const intersects = yi > y !== yj > y && x < (xj - xi) * (y - yi) / ((yj - yi) || Number.EPSILON) + xi; if (intersects) inside = !inside; } return inside; };
  if (g.type === "Polygon") return insideRing(g.coordinates[0]) && !g.coordinates.slice(1).some(insideRing);
  if (g.type === "MultiPolygon") return g.coordinates.some(polygon => insideRing(polygon[0]) && !polygon.slice(1).some(insideRing));
  return false;
}
export function dimensions(data: RasterData) { return data.width * data.height; }
