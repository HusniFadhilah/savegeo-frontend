export interface LandCoverClassInfo {
  color: string;
  area: number;
  percentage: number;
  class_value?: number;
}

export interface LandCoverDatasetResult {
  dataset_name?: string;
  year?: number | string;
  classes: Record<string, LandCoverClassInfo>;
  tile_url?: string;
}

/** Response of GET /landcover/datasets: keyed by dataset key. */
export interface LandCoverDatasetOption {
  key: string;
  name: string;
  resolution: string;
  description?: string;
}

export type LandCoverDatasetCatalog = Record<string, LandCoverDatasetOption>;

/** Response of POST /analyze/landcover: keyed by dataset key, plus a few
 * non-dataset metadata keys (processing_time, total_area_ha, resolution)
 * that must be filtered out before treating entries as dataset results. */
export type LandCoverResult = Record<string, LandCoverDatasetResult | number | string | undefined>;

export const NON_DATASET_KEYS = new Set(["processing_time", "total_area_ha", "resolution"]);

export function isLandCoverDatasetEntry(
  key: string,
  value: unknown,
): value is LandCoverDatasetResult {
  if (NON_DATASET_KEYS.has(key)) return false;
  if (key.startsWith("_")) return false;
  if (typeof value !== "object" || value === null) return false;
  return "classes" in value || "tile_url" in value;
}

export interface LandCoverParams {
  datasets: string[];
  dwMode: "mode" | "hillshade" | "probability";
  includeImprobableClasses: boolean;
  dateMode: "year" | "month" | "date";
  startMonth: number;
  endMonth: number;
  selectedMonth: number;
  startDate?: string;
  endDate?: string;
}
