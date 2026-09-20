import type { FirmsHotspotFeature } from "@/features/disaster/types";

export type WildfireStatus = "active" | "monitoring" | "completed" | "archived";
export type WildfireConfidence = "low" | "nominal" | "high";

export interface WildfireEvent {
  id: number | string;
  slug: string;
  title: string;
  short_title: string;
  description: string;
  disaster_type: "forest_fire";
  status: WildfireStatus;
  start_date: string;
  end_date: string | null;
  monitoring_from: string;
  monitoring_to: string | null;
  published_at: string | null;
  last_data_at: string | null;
  last_synced_at: string | null;
  year: number;
  country_code: string;
  province_codes: string[];
  city_codes: string[];
  provinces: string[];
  bbox: [number, number, number, number];
  center_lat: number;
  center_lon: number;
  default_zoom: number;
  thumbnail: string | null;
  severity: "low" | "medium" | "high" | "critical";
  source_ids: string[];
  source: string;
  boundary_source: string | null;
  methodology: string | null;
  limitations: string[];
  is_featured: boolean;
  is_public: boolean;
  hotspot_count: number;
  high_confidence_count: number;
  burned_area_ha: number | null;
  burned_area_source: string | null;
  updated_at: string | null;
}
export interface WildfireSummary {
  total_hotspots: number;
  high_confidence_hotspots: number;
  nominal_confidence_hotspots: number;
  low_confidence_hotspots: number;
  affected_regions: number;
  total_frp: number | null;
  average_frp: number | null;
  latest_acquisition_time: string | null;
  burned_area_ha: number | null;
  burned_area_source: string | null;
  previous_period_change_pct: number | null;
}

export interface WildfireTimelinePoint {
  date: string;
  count: number;
}

export interface WildfireEventsResponse {
  events: WildfireEvent[];
  updated_at: string | null;
  total: number;
}

export interface WildfireHotspotsResponse {
  features: FirmsHotspotFeature[];
  summary: WildfireSummary;
  timeline?: WildfireTimelinePoint[];
  metadata: {
    source: string;
    storage?: "database" | "curated" | string;
    fetched_at: string;
    last_synced_at?: string | null;
    total_features?: number;
    returned_features?: number;
    truncated_for_map?: boolean;
    stale: boolean;
    attribution: string;
    disclaimer: string;
  };
}

export interface WildfireFilters {
  search: string;
  year: string;
  status: string;
  province: string;
  severity: string;
  sort: "latest" | "hotspots" | "region";
}
