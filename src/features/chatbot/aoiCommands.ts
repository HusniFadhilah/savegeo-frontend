import { apiClient } from "@/services/apiClient";
import { useAoiStore } from "@/hooks/useAoiStore";
import { areaKm2, boundsFromGeoJSON } from "@/features/carbon/lib/geo";
import { getActiveMap, highlightPolygon } from "./mapActions";
import type { AoiFeature } from "@/types/map";

export interface AoiCandidate {
  osm_id: number;
  display_name: string;
  geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

export class AoiChoiceRequired extends Error {
  constructor(public candidates: AoiCandidate[]) {
    super("Ada beberapa AOI yang sesuai. Pilih batas wilayah yang dimaksud.");
  }
}

export function validateAoiGeometry(geometry: unknown): geometry is AoiCandidate["geojson"] {
  if (!geometry || typeof geometry !== "object") return false;
  const g = geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
  if (!["Polygon", "MultiPolygon"].includes(g.type) || !Array.isArray(g.coordinates)) return false;
  const polygons = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return (
    polygons.length > 0 &&
    polygons.every(
      (polygon) =>
        Array.isArray(polygon) &&
        polygon.length > 0 &&
        polygon.every(
          (ring) =>
            Array.isArray(ring) &&
            ring.length >= 4 &&
            ring.every(
              (point) =>
                Array.isArray(point) &&
                point.length >= 2 &&
                point.slice(0, 2).every((n) => typeof n === "number" && Number.isFinite(n)) &&
                Math.abs(point[0]) <= 180 &&
                Math.abs(point[1]) <= 90,
            ) &&
            ring[0][0] === ring[ring.length - 1][0] &&
            ring[0][1] === ring[ring.length - 1][1],
        ),
    )
  );
}

export function selectAoi(candidate: AoiCandidate): Record<string, unknown> {
  if (!validateAoiGeometry(candidate.geojson)) throw new Error("Batas AOI tidak valid.");
  const feature: AoiFeature = {
    type: "Feature",
    geometry: candidate.geojson,
    properties: { name: candidate.display_name, osm_id: candidate.osm_id },
  };
  const bounds = boundsFromGeoJSON(feature);
  if (!bounds) throw new Error("Batas AOI tidak dapat dihitung.");
  const map = getActiveMap();
  if (!map) throw new Error("Peta belum tersedia. Buka modul peta lalu coba lagi.");
  map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  useAoiStore
    .getState()
    .setAoi({
      source: "admin",
      name: candidate.display_name,
      feature,
      bounds,
      areaKm2: areaKm2(feature, bounds),
    });
  highlightPolygon(feature, { label: candidate.display_name, zoomTo: false });
  return { name: candidate.display_name, aoiExists: true };
}

export async function resolveAoi(query: unknown): Promise<Record<string, unknown>> {
  if (typeof query !== "string" || query.trim().length < 3 || query.length > 200)
    throw new Error("Nama AOI harus 3–200 karakter.");
  const data = await apiClient.get<{ results: AoiCandidate[] }>(
    `/utils/geocode/search?q=${encodeURIComponent(query.trim())}`,
  );
  const candidates = data.results.filter((c) => validateAoiGeometry(c.geojson));
  if (!candidates.length)
    throw new Error(
      `Batas wilayah “${query}” tidak ditemukan. Tambahkan kota/provinsi atau unggah poligon AOI.`,
    );
  if (candidates.length > 1) throw new AoiChoiceRequired(candidates);
  return selectAoi(candidates[0]);
}
