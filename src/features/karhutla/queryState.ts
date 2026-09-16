import type { WildfireConfidence } from "./types";

export interface WildfireQueryState {
  from: string;
  to: string;
  sensor: string;
  confidence: WildfireConfidence[];
  province: string;
  city: string;
  layers: string[];
  basemap: string;
  lat: number | null;
  lng: number | null;
  zoom: number | null;
  hotspot: string;
  panel: "overview" | "timeline" | "table" | "methodology";
}
export const DEFAULT_WILDFIRE_QUERY: WildfireQueryState = {
  from: "",
  to: "",
  sensor: "all",
  confidence: ["low", "nominal", "high"],
  province: "",
  city: "",
  layers: ["hotspot", "boundary"],
  basemap: "",
  lat: null,
  lng: null,
  zoom: null,
  hotspot: "",
  panel: "overview",
};

const SENSOR_VALUES = new Set(["all", "viirs", "modis", "landsat"]);
const CONFIDENCE_VALUES = new Set<WildfireConfidence>(["low", "nominal", "high"]);
const PANELS = new Set<WildfireQueryState["panel"]>(["overview", "timeline", "table", "methodology"]);

function validDate(value: string | null): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export function parseWildfireQuery(search: string): WildfireQueryState {
  const params = new URLSearchParams(search);
  const confidence = (params.get("confidence") ?? "")
    .split(",")
    .filter((value): value is WildfireConfidence => CONFIDENCE_VALUES.has(value as WildfireConfidence));
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const zoom = Number(params.get("zoom"));
  const layers = (params.get("layers") ?? "hotspot,boundary").split(",").filter(Boolean);
  return {
    from: validDate(params.get("from")),
    to: validDate(params.get("to")),
    sensor: SENSOR_VALUES.has(params.get("sensor") ?? "") ? params.get("sensor") ?? "all" : "all",
    confidence: confidence.length ? [...new Set(confidence)] : DEFAULT_WILDFIRE_QUERY.confidence,
    province: params.get("province") ?? "",
    city: params.get("city") ?? "",
    layers: layers.filter((layer) => ["hotspot", "boundary", "burned-area", "satellite"].includes(layer)),
    basemap: params.get("basemap") ?? "",
    lat: Number.isFinite(lat) && lat >= -11 && lat <= 6 ? lat : null,
    lng: Number.isFinite(lng) && lng >= 95 && lng <= 141 ? lng : null,
    zoom: Number.isFinite(zoom) && zoom >= 3 && zoom <= 18 ? Math.round(zoom) : null,
    hotspot: params.get("hotspot") ?? "",
    panel: PANELS.has(params.get("panel") as WildfireQueryState["panel"])
      ? (params.get("panel") as WildfireQueryState["panel"])
      : "overview",
  };
}

export function writeWildfireQuery(params: URLSearchParams, state: WildfireQueryState): URLSearchParams {
  const next = new URLSearchParams(params);
  const values: Record<string, string | null> = {
    from: state.from || null,
    to: state.to || null,
    sensor: state.sensor === "all" ? null : state.sensor,
    confidence: state.confidence.length === 3 ? null : state.confidence.join(","),
    province: state.province || null,
    city: state.city || null,
    layers: state.layers.join(",") === "hotspot,boundary" ? null : state.layers.join(","),
    basemap: state.basemap || null,
    lat: state.lat == null ? null : state.lat.toFixed(4),
    lng: state.lng == null ? null : state.lng.toFixed(4),
    zoom: state.zoom == null ? null : String(state.zoom),
    hotspot: state.hotspot || null,
    panel: state.panel === "overview" ? null : state.panel,
  };
  Object.entries(values).forEach(([key, value]) => (value == null ? next.delete(key) : next.set(key, value)));
  return next;
}
