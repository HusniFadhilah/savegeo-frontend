import { apiClient } from "@/services/apiClient";
import type { DmrvJob } from "./types";

export type AnalysisKind = "carbon" | "landcover" | "landcover_transition" | "vegetation";
export interface AnalysisRequest {
  kind: AnalysisKind;
  monitoring_period_id: string;
  baseline_period_id?: string;
  parameters: {
    model_name?: string;
    calibration_model_id?: number;
    reference_dataset?: string;
    datasets?: string[];
    dataset?: string;
    indices?: string[];
    cloud_threshold?: number;
  };
}
export interface AnalysisRun {
  job: DmrvJob;
  context_hash: string;
  context: {
    period: { id: string; start: string; end: string; revision: number };
    boundary: { id: string; version: number; checksum: string; area_ha: number };
  };
}
export interface UsageSummary {
  limit: number;
  reserved: number;
  used: number;
  remaining: number;
  cycle_start: string;
  timezone: string;
  unit: string;
  policy_version: string;
}
const auth = { auth: "app" } as const;
const base = (projectId: string) => `/dmrv/projects/${encodeURIComponent(projectId)}/analysis-runs`;
export const listAnalysisRuns = (projectId: string, periodId = "", limit = 20, offset = 0) => {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (periodId) query.set("monitoring_period_id", periodId);
  return apiClient.get<AnalysisRun[]>(`${base(projectId)}?${query}`, auth);
};
export const createAnalysisRun = (projectId: string, request: AnalysisRequest, key: string) =>
  apiClient.post<DmrvJob>(base(projectId), request, {
    ...auth,
    headers: { "Idempotency-Key": key },
  });
export const cancelAnalysisRun = (projectId: string, jobId: string) =>
  apiClient.post<DmrvJob>(`${base(projectId)}/${encodeURIComponent(jobId)}/cancel`, {}, auth);
export const getWorkspaceUsage = (organizationId: string) =>
  apiClient.get<UsageSummary>(`/organizations/${encodeURIComponent(organizationId)}/usage`, auth);
