import type { AoiFeature, MapLegendEntry } from "@/types/map";

/**
 * Types for the Disaster Mapping module, ported from
 * frontend-nextjs2/public/main.js `DisasterMapping` + `apiClient`
 * (/disaster/* endpoints). Field names mirror the backend response shapes
 * used by the legacy jQuery code (`res.data.*`) - do not rename without
 * checking the backend contract.
 */

export type DisasterType = "flood" | "fire" | "landslide";

export const DISASTER_TYPE_LABELS: Record<DisasterType, string> = {
  flood: "Banjir",
  fire: "Kebakaran Lahan",
  landslide: "Longsor",
};

export const DISASTER_TYPE_OPTIONS: { value: DisasterType; label: string }[] = [
  { value: "flood", label: "Banjir" },
  { value: "fire", label: "Kebakaran Lahan" },
  { value: "landslide", label: "Longsor" },
];

/** Payload accepted by every /disaster/* endpoint that takes an AOI. */
export type AoiPayload =
  | { geojson: AoiFeature }
  | { west: number; south: number; east: number; north: number };

export interface DisasterSourceItem {
  name: string;
  type: string;
  configured: boolean;
  official_url?: string;
  tile_url?: string;
  wms_url?: string;
  layers?: string;
}

/** GET /disaster/sources - keyed by source id (e.g. "inarisk", "demnas"). */
export type DisasterSourcesMap = Record<string, DisasterSourceItem>;

export interface BmkgAlert {
  title?: string;
  area?: string;
  published_at?: string;
  description?: string;
}

export interface BmkgAlertsData {
  alerts: BmkgAlert[];
}

export interface DemSlopeParams {
  aoi: AoiPayload;
  scale?: number;
}

export interface DemSlopeStats {
  mean_slope_deg?: number;
  max_slope_deg?: number;
}

export interface DemSlopeResult {
  tile_url: string;
  is_official_demnas: boolean;
  source: string;
  stats?: DemSlopeStats;
  legend?: MapLegendEntry[];
}

export interface EventPeriod {
  start?: string;
  end?: string;
}

export interface EventMapParams {
  event_type: DisasterType;
  aoi: AoiPayload;
  before_start?: string;
  before_end?: string;
  after_start?: string;
  after_end?: string;
}

export interface EventMapResult {
  tile_url?: string;
  source?: string;
  area_ha?: number;
  scale?: number | string;
  title?: string;
  method_note?: string;
  event_type?: DisasterType | string;
  before_period?: EventPeriod;
  after_period?: EventPeriod;
  legend?: MapLegendEntry[];
}
