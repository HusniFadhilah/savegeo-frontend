import { apiClient } from "@/services/apiClient";
import type { GetSceneTileParams, ImagerySceneListResponse, ImagerySceneTileResponse, ListScenesParams } from "./types";

/**
 * POST /imagery/scenes - list real Sentinel-2/Landsat scenes (exact
 * acquisition date+time, no compositing) for an AOI + date range. Flat body,
 * no {success,data} envelope - same convention as every other endpoint here.
 */
export function listImageryScenes(params: ListScenesParams) {
  return apiClient.post<ImagerySceneListResponse>("/imagery/scenes", {
    aoi: params.aoi,
    satellite: params.satellite,
    start_date: params.startDate,
    end_date: params.endDate,
    max_cloud_cover: params.maxCloudCover,
  });
}

/** POST /imagery/scene-tile - RGB tile for exactly one scene (no compositing). */
export function getImagerySceneTile(params: GetSceneTileParams) {
  return apiClient.post<ImagerySceneTileResponse>("/imagery/scene-tile", {
    satellite: params.satellite,
    scene_id: params.sceneId,
    aoi: params.aoi,
  });
}
