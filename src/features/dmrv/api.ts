import { ApiError, apiClient } from "@/services/apiClient";
import type {
  BoundaryVersion,
  ImportPreview,
  ImportResult,
  Plot,
  Project,
  ProjectCreate,
  Visit,
} from "./types";

const AUTH = { auth: "app" } as const;
const base = (id: string) => `/dmrv/projects/${encodeURIComponent(id)}`;
const withKey = (key: string) => ({ ...AUTH, headers: { "Idempotency-Key": key } });

export const listProjects = () => apiClient.get<Project[]>("/dmrv/projects", AUTH);

export const createProject = (payload: ProjectCreate, idempotencyKey: string) =>
  apiClient.post<Project>("/dmrv/projects", payload, withKey(idempotencyKey));

export const getProject = (id: string) => apiClient.get<Project>(base(id), AUTH);

export const listBoundaries = (id: string) => apiClient.get<BoundaryVersion[]>(`${base(id)}/boundaries`, AUTH);

export const addBoundary = (id: string, geojson: object, reason: string) =>
  apiClient.post<BoundaryVersion>(`${base(id)}/boundaries`, { geojson, reason }, AUTH);

export const previewFieldImport = (id: string, form: FormData) =>
  apiClient.upload<ImportPreview>(`${base(id)}/field-data/imports/preview`, form, AUTH);

export const commitFieldImport = (id: string, form: FormData, idempotencyKey: string) =>
  apiClient.upload<ImportResult>(`${base(id)}/field-data/imports`, form, withKey(idempotencyKey));

export const listPlots = (id: string) => apiClient.get<Plot[]>(`${base(id)}/field-data/plots`, AUTH);

export const listVisits = (id: string, plotCode: string) =>
  apiClient.get<Visit[]>(`${base(id)}/field-data/plots/${encodeURIComponent(plotCode)}/visits`, AUTH);

/** Machine-readable code from the dMRV error body, or null when the error is not a dMRV error. */
export function dmrvErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const payload = error.payload;
  if (payload && typeof payload === "object" && typeof (payload as { code?: unknown }).code === "string") {
    return (payload as { code: string }).code;
  }
  return null;
}

export const newIdempotencyKey = () => crypto.randomUUID();
