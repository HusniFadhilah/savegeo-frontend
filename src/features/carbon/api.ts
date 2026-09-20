import { apiClient } from "@/services/apiClient";
import { runAnalysisJob } from "@/services/analysisJobs";
import type { AoiPayload } from "./lib/geo";
import type {
  CarbonDeltaResponse,
  CarbonReferenceDatasetOption,
  CarbonModelInfo,
  CarbonModelListItem,
  CarbonParams,
  CarbonResult,
  CompanyBoundary,
} from "./types";

interface CarbonDatasetApiItem {
  key: string;
  name?: string | null;
  full_name?: string | null;
  provider_type?: string | null;
  target_pool?: string | null;
  resolution?: number | string | null;
  year?: number | string | null;
  year_range?: number[] | string | null;
  available_years?: number[] | null;
  selection_year?: number | null;
  year_selectable?: boolean;
  deprecated?: boolean;
  replacement_key?: string | null;
  description?: string | null;
  compatible_model_count?: number;
  is_configured?: boolean;
  requires_configuration?: boolean;
  availability_error?: string | null;
  ingestion_method?: string | null;
  reference_only_capable?: boolean;
}

/**
 * GET /models (and /models/by-name/{name}) return their payload directly -
 * `{models: [...], count}` / the model dict itself - no {success,data}
 * envelope (verified against app/api/routes/models.py + live curl).
 */
export async function listCarbonModels(referenceDataset?: string | null): Promise<CarbonModelListItem[]> {
  const params = new URLSearchParams();
  params.set("model_type", "carbon");
  if (referenceDataset) params.set("target_dataset", referenceDataset);
  const res = await apiClient.get<{ models: CarbonModelListItem[]; count: number }>(
    `/models?${params.toString()}`,
  );
  return res.models ?? [];
}

export function getCarbonModelInfo(modelName: string): Promise<CarbonModelInfo> {
  return apiClient.get<CarbonModelInfo>(`/models/by-name/${encodeURIComponent(modelName)}`);
}

export async function listCarbonDatasets(): Promise<CarbonReferenceDatasetOption[]> {
  const res = await apiClient.get<{ datasets: CarbonDatasetApiItem[]; count: number }>("/carbon/datasets?include_unavailable=true");
  return (res.datasets ?? []).map((ds) => {
    const resolution = ds.resolution ? `, ${ds.resolution}m` : "";
    const year = ds.year ?? (Array.isArray(ds.year_range) ? ds.year_range.join("-") : ds.year_range);
    const yearSuffix = year ? ` (${year}${resolution})` : resolution ? ` (${String(resolution).replace(/^, /, "")})` : "";
    return {
      value: ds.key,
      label: ds.name || ds.full_name || ds.key,
      group: ds.target_pool || ds.provider_type || "Carbon Dataset",
      description: ds.description || ds.full_name || ds.provider_type || "",
      year: ds.year,
      yearRange: ds.year_range,
      availableYears: ds.available_years,
      selectionYear: ds.selection_year,
      yearSelectable: ds.year_selectable,
      deprecated: ds.deprecated,
      replacementKey: ds.replacement_key,
      compatibleModelCount: ds.compatible_model_count,
      isConfigured: ds.is_configured,
      requiresConfiguration: ds.requires_configuration,
      availabilityError: ds.availability_error,
      ingestionMethod: ds.ingestion_method,
      referenceOnlyCapable: ds.reference_only_capable,
      source: "api",
      ...(ds.name || ds.full_name ? { label: `${ds.name || ds.full_name}${yearSuffix}` } : {}),
    };
  });
}

function isNonGeeModel(meta: CarbonModelListItem["metadata_json"]): boolean {
  const provider = meta?.provider;
  return provider === "non_gee_stac" || provider === "local_raster";
}

export interface AnalyzeCarbonArgs {
  aoi: AoiPayload;
  params: CarbonParams;
  selectedModel: CarbonModelListItem | null;
  visMin: number;
  visMax: number;
  visPalette: string[];
}

/**
 * Ported from `runCarbonAnalysis()` in main.js: routes non-GEE models
 * (trained on Planetary Computer STAC features, not ee.Image) to
 * /analyze/carbon-local instead of /analyze/carbon so a STAC-trained
 * model's coefficients never get combined with GEE-built features.
 */
/**
 * POST /analyze/carbon(-local) returns the CarbonResult dict directly on
 * success (200) - no {success,data} envelope. Errors come back as a non-2xx
 * with `{error: "..."}`, which apiClient already throws as ApiError for -
 * callers should try/catch, not check a `.success` field.
 */
// GEE round-trips (collection size check, gap-fill fallback check, valid-pixel
// coverage check, model inference reduceRegion/sample, tile getMapId) chain
// sequentially per request - real compute, not a hung connection. The 180s
// apiClient default was already bumped once for this reason; carbon specifically
// tends to run long (native_classifier/many-feature models, big AOIs), so give
// it more headroom than the default before the frontend gives up on a request
// the backend is still legitimately working on.
const CARBON_TIMEOUT_MS = 650_000; // ~11 min - aligned with production proxy timeout for long GEE analyses
const CARBON_DELTA_TIMEOUT_MS = 900_000; // 15 min - repeats the single-year pipeline once per year in range

export async function analyzeCarbon({
  aoi,
  params,
  selectedModel,
  visMin,
  visMax,
  visPalette,
}: AnalyzeCarbonArgs): Promise<CarbonResult> {
  const meta = selectedModel?.metadata_json;

  if (selectedModel && isNonGeeModel(meta) && !params.loadOnly) {
    const pad = (n: number) => String(n).padStart(2, "0");
    // /analyze/carbon-local forwards these straight into a STAC API `datetime`
    // interval query (app/providers/stac_provider.py: `f"{start}/{end}"`),
    // which per the STAC API spec is INCLUSIVE on both ends - unlike GEE's
    // filterDate() (exclusive end), so the fix here is the actual last calendar
    // day of endMonth, not "first day of next month". The old `-28` truncated
    // the last 0-3 days of any longer month from every non-GEE carbon composite.
    const lastDayOfEndMonth = new Date(params.year, params.endMonth, 0).getDate();
    return runAnalysisJob<CarbonResult>(
      "carbon_local",
      {
        aoi,
        model_name: selectedModel.name,
        start_date: `${params.year}-${pad(params.startMonth)}-01`,
        end_date: `${params.year}-${pad(params.endMonth)}-${pad(lastDayOfEndMonth)}`,
        scale: 10,
        n_samples: 2000,
        vis_min: visMin,
        vis_max: visMax,
        vis_palette: visPalette,
      },
      { timeoutMs: CARBON_TIMEOUT_MS },
    );
  }

  return runAnalysisJob<CarbonResult>(
    "carbon",
    {
      aoi,
      year: params.year,
      start_month: params.startMonth,
      end_month: params.endMonth,
      cloud_threshold: params.cloudThreshold,
      clip_to_aoi: params.clipMode === "clipped",
      reference_dataset: params.referenceDataset,
      dataset_year: params.datasetYear,
      model_name: params.modelName || null,
      reference_only: params.referenceOnly || (!params.modelName && params.referenceDataset === "CHLORIS_AGB_STOCK"),
      load_only: params.loadOnly,
      cloud_mask_technique: params.cloudMaskTechnique,
      vis_min: visMin,
      vis_max: visMax,
      vis_palette: visPalette.length ? visPalette : undefined,
    },
    { timeoutMs: CARBON_TIMEOUT_MS },
  );
}

export interface AnalyzeCarbonDeltaArgs {
  aoi: AoiPayload;
  startYear: number;
  endYear: number;
  interval: number;
  startMonth: number;
  endMonth: number;
  cloudThreshold: number;
  modelName: string | null;
  cloudMaskTechnique: string;
  /** true = also generate a map tile per year (timelapse playback), costs one getMapId() round trip per year. */
  includeTiles: boolean;
  visMin: number;
  visMax: number;
  visPalette: string[];
}

/** Multi-year carbon time series (P0 "time-series & timelapse") via the async analysis job queue. */
export function analyzeCarbonDelta(args: AnalyzeCarbonDeltaArgs): Promise<CarbonDeltaResponse> {
  return runAnalysisJob<CarbonDeltaResponse>(
    "carbon_delta",
    {
      aoi: args.aoi,
      start_year: args.startYear,
      end_year: args.endYear,
      interval: args.interval,
      start_month: args.startMonth,
      end_month: args.endMonth,
      cloud_threshold: args.cloudThreshold,
      model_name: args.modelName || null,
      cloud_mask_technique: args.cloudMaskTechnique,
      include_tiles: args.includeTiles,
      vis_min: args.visMin,
      vis_max: args.visMax,
      vis_palette: args.visPalette.length ? args.visPalette : undefined,
    },
    { timeoutMs: CARBON_DELTA_TIMEOUT_MS },
  );
}

export interface CarbonDatasetHealth {
  key: string;
  check_scope?: "reachability_only";
  status: "healthy" | "unavailable" | "unknown";
  http_status?: number;
  latency_ms?: number;
  checked_at?: string;
  stale?: boolean;
  error?: string | null;
}

/** Explicit health probe for admin/source diagnostics; results are cached server-side. */
export function checkCarbonDatasetHealth(refresh = false) {
  if (refresh) {
    return apiClient.post<{ datasets: CarbonDatasetHealth[]; checked_at: string }>(
      "/carbon/datasets/health/refresh",
    );
  }
  return apiClient.get<{ datasets: CarbonDatasetHealth[]; checked_at: string }>("/carbon/datasets/health");
}

export interface DirectReferenceLayer {
  dataset: string;
  dataset_name: string;
  tile_url?: string | null;
  year?: number | string | null;
  requested_year?: number | string | null;
  effective_year?: number | string | null;
  available_years?: number[] | null;
  resolution?: number | string | null;
  unit?: string | null;
  target_pool?: string | null;
  provider_type?: string | null;
  date_range?: { start?: string; end?: string } | null;
  legend?: Record<string, { label?: string; color?: string; class_value?: number }>;
  vis_params?: { min?: number; max?: number; palette?: string[] };
  direct: boolean;
  statistics_available: boolean;
  load_note?: string | null;
}

export function loadDirectCarbonReferenceLayer(dataset: string, year: number, visMin?: number, visMax?: number) {
  const query = new URLSearchParams({ year: String(year) });
  if (visMin != null) query.set("min", String(visMin));
  if (visMax != null) query.set("max", String(visMax));
  return apiClient.get<DirectReferenceLayer>(`/carbon/reference-layers/${encodeURIComponent(dataset)}?${query.toString()}`);
}

export function loadDirectLandCoverReferenceLayer(
  dataset: string,
  year: number,
  options: { startMonth?: number; endMonth?: number; startDate?: string; endDate?: string } = {},
) {
  const query = new URLSearchParams({
    year: String(year),
    start_month: String(options.startMonth ?? 1),
    end_month: String(options.endMonth ?? 12),
  });
  if (options.startDate && options.endDate) {
    query.set("start_date", options.startDate);
    query.set("end_date", options.endDate);
  }
  return apiClient.get<DirectReferenceLayer>(`/landcover/reference-layers/${encodeURIComponent(dataset)}?${query.toString()}`);
}

export function listCompanies() {
  return apiClient.get<{ companies: CompanyBoundary[] }>("/companies");
}

export function getCompanyGeojson(companyId: string) {
  return apiClient.get<{ geojson: GeoJSON.Feature | GeoJSON.Geometry }>(
    `/companies/${encodeURIComponent(companyId)}/geojson`,
  );
}

export interface ExportGeoTiffArgs {
  aoi: AoiPayload;
  layerType: "carbon" | "vegetation" | "landcover" | "rgb";
  indexName?: string | null;
  dataset?: string | null;
  scale: number;
  year: number;
  startMonth: number;
  endMonth: number;
  cloudThreshold: number;
  modelName?: string | null;
  filename: string;
}

/** GeoTIFF export result returned by the async export job. */
export interface ExportGeoTiffResult {
  status: string;
  download_url: string;
  filename: string;
  layer_type: string;
  scale: number;
  year: number;
}

export function exportGeoTiff(args: ExportGeoTiffArgs) {
  return runAnalysisJob<ExportGeoTiffResult>(
    "geotiff",
    {
      aoi: args.aoi,
      layer_type: args.layerType,
      index_name: args.indexName ?? null,
      dataset: args.dataset ?? null,
      scale: args.scale,
      year: args.year,
      start_month: args.startMonth,
      end_month: args.endMonth,
      cloud_threshold: args.cloudThreshold,
      model_name: args.modelName ?? null,
      filename: args.filename,
    },
    { timeoutMs: CARBON_TIMEOUT_MS },
  );
}
