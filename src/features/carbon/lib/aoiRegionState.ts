import type { AoiFeature, AoiGeometry } from "@/types/map";
import {
  fetchGlobalBoundaryGeometry,
  fetchIndonesiaGeometry,
  fetchIslandGeometry,
  fetchRegionGeometry,
} from "@/services/analysisService";

export type AoiRegionLevel = "province" | "city" | "district" | "village";
export type AoiGlobalLevel = "ADM0" | "ADM1" | "ADM2" | "ADM3" | "ADM4";

export type AoiRegionSelection =
  | { scope: "indonesia" }
  | { scope: "island"; code: string }
  | {
      scope: "admin";
      level: AoiRegionLevel;
      codes: string[];
      provinceCodes: string[];
      cityCodes: string[];
      districtCodes: string[];
      villageCodes: string[];
    }
  | { scope: "global"; countryCode: string; level: AoiGlobalLevel; index: number };

const REGION_SELECTION_PROPERTY = "savegeo_region_selection";

export function withAoiRegionSelection(feature: AoiFeature, selection: AoiRegionSelection): AoiFeature {
  return {
    ...feature,
    properties: { ...(feature.properties ?? {}), [REGION_SELECTION_PROPERTY]: selection },
  };
}

export function getAoiRegionSelection(feature: AoiFeature | null | undefined): AoiRegionSelection | null {
  const value = feature?.properties?.[REGION_SELECTION_PROPERTY];
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.scope === "indonesia") return { scope: "indonesia" };
  if (candidate.scope === "island" && typeof candidate.code === "string" && candidate.code) {
    return { scope: "island", code: candidate.code };
  }
  if (
    candidate.scope === "global" && typeof candidate.countryCode === "string" && candidate.countryCode &&
    ["ADM0", "ADM1", "ADM2", "ADM3", "ADM4"].includes(String(candidate.level)) &&
    Number.isInteger(candidate.index) && Number(candidate.index) >= 0
  ) {
    return {
      scope: "global",
      countryCode: candidate.countryCode,
      level: candidate.level as AoiGlobalLevel,
      index: Number(candidate.index),
    };
  }
  if (
    candidate.scope === "admin" && ["province", "city", "district", "village"].includes(String(candidate.level)) &&
    Array.isArray(candidate.codes) && candidate.codes.every((code) => typeof code === "string")
  ) {
    const codes = (key: string) => Array.isArray(candidate[key])
      ? (candidate[key] as unknown[]).filter((code): code is string => typeof code === "string")
      : [];
    return {
      scope: "admin",
      level: candidate.level as AoiRegionLevel,
      codes: codes("codes"),
      provinceCodes: codes("provinceCodes"),
      cityCodes: codes("cityCodes"),
      districtCodes: codes("districtCodes"),
      villageCodes: codes("villageCodes"),
    };
  }
  return null;
}

function geometryFromGeoJson(input: GeoJSON.GeoJSON): AoiGeometry {
  if (input.type === "FeatureCollection") {
    const geometries = input.features.map((feature) => feature.geometry).filter((geometry): geometry is GeoJSON.Geometry => !!geometry);
    if (!geometries.length) throw new Error("AOI wilayah tidak memiliki geometri.");
    const polygons = geometries.map(geometryFromGeometry);
    return polygons.length === 1 ? polygons[0] : mergePolygons(polygons);
  }
  if (input.type === "Feature") {
    if (!input.geometry) throw new Error("AOI wilayah tidak memiliki geometri.");
    return geometryFromGeometry(input.geometry);
  }
  return geometryFromGeometry(input as GeoJSON.Geometry);
}

function geometryFromGeometry(geometry: GeoJSON.Geometry): AoiGeometry {
  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") return geometry;
  if (geometry.type === "GeometryCollection") {
    const polygons = geometry.geometries
      .filter((item): item is GeoJSON.Polygon | GeoJSON.MultiPolygon => item.type === "Polygon" || item.type === "MultiPolygon");
    if (polygons.length) return mergePolygons(polygons);
  }
  throw new Error("Geometri AOI wilayah tidak didukung.");
}

function mergePolygons(geometries: (GeoJSON.Polygon | GeoJSON.MultiPolygon)[]): GeoJSON.MultiPolygon {
  const coordinates: GeoJSON.Position[][][] = [];
  for (const geometry of geometries) {
    if (geometry.type === "Polygon") coordinates.push(geometry.coordinates);
    else coordinates.push(...geometry.coordinates);
  }
  return { type: "MultiPolygon", coordinates };
}

export function normalizeAoiRegionGeoJson(input: GeoJSON.GeoJSON): AoiFeature {
  return { type: "Feature", geometry: geometryFromGeoJson(input), properties: {} };
}

function asFeatures(input: GeoJSON.GeoJSON): GeoJSON.Feature[] {
  if (input.type === "FeatureCollection") return input.features;
  if (input.type === "Feature") return [input];
  return [{ type: "Feature", geometry: input as GeoJSON.Geometry, properties: {} }];
}

export async function loadAoiRegionSelection(selection: AoiRegionSelection): Promise<AoiFeature> {
  if (selection.scope === "indonesia") return normalizeAoiRegionGeoJson(await fetchIndonesiaGeometry());
  if (selection.scope === "island") return normalizeAoiRegionGeoJson(await fetchIslandGeometry(selection.code));
  if (selection.scope === "global") {
    return normalizeAoiRegionGeoJson(
      await fetchGlobalBoundaryGeometry(selection.countryCode, selection.level, selection.index),
    );
  }
  if (!selection.codes.length) throw new Error("Tautan AOI tidak memuat kode wilayah.");
  const geometries = await Promise.all(selection.codes.map((code) => fetchRegionGeometry(selection.level, code)));
  const features = geometries.flatMap(asFeatures);
  return normalizeAoiRegionGeoJson({ type: "FeatureCollection", features });
}

export function parseAoiRegionSelection(value: string | undefined): AoiRegionSelection | null {
  if (!value) return null;
  try {
    const feature: AoiFeature = { type: "Feature", geometry: { type: "Polygon", coordinates: [] }, properties: { [REGION_SELECTION_PROPERTY]: JSON.parse(value) } };
    return getAoiRegionSelection(feature);
  } catch {
    return null;
  }
}
