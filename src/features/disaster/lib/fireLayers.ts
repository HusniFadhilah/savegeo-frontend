import type { Feature, FeatureCollection, Position } from "geojson";
import type { FireMultiSourceLayerState } from "../types";

function inRing(point: Position, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

export function featureContainsPoint(feature: Feature, point: Position): boolean {
  const geometry = feature.geometry;
  if (!geometry) return false;
  const polygonContains = (rings: Position[][]) =>
    rings.length > 0 &&
    inRing(point, rings[0]) &&
    !rings.slice(1).some((ring) => inRing(point, ring));
  if (geometry.type === "Polygon") return polygonContains(geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some(polygonContains);
  return false;
}

export function visibleHotspots(state: FireMultiSourceLayerState): FeatureCollection {
  if (!state.result) return { type: "FeatureCollection", features: [] };
  const visible = new Set(state.visibleSources);
  const features = state.showMerged
    ? state.result.hotspots.features.filter((feature) =>
        ((feature.properties?.source_ids ?? []) as string[]).some((id) =>
          visible.has(id as (typeof state.visibleSources)[number]),
        ),
      )
    : state.result.sources
        .filter((source) => visible.has(source.id) && !source.kind)
        .flatMap((source) => source.features ?? []);
  return { type: "FeatureCollection", features };
}

export function administrativePointCounts(
  boundaries: FeatureCollection | null,
  points: FeatureCollection,
) {
  if (!boundaries) return [];
  return boundaries.features
    .map((feature) => ({
      name: String(
        feature.properties?.name ??
          feature.properties?.namobj ??
          feature.properties?.PROVINSI ??
          "Wilayah",
      ),
      count: points.features.filter(
        (point) =>
          point.geometry?.type === "Point" &&
          featureContainsPoint(feature, point.geometry.coordinates),
      ).length,
    }))
    .filter((region) => region.count > 0)
    .sort((a, b) => b.count - a.count);
}
