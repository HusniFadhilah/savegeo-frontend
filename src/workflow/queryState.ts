import type { ExecutionLocation } from "@/workflow/types";

export interface WorkflowQueryState {
  mode?: string; tool?: string; dataset?: string; year?: number; date?: string; aoi?: string;
  workflowId?: string; runId?: string; layer?: string; time?: string; basemap?: string; view?: "2d" | "3d";
  zoom?: number; lat?: number; lng?: number; steps?: string[]; execution?: ExecutionLocation;
}

const number = (value: string | null, min: number, max: number) => {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
};
const date = (value: string | null) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;

export function parseWorkflowQuery(search: string): WorkflowQueryState {
  const query = new URLSearchParams(search);
  const execution = query.get("execution");
  return {
    mode: query.get("mode") || undefined, tool: query.get("tool") || undefined, dataset: query.get("dataset") || undefined,
    year: number(query.get("year"), 1900, 2200), date: date(query.get("date")), aoi: query.get("aoi") || undefined,
    workflowId: query.get("workflowId") || undefined, runId: query.get("runId") || undefined, layer: query.get("layer") || undefined,
    time: date(query.get("time")), basemap: query.get("basemap") || undefined,
    view: query.get("view") === "3d" ? "3d" : query.has("view") ? "2d" : undefined,
    zoom: number(query.get("zoom"), 0, 24), lat: number(query.get("lat"), -90, 90), lng: number(query.get("lng"), -180, 180),
    steps: query.get("steps")?.split(",").map((step) => step.trim()).filter(Boolean).slice(0, 50),
    execution: execution === "browser" || execution === "backend" || execution === "auto" ? execution : undefined,
  };
}

export function serializeWorkflowQuery(state: WorkflowQueryState): URLSearchParams {
  const query = new URLSearchParams();
  const values: Record<string, string | number | undefined> = {
    mode: state.mode, tool: state.tool, dataset: state.dataset, year: state.year, date: date(state.date ?? null), aoi: state.aoi,
    workflowId: state.workflowId, runId: state.runId, layer: state.layer, time: date(state.time ?? null), basemap: state.basemap,
    view: state.view, zoom: state.zoom, lat: state.lat, lng: state.lng, steps: state.steps?.join(","), execution: state.execution,
  };
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); });
  return query;
}

export function canonicalWorkflowUrl(path: string, state: WorkflowQueryState): string {
  const query = serializeWorkflowQuery(state);
  const result = `${path}${query.toString() ? `?${query.toString()}` : ""}`;
  return result.length <= 1800 ? result : `${path}?workflowId=${encodeURIComponent(state.workflowId || "")}`;
}

export function updateWorkflowQuery(state: WorkflowQueryState, push = false): void {
  if (typeof window === "undefined") return;
  const query = serializeWorkflowQuery(state);
  window.history[push ? "pushState" : "replaceState"]({}, "", `${window.location.pathname}${query.toString() ? `?${query}` : ""}`);
  window.dispatchEvent(new Event("savegeo:workflow-query"));
}
