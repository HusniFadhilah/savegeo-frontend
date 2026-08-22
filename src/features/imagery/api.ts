import { apiClient } from "@/services/apiClient";
import type {
  GetSceneTileParams,
  ImageryProviderCatalogResponse,
  ImagerySceneListResponse,
  ImagerySceneTileResponse,
  ListScenesParams,
} from "./types";

/** GET /imagery/providers - static, no-GEE catalog of selectable satellite/sensor providers for the scene browser. */
export function getImageryProviders() {
  return apiClient.get<ImageryProviderCatalogResponse>("/imagery/providers");
}

/**
 * POST /imagery/scenes - list real Sentinel-1/2/3/5P/Landsat scenes (exact
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

/** POST /imagery/scene-tile - tile for exactly one scene (no compositing), visualized per its sensor type (RGB/SAR/gas colormap). */
export function getImagerySceneTile(params: GetSceneTileParams) {
  return apiClient.post<ImagerySceneTileResponse>("/imagery/scene-tile", {
    satellite: params.satellite,
    scene_id: params.sceneId,
    aoi: params.aoi,
    sar_mode: params.sarMode,
    cloud_mask_technique: params.cloudMaskTechnique,
  });
}
