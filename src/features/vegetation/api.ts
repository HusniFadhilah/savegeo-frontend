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
