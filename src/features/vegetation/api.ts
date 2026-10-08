import { apiClient } from "@/services/apiClient";
import { runAnalysisJob } from "@/services/analysisJobs";
import type { AoiPayload } from "@/features/carbon/lib/geo";
import type {
  CloudMaskTechniqueCatalogResponse,
  SatelliteProvider,
  VegetationParams,
  VegetationResult,
  VegetationTimeSeriesResponse,
} from "./types";

/** POST /analyze/vegetation returns the VegetationResult dict directly - no {success,data} envelope (errors are non-2xx, caught as ApiError). */
export function analyzeVegetation(aoi: AoiPayload, year: number, params: VegetationParams) {
  return runAnalysisJob<VegetationResult>("vegetation", {
    aoi,
    year,
    start_month: params.startMonth,
    end_month: params.endMonth,
    cloud_threshold: params.cloudThreshold,
    scale: 10,
    indices: params.indices,
    satellite: params.satellite,
    cloud_mask_technique: params.cloudMaskTechnique,
  }, { timeoutMs: 650_000 });
}

export interface SatelliteCatalogResponse {
  satellites: Record<string, SatelliteProvider>;
  default: string;
}

/** GET /vegetation/satellites - static, no-GEE catalog of selectable satellite
 * imagery providers (Sentinel-2/Landsat 8/Landsat 9) with resolution/revisit/spec
 * metadata, for the satellite-picker UI. */
export function getVegetationSatellites() {
  return apiClient.get<SatelliteCatalogResponse>("/vegetation/satellites");
}

/** GET /vegetation/cloud-mask-techniques - static, no-GEE catalog of selectable
 * Sentinel-2 cloud-masking techniques (SCL/QA60/s2cloudless), shared by the
 * Vegetation and Carbon params panels. */
export function getCloudMaskTechniques() {
  return apiClient.get<CloudMaskTechniqueCatalogResponse>("/vegetation/cloud-mask-techniques");
}

export interface VegetationTimeSeriesArgs {
  aoi: AoiPayload;
  year: number;
  index?: string;
  indices?: string[];
  bands?: string[];
  startMonth?: number;
  endMonth?: number;
  cloudThreshold: number;
  scale?: number;
  satellite: string;
  cloudMaskTechnique: string;
}

/** POST /timeseries - monthly means for selected vegetation indices and spectral bands. */
export function analyzeVegetationTimeSeries(args: VegetationTimeSeriesArgs) {
  const indices = args.indices ?? (args.index ? [args.index] : ["NDVI"]);
  return apiClient.post<VegetationTimeSeriesResponse>("/timeseries", {
    aoi: args.aoi,
    year: args.year,
    index: indices[0],
    indices,
    bands: args.bands ?? [],
    interval: "monthly",
    start_month: args.startMonth ?? 1,
    end_month: args.endMonth ?? 12,
    cloud_threshold: args.cloudThreshold,
    scale: args.scale,
    satellite: args.satellite,
    cloud_mask_technique: args.cloudMaskTechnique,
  }, { auth: "app" });
}

export interface VegetationCatalogIndex {
  name: string;
  description?: string;
  categories?: string[];
}

export interface VegetationCatalogResponse {
  categories: Record<string, { label: string; color: string }>;
  indices: Record<string, VegetationCatalogIndex>;
  indices_by_category?: Record<string, string[]>;
  domain_recommendations?: Record<string, string[]>;
}

/**
 * GET /vegetation/catalog - static, no-GEE registry of every index the
 * backend supports (16 as of writing: NDVI/EVI/SAVI/MSAVI/NDMI/NDWI/MNDWI/
 * NDBI/NBR/BSI/NDRE/GCI/ARVI/VARI/SIPI/LAI_PROXY), vs. the 8 hardcoded in
 * indices.ts. No {success,data} envelope - flat body, same as every other
 * GET in this app.
 */
export function getVegetationCatalog() {
  return apiClient.get<VegetationCatalogResponse>("/vegetation/catalog");
}
