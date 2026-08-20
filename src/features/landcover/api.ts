import { apiClient } from "@/services/apiClient";
import { runAnalysisJob } from "@/services/analysisJobs";
import type { AoiPayload } from "@/features/carbon/lib/geo";
import type { LandCoverDatasetCatalog, LandCoverParams, LandCoverResult } from "./types";

/** Both endpoints return their payload directly - no {success,data} envelope (errors are non-2xx, caught as ApiError). */
export function fetchLandCoverDatasets() {
  return apiClient.get<LandCoverDatasetCatalog>("/landcover/datasets");
}

export function analyzeLandCover(aoi: AoiPayload, year: number, params: LandCoverParams) {
  const dateMode = params.dateMode ?? "year";
  const selectedMonth = params.selectedMonth ?? params.startMonth;
  const payload: Record<string, unknown> = {
    aoi,
    year,
    datasets: params.datasets,
    dw_mode: params.dwMode,
    include_improbable_classes: params.includeImprobableClasses,
    start_month: dateMode === "year" ? params.startMonth : selectedMonth,
    end_month: dateMode === "year" ? params.endMonth : selectedMonth,
  };

  if (dateMode === "date") {
    payload.start_date = params.startDate || `${year}-01-01`;
    payload.end_date = params.endDate || `${year}-12-31`;
  }

  return runAnalysisJob<LandCoverResult>("landcover", payload, { timeoutMs: 650_000 });
}
