import { apiClient } from "@/services/apiClient";
import { env } from "@/config/env";
import type {
  DemTileResponse,
  GetDemTileParams,
  GetSceneTileParams,
  ImageryProviderCatalogResponse,
  AdvancedImageryCapabilities,
  ImagerySceneListResponse,
  ImagerySceneTileResponse,
  ListScenesParams,
} from "./types";

/** GET /imagery/providers - static, no-GEE catalog of selectable satellite/sensor providers for the scene browser. */
export function getImageryProviders() {
  return apiClient.get<ImageryProviderCatalogResponse>("/imagery/providers");
}

export function getImageryAdvancedCapabilities() {
  return apiClient.get<AdvancedImageryCapabilities>("/imagery/advanced/capabilities", { auth: "app" });
}

export function validateInsarPair(payload: { master: Record<string, unknown>; slave: Record<string, unknown> }) {
  return apiClient.post("/imagery/advanced/insar/validate", payload, { auth: "app" });
}

export function calibrateThermal(payload: { values: number[]; scale: number; offset: number; source_unit?: string; output_unit?: string }) {
  return apiClient.post("/imagery/advanced/thermal-calibration", payload, { auth: "app" });
}

export function getSpectralProfile(payload: { item_url: string; asset_key?: string; provider_key?: string; longitude: number; latitude: number; wavelengths_nm?: number[] }) {
  return apiClient.post("/imagery/advanced/spectral-profile", payload, { auth: "app" });
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
    stac_catalog_url: params.stacCatalogUrl,
    stac_collections: params.stacCollections,
  }, { auth: "app" });
}

/** POST /imagery/scene-tile - one scene tile, with automatic Sentinel-2 AOI mosaic when requested. */
export function getImagerySceneTile(params: GetSceneTileParams) {
  return apiClient.post<ImagerySceneTileResponse>("/imagery/scene-tile", {
    satellite: params.satellite,
    scene_id: params.sceneId,
    aoi: params.aoi,
    auto_mosaic: params.autoMosaic,
    force_mosaic: params.forceMosaic,
    force_scene: params.forceScene,
    start_date: params.startDate,
    end_date: params.endDate,
    max_cloud_cover: params.maxCloudCover,
    sar_mode: params.sarMode,
    cloud_mask_technique: params.cloudMaskTechnique,
    super_resolution: params.superResolution,
    cog_asset_key: params.cogAssetKey,
    cog_bands: params.cogBands,
    cog_rescale: params.cogRescale,
  }, { auth: "app" });
}

export function getImageryStacSourceUrl(sceneId: string, assetKey: string) {
  return `${env.apiBaseUrl}/imagery/stac-source?item_url=${encodeURIComponent(sceneId)}&asset_key=${encodeURIComponent(assetKey)}`;
}

/** POST /imagery/dem-tile - DEMNAS terrain tile for the imagery browser, with SRTM fallback clearly flagged. */
export function getImageryDemTile(params: GetDemTileParams) {
  return apiClient.post<DemTileResponse>("/imagery/dem-tile", {
    aoi: params.aoi,
    scale: params.scale,
  }, { auth: "app" });
}

export function runRasterToolbox(params: { itemUrl: string; assetKey: string; aoi: unknown; operation: string; bands?: string; export?: boolean }) {
  return apiClient.post<{ operation: string; stats: { min: number; mean: number; max: number }; histogram: number[]; bins: number[]; download_url?: string }>("/imagery/raster-toolbox", {
    item_url: params.itemUrl, asset_key: params.assetKey, aoi: params.aoi, operation: params.operation,
    bands: params.bands, export: params.export,
  }, { auth: "app" });
}

export function getNasaGibsLayers() {
  return apiClient.get<{ layers: { id: string; name: string; date_mode: string }[] }>("/imagery/nasa-gibs/layers");
}
