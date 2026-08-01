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
} from "./types";

/**
 * All admin API callers. Paths and payload/response shapes are ported 1:1 from
 * frontend-nextjs2/public/admin-scripts.js's `api()` calls — do not rename
 * fields or change paths without checking that file + savegeo/backend first.
 * Every call passes `{ auth: true }` so apiClient attaches the bearer token.
 *
 * NOTE: as of savegeo/backend/README.md, the company-boundary admin CRUD/
 * import endpoints, the OpenRouter model-list proxy, and the key-pool status
 * endpoint are NOT YET implemented server-side (explicitly called out as
 * "not carried over" in that README). The callers below are wired to the
 * documented legacy paths regardless, so the UI is ready the moment the
 * backend adds them; until then those sections will surface a fetch error.
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

// ── Admin users ──────────────────────────────────────────────────
export const getCurrentAdminUser = () => apiClient.get<AdminUserRow>("/admin/auth/me", { auth: true });

export const changePassword = (oldPassword: string, newPassword: string) =>
  apiClient.put<{ message: string }>(
    "/admin/auth/change-password",
    { old_password: oldPassword, new_password: newPassword },
    { auth: true },
  );

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

export const importCompaniesFromGFW = (dataset: string) =>
  apiClient.post<{ imported: number; skipped: number; error?: string }>(
    "/admin/companies/import/gfw",
    { dataset },
    { auth: true },
  );
