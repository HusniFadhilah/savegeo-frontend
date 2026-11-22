import type { MapLegendEntry } from "@/types/map";
import type { DmrvSnapshot } from "./types";

export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export interface SnapshotLayer {
  key: string;
  url: string;
  unit: string;
  resolution?: number;
  min?: number;
  max?: number;
  colors: string[];
  entries: MapLegendEntry[];
}

/** Stored display URLs are optional and can expire independently of the result. */
export function snapshotLayers(outputs: Record<string, unknown>): SnapshotLayer[] {
  const layers: SnapshotLayer[] = [];
  const seen = new Set<string>();
  function visit(value: unknown, path: string, depth: number) {
    if (depth > 8 || layers.length >= 64) return;
    const record = asRecord(value);
    const vis = asRecord(record.vis_params);
    for (const [key, item] of Object.entries(record)) {
      if (
        (key === "tile_url" || key.endsWith("_tile_url")) &&
        typeof item === "string" &&
        item.trim()
      ) {
        // Relative same-origin API URLs and HTTPS providers only; never protocol-relative URLs.
        if (!(item.startsWith("/api/") || /^https:\/\//i.test(item)) || seen.has(item)) continue;
        let parsed: URL;
        try {
          parsed = new URL(item, "https://savegeo.invalid");
        } catch {
          continue;
        }
        if (parsed.username || parsed.password) continue;
        seen.add(item);
        const palette = Array.isArray(vis.palette) ? vis.palette : [];
        const colors = palette
          .filter((c): c is string => typeof c === "string" && /^#?[a-f\d]{6}$/i.test(c))
          .map((c) => (c.startsWith("#") ? c : `#${c}`));
        const scale = record.native_scale_m ?? record.native_scale ?? record.resolution_m;
        layers.push({
          key:
            [path, key === "tile_url" ? "" : key.replace("_tile_url", "")]
              .filter(Boolean)
              .join(" / ") || "Raster",
          url: item,
          unit: typeof record.unit === "string" ? record.unit : "",
          resolution: typeof scale === "number" && scale > 0 ? scale : undefined,
          min: typeof vis.min === "number" ? vis.min : undefined,
          max: typeof vis.max === "number" ? vis.max : undefined,
          colors,
          entries: Object.entries(asRecord(record.classes)).flatMap(([name, value]) => {
            const item = asRecord(value);
            return typeof item.color === "string" && /^#?[a-f\d]{6}$/i.test(item.color)
              ? [
                  {
                    label: name,
                    color: item.color.startsWith("#") ? item.color : `#${item.color}`,
                    value: typeof item.percentage === "number" ? `${item.percentage}%` : undefined,
                  },
                ]
              : [];
          }),
        });
      } else if (item !== null && typeof item === "object") {
        if (Array.isArray(item))
          item
            .slice(0, 64)
            .forEach((child, i) => visit(child, `${path} / ${key} ${i + 1}`, depth + 1));
        else visit(item, [path, key].filter(Boolean).join(" / "), depth + 1);
      }
    }
  }
  visit(outputs, "", 0);
  return layers;
}

export function snapshotAoi(
  snapshot: DmrvSnapshot,
): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null {
  const context = asRecord(snapshot.inputs.context);
  const geometry = asRecord(asRecord(asRecord(context.parameters).aoi).geojson);
  const candidate = geometry.type === "Feature" ? asRecord(geometry.geometry) : geometry;
  if (
    !["Polygon", "MultiPolygon"].includes(String(candidate.type)) ||
    !Array.isArray(candidate.coordinates)
  )
    return null;
  return {
    type: "Feature",
    properties: {},
    geometry: candidate as unknown as GeoJSON.Polygon | GeoJSON.MultiPolygon,
  };
}

export interface SnapshotMetric {
  key: string;
  value: number;
  unit: string;
}
/** Do not recompute or substitute missing scientific statistics in the viewer. */
export function snapshotMetrics(snapshot: DmrvSnapshot): SnapshotMetric[] {
  const out = snapshot.outputs;
  if (snapshot.kind === "carbon") {
    const estimated = asRecord(out.carbon_estimated);
    const stats = asRecord(estimated.statistics);
    const area = asRecord(out.area_info);
    const unit = typeof estimated.unit === "string" ? estimated.unit : "";
    return [
      { key: "mean", value: stats.mean, unit },
      { key: "min", value: stats.min, unit },
      { key: "max", value: stats.max, unit },
      { key: "std_dev", value: stats.std_dev, unit },
      { key: "calculation_area_ha", value: area.calculation_area_ha, unit: "ha" },
      { key: "total_carbon_tons", value: area.total_carbon_tons, unit: "Mg C" },
    ].filter(
      (item): item is SnapshotMetric =>
        typeof item.value === "number" && Number.isFinite(item.value),
    );
  }
  if (snapshot.kind === "vegetation") {
    return Object.entries(asRecord(out.indices)).flatMap(([index, value]) => {
      const record = asRecord(value);
      return ["mean", "min", "max", "std_dev"].flatMap((key) =>
        typeof record[key] === "number" && Number.isFinite(record[key])
          ? [{ key: `${index} / ${key}`, value: record[key] as number, unit: "" }]
          : [],
      );
    });
  }
  return [];
}
