import { env } from "@/config/env";
import { ApiError, apiClient } from "@/services/apiClient";
import type {
  Category,
  IntegrityDocument,
  IntegrityRecord,
  IntegrityWorkspace,
  Portfolio,
  RecordSave,
  RiskPolicy,
} from "./types";

const AUTH = { auth: "app" } as const;
const base = (id: string) => `/dmrv/projects/${encodeURIComponent(id)}/integrity`;
const match = (revision: number) => ({ ...AUTH, headers: { "If-Match": `"${revision}"` } });
export const getWorkspace = (id: string) => apiClient.get<IntegrityWorkspace>(base(id), AUTH);
export const getRecord = (id: string, recordId: string) =>
  apiClient.get<IntegrityRecord>(`${base(id)}/records/${recordId}`, AUTH);
export const getPortfolio = (search: string, offset = 0) =>
  apiClient.get<Portfolio>(
    `/dmrv/portfolio?search=${encodeURIComponent(search)}&limit=50&offset=${offset}`,
    AUTH,
  );
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
export async function downloadWorkspace(id: string, document?: IntegrityDocument) {
  const path = document ? `${base(id)}/documents/${document.id}/download` : `${base(id)}/export`;
  const response = await fetch(`${env.apiBaseUrl}${path}`, { credentials: "include" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(body?.message || `Download failed (${response.status})`, response.status);
  }
  saveBlob(await response.blob(), document?.filename || `savegeo-integrity-${id}.zip`);
}
