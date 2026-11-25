import { env } from "@/config/env";
import { ApiError, apiClient } from "@/services/apiClient";
import type {
  Category,
  CreditLedger,
  IntegrityDocument,
  IntegrityRecord,
  IntegrityWorkspace,
  MethodologyChecklist,
  Portfolio,
  ReviewerPriority,
  RecordSave,
  RiskPolicy,
} from "./types";

const AUTH = { auth: "app" } as const;
const base = (id: string) => `/dmrv/projects/${encodeURIComponent(id)}/integrity`;
const match = (revision: number) => ({ ...AUTH, headers: { "If-Match": `"${revision}"` } });
export const getWorkspace = (id: string) => apiClient.get<IntegrityWorkspace>(base(id), AUTH);
export const getMethodologyChecklist = (id: string) =>
  apiClient.get<MethodologyChecklist>(`${base(id)}/methodology-checklist`, AUTH);
export const getReviewerPriority = (id: string) =>
  apiClient.get<ReviewerPriority>(`${base(id)}/risk-priority`, AUTH);
export const getCreditLedger = (id: string) =>
  apiClient.get<CreditLedger>(`${base(id)}/credit-events`, AUTH);
export interface AutomaticImageSnapshot {
  id: string;
  kind: string;
  snapshot_hash: string;
  created_at: string;
  metadata: Record<string, unknown>;
  quality_warnings: string[];
  attestation: string;
}
export interface RegistryConnectorStatus {
  configured: boolean;
  provider: string | null;
  read_only: boolean;
  write_operations: boolean;
  status: string;
  required_environment: string[];
  response_contract: string;
  official_docs: Record<string, string>;
  message: string;
}
export const getRegistryConnectorStatus = (id: string) =>
  apiClient.get<RegistryConnectorStatus>(`${base(id)}/registry-connector/status`, AUTH);
export const syncOfficialRegistry = (id: string, registry: string, externalProjectId: string, key: string) =>
  apiClient.post<IntegrityRecord>(`${base(id)}/registry-connector/sync`, {
    registry, external_project_id: externalProjectId, record_key: key,
  }, { ...AUTH, headers: { "If-Match": '"0"' } });
export const getAutomaticImageSnapshots = (id: string) =>
  apiClient.get<{ items: AutomaticImageSnapshot[] }>(`${base(id)}/image-provenance/snapshots`, AUTH);
export const importRegistryCsv = (id: string, file: File, registry: string, key: string, sourceUrl = "") => {
  const form = new FormData();
  form.append("file", file);
  form.append("registry", registry);
  form.append("key", key);
  form.append("source_url", sourceUrl);
  return apiClient.upload<IntegrityRecord>(`${base(id)}/registry-import`, form, match(0));
};
export const appendCreditEvent = (id: string, payload: object) =>
  apiClient.post(`${base(id)}/credit-events`, payload, AUTH);
export const getRecord = (id: string, recordId: string) =>
  apiClient.get<IntegrityRecord>(`${base(id)}/records/${recordId}`, AUTH);
export const getPortfolio = (search: string, offset = 0) =>
  apiClient.get<Portfolio>(
    `/dmrv/portfolio?search=${encodeURIComponent(search)}&limit=50&offset=${offset}`,
    AUTH,
  );
export interface PortfolioDashboard {
  summary: { project_count: number; job_count: number; report_count: number; submission_count: number;
    risk_count: number; period_count: number; jobs_by_status: Record<string, number>; reports_ready: number };
  projects: Array<{ id: string; name: string; organization_id: string | null; status: string;
    activity_type: string; monitoring_period_count: number; job_counts: Record<string, number>;
    job_count: number; report_count: number; submission_count: number; risk_count: number }>;
  recent_jobs: Array<{ id: string; project_id: string; kind: string; status: string; created_at: string }>;
  recent_periods: Array<{ id: string; project_id: string; name: string; start_date: string; end_date: string; status: string }>;
  recent_reports: Array<{ id: string; project_id: string; snapshot_id: string; readiness: string; created_at: string }>;
  recent_submissions: Array<{ id: string; project_id: string; version: number; status: string; created_at: string }>;
  recent_risks: Array<{ id: string; project_id: string; title: string; status: string; updated_at: string }>;
}
export const getPortfolioDashboard = (year?: number) => {
  const range = year ? `?period_from=${year}-01-01&period_to=${year}-12-31` : "";
  return apiClient.get<PortfolioDashboard>(`/dmrv/dashboard${range}`, AUTH);
};
export const saveRecord = (
  id: string,
  category: Category,
  key: string,
  data: RecordSave,
  revision: number,
) =>
  apiClient.put<IntegrityRecord>(
    `${base(id)}/records/${category}/${encodeURIComponent(key)}`,
    data,
    match(revision),
  );
export const reviewRecord = (
  id: string,
  record: IntegrityRecord,
  decision: string,
  reason: string,
) =>
  apiClient.post<IntegrityRecord>(
    `${base(id)}/records/${record.id}/review`,
    { decision, reason },
    match(record.revision),
  );
export const deploySamplingPlanPlots = (id: string, recordId: string) =>
  apiClient.post<{ plot_count: number; created_plot_codes: string[]; warnings: string[] }>(
    `${base(id)}/records/${recordId}/deploy-plots`,
    {},
    AUTH,
  );
export const getHistory = (id: string, recordId: string) =>
  apiClient.get<{ revision: number; sha256: string; snapshot: IntegrityRecord }[]>(
    `${base(id)}/records/${recordId}/history`,
    AUTH,
  );
export const saveRiskPolicy = (id: string, policy: RiskPolicy) => {
  const { enabled, interval_days, lookback_days, tree_loss_threshold_ha, min_observations } =
    policy;
  return apiClient.put<RiskPolicy>(
    `${base(id)}/risk-policy`,
    { enabled, interval_days, lookback_days, tree_loss_threshold_ha, min_observations },
    match(policy.revision),
  );
};
export const queueRiskScan = (id: string, key: string) =>
  apiClient.post<{ id: string; status: string }>(
    `${base(id)}/risk-scans`,
    {},
    { ...AUTH, headers: { "Idempotency-Key": key } },
  );
export const uploadDocument = (id: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return apiClient.upload<IntegrityDocument>(`${base(id)}/documents`, form, AUTH);
};
export const importValidation = (
  id: string,
  file: File,
  metadata: object,
  key: string,
  revision = 0,
) => {
  const form = new FormData();
  form.append("file", file);
  form.append("metadata", JSON.stringify(metadata));
  form.append("key", key);
  return apiClient.upload<IntegrityRecord>(`${base(id)}/validation-import`, form, match(revision));
};
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function downloadSamplingFieldTemplate(id: string, recordId: string) {
  const response = await fetch(`${env.apiBaseUrl}${base(id)}/records/${encodeURIComponent(recordId)}/field-template.csv`, { credentials: "include" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(body?.message || `Download failed (${response.status})`, response.status);
  }
  saveBlob(await response.blob(), `savegeo-sampling-plan-${recordId.slice(0, 8)}.csv`);
}
export async function downloadWorkspace(id: string, document?: IntegrityDocument) {
  const path = document ? `${base(id)}/documents/${document.id}/download` : `${base(id)}/export`;
  const response = await fetch(`${env.apiBaseUrl}${path}`, { credentials: "include" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(body?.message || `Download failed (${response.status})`, response.status);
  }
  saveBlob(await response.blob(), document?.filename || `savegeo-integrity-${id}.zip`);
}
