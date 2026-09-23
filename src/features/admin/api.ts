import { apiClient } from "@/services/apiClient";
import type { HealthStatus } from "@/types/api";
import type {
  GeeCredential,
  ArcgisStatusInfo,
  MlModel,
  AdminConfigCategories,
  KeyPoolStatus,
  OpenRouterModelInfo,
  CompanyBoundaryFull,
  AdminUserRow,
  AdminRole,
  SatelliteProviderRow,
  DisasterEvent,
  DisasterEventDetail,
  DisasterAoi,
  SatelliteImagery,
  ImageryPhase,
  DisasterModelRegistryEntry,
  AnalysisRun,
  AnalysisRunWithResult,
  AnalysisResult,
  DisasterQcStatus,
  Hotspot,
  DisasterAuditLogEntry,
  CarbonCalibrationDataset,
  CarbonCalibrationFile,
} from "./types";

/**
 * All admin API callers. Paths and payload/response shapes are ported 1:1 from
 * frontend-nextjs2/public/admin-scripts.js's `api()` calls — do not rename
 * fields or change paths without checking that file + savegeo/backend first.
 * Every call passes `{ auth: true }` so apiClient attaches the bearer token.
 *
 * Company-boundary admin CRUD, the OpenRouter model-list proxy, and the
 * key-pool status endpoint were added to savegeo/backend to close the 404s
 * these callers used to hit - all three are live now. Import-from-OSM/GFW
 * are not ported yet (external Overpass/CARTO integration, lower priority
 * than the CRUD itself) - those two calls will still 404 until that lands.
 */

// ── Health / EE ────────────────────────────────────────────────
export const getHealth = () => apiClient.get<HealthStatus>("/health", { auth: true });

export const reinitEE = () =>
  apiClient.post<{ success: boolean; message: string }>("/admin/gee/reinitialize", undefined, { auth: true });

// ── GEE credentials ────────────────────────────────────────────
export const getGeeStatus = () =>
  apiClient.get<{ ee_initialized: boolean; active_credential: GeeCredential | null }>("/admin/gee/status", {
    auth: true,
  });

export const listGeeCredentials = () =>
  apiClient.get<{ credentials: GeeCredential[] }>("/admin/gee/credentials", { auth: true });

export const uploadGeeCredential = (file: File, label: string, notes: string, activate: boolean) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("label", label);
  fd.append("notes", notes);
  fd.append("activate", activate ? "true" : "false");
  return apiClient.upload<{ message: string; credential: GeeCredential }>("/admin/gee/credentials", fd, {
    auth: true,
  });
};

export const activateGeeCredential = (id: number) =>
  apiClient.post<{ message: string; gee_initialized: boolean }>(`/admin/gee/credentials/${id}/activate`, undefined, {
    auth: true,
  });

export const deleteGeeCredential = (id: number) =>
  apiClient.delete<{ message: string }>(`/admin/gee/credentials/${id}`, { auth: true });

// ── ArcGIS ──────────────────────────────────────────────────────
export const getArcgisStatus = () => apiClient.get<ArcgisStatusInfo>("/admin/arcgis/status", { auth: true });

// ── ML models ───────────────────────────────────────────────────
export const listModels = (modelType?: string) =>
  apiClient.get<{ models: MlModel[] }>(`/admin/models${modelType ? `?model_type=${modelType}` : ""}`, {
    auth: true,
  });

export const uploadModel = (payload: {
  file: File;
  name: string;
  display_name: string;
  model_type: string;
  algorithm: string;
  version: string;
  set_default: boolean;
  metrics?: string;
}) => {
  const fd = new FormData();
  fd.append("file", payload.file);
  fd.append("name", payload.name);
  fd.append("display_name", payload.display_name);
  fd.append("model_type", payload.model_type);
  fd.append("algorithm", payload.algorithm);
  fd.append("version", payload.version);
  fd.append("set_default", payload.set_default ? "true" : "false");
  if (payload.metrics) fd.append("metrics", payload.metrics);
  return apiClient.upload<{ message: string; model: MlModel }>("/admin/models/upload", fd, { auth: true });
};

export const setDefaultModel = (id: number) =>
  apiClient.post<{ message: string }>(`/admin/models/${id}/set-default`, undefined, { auth: true });

export const toggleModelActive = (id: number, isActive: boolean) =>
  apiClient.put<{ message: string; model: MlModel }>(`/admin/models/${id}`, { is_active: !isActive }, { auth: true });

export const deleteModel = (id: number) =>
  apiClient.delete<{ message: string }>(`/admin/models/${id}`, { auth: true });

// ── System config ───────────────────────────────────────────────
export const getConfig = () => apiClient.get<{ config: AdminConfigCategories }>("/admin/config", { auth: true });

/** PUT /admin/config always replies `{message, updated: string[], errors: {key,error}[]}` -
 * per-key failures land in `errors`, not a top-level `error` string. */
export const saveConfig = (updates: { key: string; value: string }[]) =>
  apiClient.put<{ message: string; updated: string[]; errors: { key: string; error: string }[] }>(
    "/admin/config",
    { updates },
    { auth: true },
  );

/** Used by the key-pool textarea save — sends `{ [key]: value }` directly, distinct shape from saveConfig's `{updates:[...]}`. Matches legacy `_saveKPKeys` exactly. Same response shape as saveConfig (same endpoint). */
export const saveConfigKey = (key: string, value: string) =>
  apiClient.put<{ message: string; updated: string[]; errors: { key: string; error: string }[] }>(
    "/admin/config",
    { [key]: value },
    { auth: true },
  );

export const resetAllConfig = () =>
  apiClient.post<{ message: string }>("/admin/config/reset", {}, { auth: true });

export const getOpenRouterModels = () =>
  apiClient.get<{ models: OpenRouterModelInfo[]; error?: string }>("/admin/openrouter/models", { auth: true });

export const getKeyPoolStatus = () => apiClient.get<KeyPoolStatus>("/admin/key-pool/status", { auth: true });

// ── Carbon calibration ─────────────────────────────────────────────────────
export const listCarbonCalibrationDatasets = () =>
  apiClient.get<{ datasets: CarbonCalibrationDataset[] }>("/admin/carbon-calibration/datasets", { auth: true });

export const getCarbonCalibrationDataset = (datasetId: string) =>
  apiClient.get<CarbonCalibrationDataset & { files?: CarbonCalibrationFile[] }>(`/admin/carbon-calibration/datasets/${encodeURIComponent(datasetId)}`, { auth: true });

export const createCarbonCalibrationDataset = (payload: Record<string, unknown>) =>
  apiClient.post<CarbonCalibrationDataset>("/admin/carbon-calibration/datasets", payload, { auth: true });

export const uploadCarbonCalibrationFile = (datasetId: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return apiClient.upload<CarbonCalibrationFile>(`/admin/carbon-calibration/datasets/${encodeURIComponent(datasetId)}/files`, form, { auth: true });
};

export const validateCarbonCalibrationDataset = (datasetId: string) =>
  apiClient.post<Record<string, unknown>>(`/admin/carbon-calibration/datasets/${encodeURIComponent(datasetId)}/validate`, undefined, { auth: true });

export const extractCarbonCalibrationDataset = (datasetId: string) =>
  apiClient.post<{ job_id: string; status: string }>(`/admin/carbon-calibration/datasets/${encodeURIComponent(datasetId)}/extract`, undefined, { auth: true });

export const validateCarbonCalibrationSpatial = (datasetId: string) =>
  apiClient.post<Record<string, unknown>>(`/admin/carbon-calibration/datasets/${encodeURIComponent(datasetId)}/validate-spatial`, undefined, { auth: true });

export const extractCarbonCalibrationFeatures = (datasetId: string) =>
  apiClient.post<Record<string, unknown>>(`/admin/carbon-calibration/datasets/${encodeURIComponent(datasetId)}/extract-features`, undefined, { auth: true });

export const importCarbonCalibrationSources = (revised: File, previous?: File | null, dem?: File | null) => {
  const form = new FormData();
  form.append("revised_workbook", revised);
  if (previous) form.append("previous_workbook", previous);
  if (dem) form.append("dem", dem);
  return apiClient.upload<{ datasets: Array<Record<string, unknown>> }>("/admin/carbon-calibration/datasets/import", form, { auth: true });
};

// ── Admin users ──────────────────────────────────────────────────
export const getCurrentAdminUser = () => apiClient.get<AdminUserRow>("/admin/auth/me", { auth: true });

export const changePassword = (oldPassword: string, newPassword: string) =>
  apiClient.put<{ message: string }>(
    "/admin/auth/change-password",
    { old_password: oldPassword, new_password: newPassword },
    { auth: true },
  );

export const listRoles = () => apiClient.get<{ roles: AdminRole[] }>("/admin/roles", { auth: true });

export const createAdminUser = (payload: {
  username: string;
  password: string;
  email?: string | null;
  role_id?: number | null;
  is_active?: boolean;
}) => apiClient.post<{ message: string; user: AdminUserRow }>("/admin/users", payload, { auth: true });

export const updateAdminUser = (
  id: number,
  payload: { email?: string | null; is_active?: boolean; role_id?: number | null; new_password?: string },
) => apiClient.put<{ message: string; user: AdminUserRow }>(`/admin/users/${id}`, payload, { auth: true });

export const deleteAdminUser = (id: number) =>
  apiClient.delete<{ message: string }>(`/admin/users/${id}`, { auth: true });

// ── Company boundaries ────────────────────────────────────────────
export const listCompanies = () =>
  apiClient.get<{ companies: CompanyBoundaryFull[] }>("/admin/companies", { auth: true });

export const saveCompany = (payload: {
  name: string;
  company_name: string;
  industry_type: string;
  sub_type: string;
  province: string;
  district: string;
  description: string;
  geojsonFile?: File | null;
  geojsonText?: string;
}) => {
  const fd = new FormData();
  fd.append("name", payload.name);
  fd.append("company_name", payload.company_name);
  fd.append("industry_type", payload.industry_type);
  fd.append("sub_type", payload.sub_type);
  fd.append("province", payload.province);
  fd.append("district", payload.district);
  fd.append("description", payload.description);
  if (payload.geojsonFile) {
    fd.append("geojson_file", payload.geojsonFile);
  } else {
    fd.append("geojson_text", payload.geojsonText ?? "");
  }
  return apiClient.upload<{ company?: CompanyBoundaryFull; error?: string }>("/admin/companies", fd, {
    auth: true,
  });
};

export const toggleCompanyActive = (id: number, isActive: boolean) =>
  apiClient.put<{ error?: string }>(`/admin/companies/${id}`, { is_active: !isActive }, { auth: true });

export const deleteCompany = (id: number) =>
  apiClient.delete<{ error?: string }>(`/admin/companies/${id}`, { auth: true });

export const importCompaniesFromOSM = (industryTypes: string[]) =>
  apiClient.post<{ imported: number; skipped: number; error?: string }>(
    "/admin/companies/import/osm",
    { industry_types: industryTypes },
    { auth: true },
  );

// ── Satellite providers (overlay on app/registries/satellite_provider_registry.py) ──
export const listSatelliteProvidersAdmin = () =>
  apiClient.get<{ satellites: SatelliteProviderRow[] }>("/admin/satellite-providers", { auth: true });

export const saveSatelliteProvider = (key: string, patch: Partial<SatelliteProviderRow>) =>
  apiClient.put<{ message: string; provider: SatelliteProviderRow }>(
    `/admin/satellite-providers/${encodeURIComponent(key)}`,
    patch,
    { auth: true },
  );

/** Removes the DB override row - the provider reverts to its static registry default. */
export const resetSatelliteProvider = (key: string) =>
  apiClient.delete<{ message: string }>(`/admin/satellite-providers/${encodeURIComponent(key)}`, { auth: true });

export const importCompaniesFromGFW = (dataset: string) =>
  apiClient.post<{ imported: number; skipped: number; error?: string }>(
    "/admin/companies/import/gfw",
    { dataset },
    { auth: true },
  );

// ── Disaster Intelligence Dashboard (Admin) ─────────────────────────
// Every function follows the shapes documented in
// savegeo/backend/docs/disaster-redesign-contract.md section A - the
// admin_disaster.py router this codes against was being built in parallel,
// so match the doc, not any particular route file's current state.

export const createDisasterEvent = (payload: {
  name: string;
  disaster_type: string;
  location_name?: string;
  province?: string[];
  district?: string[];
  event_date?: string;
  start_date?: string;
  end_date?: string;
  severity?: string;
  description?: string;
  source?: string;
  thumbnail?: string;
  slug?: string;
  short_title?: string;
  monitoring_from?: string;
  monitoring_to?: string;
  methodology?: string;
  limitations?: string[];
}) => apiClient.post<DisasterEvent>("/admin/disasters", payload, { auth: true });

export const listDisasterEvents = (params?: {
  status?: string;
  disaster_type?: string;
  severity?: string;
  year?: string | number;
  search?: string;
}) => {
  const qs = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    }
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiClient.get<{ events: DisasterEvent[] }>(`/admin/disasters${suffix}`, { auth: true });
};

export const getDisasterEvent = (id: number) =>
  apiClient.get<DisasterEventDetail>(`/admin/disasters/${id}`, { auth: true });

export const updateDisasterEvent = (
  id: number,
  payload: Partial<{
    name: string;
    disaster_type: string;
    location_name: string;
    province: string[];
    district: string[];
    event_date: string;
    start_date: string;
    end_date: string;
    status: string;
    severity: string;
    description: string;
    source: string;
    thumbnail: string;
    slug: string;
    short_title: string;
    monitoring_from: string;
    monitoring_to: string;
    methodology: string;
    limitations: string[];
  }>,
) => apiClient.patch<DisasterEvent>(`/admin/disasters/${id}`, payload, { auth: true });

export const deleteDisasterEvent = (id: number) =>
  apiClient.delete<{ message: string }>(`/admin/disasters/${id}`, { auth: true });

export const createDisasterAoi = (id: number, payload: { geojson: Record<string, unknown>; source?: string }) =>
  apiClient.post<DisasterAoi>(`/admin/disasters/${id}/aoi`, payload, { auth: true });

export const listDisasterImagery = (id: number, phase?: ImageryPhase) =>
  apiClient.get<{ imagery: SatelliteImagery[] }>(
    `/admin/disasters/${id}/imagery${phase ? `?phase=${phase}` : ""}`,
    { auth: true },
  );

export const createDisasterImagery = (
  id: number,
  payload: {
    phase: ImageryPhase;
    satellite: string;
    acquisition_date: string;
    sensor?: string;
    resolution_m?: number;
    cloud_coverage_pct?: number;
    data_source?: string;
    is_primary?: boolean;
  },
) => apiClient.post<SatelliteImagery>(`/admin/disasters/${id}/imagery`, payload, { auth: true });

export const uploadDisasterImageryGeoTiff = (
  id: number,
  payload: {
    file: File;
    phase: ImageryPhase;
    satellite: string;
    acquisition_date: string;
    sensor?: string;
    resolution_m?: number;
    cloud_coverage_pct?: number;
    data_source?: string;
    is_primary?: boolean;
  },
) => {
  const fd = new FormData();
  fd.append("file", payload.file);
  fd.append("phase", payload.phase);
  fd.append("satellite", payload.satellite);
  fd.append("acquisition_date", payload.acquisition_date);
  if (payload.sensor) fd.append("sensor", payload.sensor);
  if (payload.resolution_m != null) fd.append("resolution_m", String(payload.resolution_m));
  if (payload.cloud_coverage_pct != null) fd.append("cloud_coverage_pct", String(payload.cloud_coverage_pct));
  if (payload.data_source) fd.append("data_source", payload.data_source);
  fd.append("is_primary", payload.is_primary ? "true" : "false");
  return apiClient.upload<SatelliteImagery>(`/admin/disasters/${id}/imagery/upload`, fd, {
    auth: true,
    timeoutMs: 30 * 60 * 1000,
  });
};

export const setPrimaryImagery = (id: number, imageryId: number) =>
  apiClient.post<SatelliteImagery>(`/admin/disasters/${id}/imagery/${imageryId}/primary`, undefined, {
    auth: true,
  });

export const listDisasterModels = (eventId?: number) =>
  apiClient.get<{ models: DisasterModelRegistryEntry[] }>(`/admin/disasters/models${eventId ? `?event_id=${eventId}` : ""}`, { auth: true });

export const createAnalysisRun = (
  id: number,
  payload: { model_id: string; aoi_id: number; pre_imagery_id?: number; post_imagery_id?: number; parameters?: Record<string, unknown> },
) => apiClient.post<AnalysisRun>(`/admin/disasters/${id}/analyses`, payload, { auth: true });

export const listAnalysisRuns = (id: number) =>
  apiClient.get<{ runs: AnalysisRunWithResult[] }>(`/admin/disasters/${id}/analyses`, { auth: true });

export const runAnalysis = (runId: number, force = false) =>
  apiClient.post<{ run: AnalysisRun; result: AnalysisResult }>(`/admin/analyses/${runId}/run${force ? "?force=true" : ""}`, undefined, {
    auth: true,
  });

export const updateAnalysisStatus = (runId: number, status: string) =>
  apiClient.patch<AnalysisRun>(`/admin/analyses/${runId}/status`, { status }, { auth: true });

export const publishAnalysis = (runId: number) =>
  apiClient.post<AnalysisResult>(`/admin/analyses/${runId}/publish`, undefined, { auth: true });

export const unpublishAnalysis = (runId: number) =>
  apiClient.post<AnalysisResult>(`/admin/analyses/${runId}/unpublish`, undefined, { auth: true });

export const updateAnalysisResult = (
  runId: number,
  payload: Partial<{
    statistics: Record<string, unknown>;
    legend: { label: string; color: string }[];
    confidence_summary: Record<string, unknown>;
  }>,
) => apiClient.patch<AnalysisResult>(`/admin/analyses/${runId}/result`, payload, { auth: true });

export const deleteAnalysisResult = (runId: number) =>
  apiClient.delete<{ message: string }>(`/admin/analyses/${runId}/result`, { auth: true });

export const getDisasterQc = (id: number) =>
  apiClient.get<DisasterQcStatus>(`/admin/disasters/${id}/qc`, { auth: true });

export const listHotspots = (id: number) =>
  apiClient.get<{ hotspots: Hotspot[] }>(`/admin/disasters/${id}/hotspots`, { auth: true });

export const createHotspot = (
  id: number,
  payload: {
    name: string;
    impact_level: string;
    geojson: Record<string, unknown>;
    analysis_result_id?: number;
    stats?: Record<string, unknown>;
    is_published?: boolean;
  },
) => apiClient.post<Hotspot>(`/admin/disasters/${id}/hotspots`, payload, { auth: true });

export const updateHotspot = (
  hotspotId: number,
  payload: Partial<{
    name: string;
    impact_level: string;
    geojson: Record<string, unknown>;
    stats: Record<string, unknown>;
    is_published: boolean;
  }>,
) => apiClient.patch<Hotspot>(`/admin/hotspots/${hotspotId}`, payload, { auth: true });

export const deleteHotspot = (hotspotId: number) =>
  apiClient.delete<{ message: string }>(`/admin/hotspots/${hotspotId}`, { auth: true });

export const getDisasterAudit = (id: number) =>
  apiClient.get<{ logs: DisasterAuditLogEntry[] }>(`/admin/disasters/${id}/audit`, { auth: true });
