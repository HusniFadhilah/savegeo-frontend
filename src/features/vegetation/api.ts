import { apiClient } from "@/services/apiClient";
import type { AoiPayload } from "@/features/carbon/lib/geo";
import type { VegetationParams, VegetationResult } from "./types";

/** POST /analyze/vegetation returns the VegetationResult dict directly - no {success,data} envelope (errors are non-2xx, caught as ApiError). */
export function analyzeVegetation(aoi: AoiPayload, year: number, params: VegetationParams) {
  return apiClient.post<VegetationResult>("/analyze/vegetation", {
    aoi,
    year,
    start_month: params.startMonth,
    end_month: params.endMonth,
    cloud_threshold: params.cloudThreshold,
    indices: params.indices,
  });
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
