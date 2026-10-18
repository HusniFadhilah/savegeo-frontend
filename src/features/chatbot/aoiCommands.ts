import type L from "leaflet";
import { apiClient } from "@/services/apiClient";
import { useAoiStore, type AoiSource } from "@/hooks/useAoiStore";
import { areaKm2, boundsFromGeoJSON } from "@/features/carbon/lib/geo";
import { fitBoundsSafe, getActiveMap, highlightPolygon, waitForActiveMap } from "./mapActions";
import { openDashboardModule } from "./navigation";
import type { AoiFeature, AoiGeometry } from "@/types/map";

/**
 * The assistant's only route for changing the shared AOI.
 *
 * Source of truth is `useAoiStore`; every module (Carbon, LC-Change, Imagery,
 * Disaster, Crop) already follows it. The chatbot therefore never touches module
 * state or the DOM: it resolves a real administrative boundary, validates it,
 * commits it to the store, and asks `mapActions` to fit and highlight it.
 */
export type AreaLevel = "province" | "regency" | "city" | "district" | "village" | "other";

/** One administrative-area hit, as returned by `GET /utils/geocode/search`. */
export interface AoiCandidate {
  area_id: string;
  name: string;
  display_name: string;
  level: AreaLevel;
  hierarchy: Record<string, string>;
  centroid: { lat: number; lng: number } | null;
  bbox: [number, number, number, number] | null;
  geometry: AoiGeometry | null;
  geometry_ref?: string;
  source: string;
  /** True only when the backend found exactly one unambiguous match for the query. */
  exact_match: boolean;
}

export class AoiChoiceRequired extends Error {
  constructor(public candidates: AoiCandidate[]) {
    super("Ada beberapa AOI yang sesuai. Pilih batas wilayah yang dimaksud.");
  }
}

/** A newer AOI request replaced this one; its result must be discarded. */
export class AoiRequestSuperseded extends Error {
  constructor() {
    super("Permintaan AOI digantikan oleh permintaan yang lebih baru.");
    this.name = "AoiRequestSuperseded";
  }
}

export const MAX_AOI_VERTICES = 30_000;

export const LEVEL_LABELS: Record<AreaLevel, string> = {
  province: "Provinsi",
  regency: "Kabupaten",
  city: "Kota",
  district: "Kecamatan",
  village: "Desa/Kelurahan",
  other: "Wilayah",
};

function isLngLat(point: unknown): point is [number, number] {
  return (
    Array.isArray(point) &&
    point.length >= 2 &&
    typeof point[0] === "number" &&
    typeof point[1] === "number" &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1]) &&
    Math.abs(point[0]) <= 180 &&
    Math.abs(point[1]) <= 90
  );
}

/**
 * Strict Polygon/MultiPolygon check: finite in-range coordinates, closed rings of
 * at least four positions, a bounded vertex count (browser safety) and a
 * non-degenerate extent.
 */
export function validateAoiGeometry(geometry: unknown): geometry is AoiGeometry {
  if (!geometry || typeof geometry !== "object") return false;
  const g = geometry as { type?: unknown; coordinates?: unknown };
  if ((g.type !== "Polygon" && g.type !== "MultiPolygon") || !Array.isArray(g.coordinates)) {
    return false;
  }
  const polygons = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as unknown[];
  if (polygons.length === 0) return false;
  let vertices = 0;
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || polygon.length === 0) return false;
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) return false;
      vertices += ring.length;
      if (vertices > MAX_AOI_VERTICES) return false;
      const first = ring[0] as unknown[];
      const last = ring[ring.length - 1] as unknown[];
      if (first?.[0] !== last?.[0] || first?.[1] !== last?.[1]) return false;
      for (const point of ring) {
        if (!isLngLat(point)) return false;
        west = Math.min(west, point[0]);
        east = Math.max(east, point[0]);
        south = Math.min(south, point[1]);
        north = Math.max(north, point[1]);
      }
    }
  }
  return east > west && north > south;
}

const LEVELS: readonly AreaLevel[] = ["province", "regency", "city", "district", "village", "other"];

/** Accepts the current contract and the older `{osm_id, geojson}` shape; returns null if unusable. */
export function normalizeCandidate(raw: unknown): AoiCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const displayName =
    typeof r.display_name === "string" ? r.display_name : typeof r.name === "string" ? r.name : "";
  const id =
    typeof r.area_id === "string" && r.area_id
      ? r.area_id
      : r.osm_id !== undefined
        ? `osm:${String(r.osm_id)}`
        : "";
  if (!displayName || !id) return null;
  const geometry = validateAoiGeometry(r.geometry ?? r.geojson)
    ? ((r.geometry ?? r.geojson) as AoiGeometry)
    : null;
  const centroid = r.centroid as { lat?: unknown; lng?: unknown } | null | undefined;
  const bbox = Array.isArray(r.bbox) && r.bbox.length === 4 && r.bbox.every(Number.isFinite);
  return {
    area_id: id,
    name: typeof r.name === "string" && r.name ? r.name : displayName.split(",")[0],
    display_name: displayName,
    level: LEVELS.includes(r.level as AreaLevel) ? (r.level as AreaLevel) : "other",
    hierarchy:
      r.hierarchy && typeof r.hierarchy === "object" ? (r.hierarchy as Record<string, string>) : {},
    centroid:
      centroid && Number.isFinite(centroid.lat) && Number.isFinite(centroid.lng)
        ? { lat: centroid.lat as number, lng: centroid.lng as number }
        : null,
    bbox: bbox ? (r.bbox as [number, number, number, number]) : null,
    geometry,
    geometry_ref: typeof r.geometry_ref === "string" ? r.geometry_ref : undefined,
    source: typeof r.source === "string" ? r.source : "unknown",
    exact_match: r.exact_match === true,
  };
}

/* ── Request ordering ───────────────────────────────────────────────────── */

let inflight: AbortController | null = null;
let generation = 0;

/** Cancel any AOI lookup/selection still in flight (e.g. when the user sends a new message). */
export function cancelAoiResolution(): void {
  generation += 1;
  inflight?.abort();
  inflight = null;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/* ── Map readiness ──────────────────────────────────────────────────────── */

export interface EnsureMapOptions {
  /** How long to wait for an already-mounting map before opening the map module. */
  settleMs?: number;
  /** How long to wait for the map module to mount. */
  mountMs?: number;
  signal?: AbortSignal;
}

/** Returns an active map, opening the Carbon (AOI) module first when none is on screen. */
export async function ensureMap(options: EnsureMapOptions = {}): Promise<L.Map> {
  const { settleMs = 600, mountMs = 5000, signal } = options;
  let map = getActiveMap() ?? (await waitForActiveMap(settleMs, signal));
  if (!map) {
    openDashboardModule("carbon");
    map = await waitForActiveMap(mountMs, signal);
  }
  if (!map) {
    throw new Error("Peta belum tersedia. Buka modul peta (mis. Carbon Stock) lalu coba lagi.");
  }
  return map;
}

/* ── Commit & focus ─────────────────────────────────────────────────────── */

function toFeature(geometry: AoiGeometry, properties: Record<string, unknown>): AoiFeature {
  return { type: "Feature", geometry, properties };
}

function stateOf(
  name: string,
  feature: AoiFeature,
  bounds: L.LatLngBounds,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    name,
    aoiExists: true,
    areaKm2: areaKm2(feature, bounds),
    bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
    ...extra,
  };
}

function commitAndFocus(
  feature: AoiFeature,
  bounds: L.LatLngBounds,
  name: string,
  source: AoiSource,
): void {
  useAoiStore.getState().setAoi({
    source,
    name,
    feature,
    bounds,
    areaKm2: areaKm2(feature, bounds),
  });
  fitBoundsSafe(bounds, { padding: [30, 30], maxZoom: 14 });
  highlightPolygon(feature, { label: name, zoomTo: false });
}

/**
 * Make `candidate` the active AOI. Validation and map readiness are checked
 * first, so a failure never replaces the AOI the user already has.
 */
export async function selectAoi(
  candidate: AoiCandidate,
  options: EnsureMapOptions = {},
): Promise<Record<string, unknown>> {
  const ticket = ++generation;
  if (!candidate.geometry || !validateAoiGeometry(candidate.geometry)) {
    throw new Error("Batas AOI tidak valid atau tidak tersedia.");
  }
  const feature = toFeature(candidate.geometry, {
    name: candidate.display_name,
    area_id: candidate.area_id,
    level: candidate.level,
    source: candidate.source,
  });
  const bounds = boundsFromGeoJSON(feature);
  if (!bounds) throw new Error("Batas AOI tidak dapat dihitung.");
  await ensureMap(options);
  if (ticket !== generation) throw new AoiRequestSuperseded();
  commitAndFocus(feature, bounds, candidate.display_name, "admin");
  return stateOf(candidate.display_name, feature, bounds, {
    areaId: candidate.area_id,
    level: candidate.level,
  });
}

/** Re-focus the map on the AOI that is already active ("Gunakan AOI yang sedang aktif"). */
export async function confirmActiveAoi(
  options: EnsureMapOptions = {},
): Promise<Record<string, unknown>> {
  const aoi = useAoiStore.getState().aoi;
  if (!aoi) {
    throw new Error("Belum ada AOI aktif. Sebutkan nama wilayah atau gambar AOI di peta.");
  }
  const bounds = aoi.bounds ?? boundsFromGeoJSON(aoi.feature);
  if (!bounds) throw new Error("Batas AOI aktif tidak dapat dihitung.");
  await ensureMap(options);
  fitBoundsSafe(bounds, { padding: [30, 30], maxZoom: 14 });
  highlightPolygon(aoi.feature, { label: aoi.name, zoomTo: false });
  return stateOf(aoi.name, aoi.feature, bounds, { activeAoi: true });
}

function polygonFromGeoJSON(input: unknown): AoiGeometry | null {
  const node = input as { type?: string; features?: unknown[]; geometry?: unknown } | null;
  if (!node || typeof node !== "object") return null;
  if (node.type === "FeatureCollection" && Array.isArray(node.features)) {
    for (const feature of node.features) {
      const found = polygonFromGeoJSON(feature);
      if (found) return found;
    }
    return null;
  }
  const geometry = node.type === "Feature" ? node.geometry : node;
  return validateAoiGeometry(geometry) ? geometry : null;
}

/** Use an uploaded/parsed GeoJSON polygon as the active AOI. */
export async function applyGeoJsonAoi(
  input: unknown,
  name: string,
  options: EnsureMapOptions = {},
): Promise<Record<string, unknown>> {
  const geometry = polygonFromGeoJSON(input);
  if (!geometry) throw new Error("File tidak berisi Polygon/MultiPolygon yang valid.");
  const feature = toFeature(geometry, { name, source: "upload" });
  const bounds = boundsFromGeoJSON(feature);
  if (!bounds) throw new Error("Batas AOI tidak dapat dihitung.");
  await ensureMap(options);
  commitAndFocus(feature, bounds, name, "upload");
  return stateOf(name, feature, bounds);
}

/* ── Search ─────────────────────────────────────────────────────────────── */

/** Look up administrative-area candidates; a newer call cancels this one. */
export async function searchAoiCandidates(query: string): Promise<AoiCandidate[]> {
  cancelAoiResolution();
  const controller = new AbortController();
  inflight = controller;
  const ticket = generation;
  try {
    const data = await apiClient.get<{ results?: unknown[] }>(
      `/utils/geocode/search?q=${encodeURIComponent(query.trim())}&limit=8`,
      { signal: controller.signal },
    );
    if (controller.signal.aborted || ticket !== generation) throw new AoiRequestSuperseded();
    return (data?.results ?? []).map(normalizeCandidate).filter((c): c is AoiCandidate => c !== null);
  } catch (error) {
    if (controller.signal.aborted || isAbort(error)) throw new AoiRequestSuperseded();
    throw error;
  } finally {
    if (inflight === controller) inflight = null;
  }
}

/**
 * Resolve a place name to an AOI. Selected automatically only when the backend
 * flags a single exact match (or returns just one usable boundary); anything
 * ambiguous raises `AoiChoiceRequired` so the user picks.
 */
export async function resolveAoi(
  query: unknown,
  options: EnsureMapOptions = {},
): Promise<Record<string, unknown>> {
  if (typeof query !== "string" || query.trim().length < 3 || query.length > 200) {
    throw new Error("Nama AOI harus 3–200 karakter.");
  }
  const usable = (await searchAoiCandidates(query)).filter((c) => c.geometry !== null);
  if (!usable.length) {
    throw new Error(
      `Batas wilayah “${query}” tidak ditemukan. Tambahkan kota/provinsi atau unggah poligon AOI.`,
    );
  }
  const exact = usable.filter((c) => c.exact_match);
  if (exact.length === 1) return selectAoi(exact[0], options);
  if (usable.length === 1) return selectAoi(usable[0], options);
  throw new AoiChoiceRequired(usable);
}
