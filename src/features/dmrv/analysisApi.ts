import { apiClient } from "@/services/apiClient";
import type { DmrvJob } from "./types";

export type AnalysisKind = "carbon" | "landcover" | "landcover_transition" | "vegetation";
export interface AnalysisRequest {
  kind: AnalysisKind;
  monitoring_period_id: string;
  baseline_period_id?: string;
  parameters: {
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
export const listAnalysisRuns = (projectId: string, periodId = "") =>
  apiClient.get<AnalysisRun[]>(
    `${base(projectId)}${periodId ? `?monitoring_period_id=${encodeURIComponent(periodId)}` : ""}`,
    auth,
  );
export const createAnalysisRun = (projectId: string, request: AnalysisRequest, key: string) =>
  apiClient.post<DmrvJob>(base(projectId), request, {
    ...auth,
    headers: { "Idempotency-Key": key },
  });
export const cancelAnalysisRun = (projectId: string, jobId: string) =>
  apiClient.post<DmrvJob>(`${base(projectId)}/${encodeURIComponent(jobId)}/cancel`, {}, auth);
export const getWorkspaceUsage = (organizationId: string) =>
  apiClient.get<UsageSummary>(`/organizations/${encodeURIComponent(organizationId)}/usage`, auth);
