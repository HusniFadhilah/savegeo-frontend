import type { AoiPayload } from "@/features/carbon/lib/geo";
import type { SatelliteProvider } from "@/features/vegetation/types";

/** One real satellite scene as returned by POST /imagery/scenes - no compositing, exact acquisition timestamp (with time-of-day). */
export interface ImageryScene {
  /** GEE `system:index` - stable id for fetching this exact scene's tile. */
  id: string;
  /** ISO 8601 UTC, e.g. "2023-06-28T03:19:45.094Z" - real overpass time, not just a date. */
  acquired_at: string;
  cloud_cover_pct: number | null;
}

export interface ImagerySceneListResponse {
  scenes: ImageryScene[];
  count: number;
  satellite: SatelliteProvider;
  /** true if results were capped (backend limits to 200 scenes per request). */
  truncated: boolean;
}

export interface ImagerySceneTileResponse {
  scene_id: string;
  tile_url: string;
  satellite: SatelliteProvider;
}

export interface ListScenesParams {
  aoi: AoiPayload;
  satellite: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  maxCloudCover?: number;
}

export interface GetSceneTileParams {
  satellite: string;
  sceneId: string;
  aoi?: AoiPayload;
}
