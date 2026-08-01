import { apiClient } from "@/services/apiClient";
import type { AoiPayload } from "@/features/carbon/lib/geo";
import type { LandCoverDatasetCatalog, LandCoverParams, LandCoverResult } from "./types";

/** Both endpoints return their payload directly - no {success,data} envelope (errors are non-2xx, caught as ApiError). */
export function fetchLandCoverDatasets() {
  return apiClient.get<LandCoverDatasetCatalog>("/landcover/datasets");
}

export function analyzeLandCover(aoi: AoiPayload, year: number, params: LandCoverParams) {
  return apiClient.post<LandCoverResult>("/analyze/landcover", {
    aoi,
    year,
    datasets: params.datasets,
    dw_mode: params.dwMode,
    include_improbable_classes: params.includeImprobableClasses,
    start_month: params.startMonth,
    end_month: params.endMonth,
  });
}
