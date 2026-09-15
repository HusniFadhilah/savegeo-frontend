import { apiClient } from "@/services/apiClient";
import type { WorkflowDefinition, WorkflowRun, WorkflowVisibility, ExecutionLocation } from "@/workflow/types";

export interface WorkflowRecord { id: string; name: string; description?: string; category: WorkflowDefinition["category"]; visibility: WorkflowVisibility; workflow: WorkflowDefinition; checksum?: string; owner?: string; updatedAt?: string; lastRun?: WorkflowRun | null; version: number }
export const workflowApi = {
  get: (id: string) => apiClient.get<WorkflowRecord>(`/workflows/${encodeURIComponent(id)}`, { auth: "user" }),
  list: () => apiClient.get<{ items: WorkflowRecord[]; total: number }>("/workflows", { auth: "user" }),
  create: (workflow: WorkflowDefinition) => apiClient.post<WorkflowRecord>("/workflows", { workflow }, { auth: "user" }),
  update: (id: string, workflow: WorkflowDefinition) => apiClient.put<WorkflowRecord>(`/workflows/${encodeURIComponent(id)}`, { workflow }, { auth: "user" }),
  remove: (id: string) => apiClient.delete<{ message: string }>(`/workflows/${encodeURIComponent(id)}`, { auth: "user" }),
  duplicate: (id: string) => apiClient.post<WorkflowRecord>(`/workflows/${encodeURIComponent(id)}/duplicate`, undefined, { auth: "user" }),
  share: (id: string) => apiClient.post<{ workflowId: string; visibility: WorkflowVisibility }>(`/workflows/${encodeURIComponent(id)}/share`, undefined, { auth: "user" }),
  run: (id: string, executionLocation: ExecutionLocation) => apiClient.post<WorkflowRun>(`/workflows/${encodeURIComponent(id)}/runs`, { executionLocation }, { auth: "user" }),
};
