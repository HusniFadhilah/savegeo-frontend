import { ApiError, apiClient } from "@/services/apiClient";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import type {
  BoundaryVersion,
  ArrIllustrativePreview,
  ImportPreview,
  ImportResult,
  DmrvJob,
  DmrvSnapshot,
  EvidencePackage,
  EvidencePackageVerification,
  DmrvSubmission,
  DmrvReviewFinding,
  MonitoringPeriod,
  Plot,
  Project,
  ProjectCreate,
  Visit,
} from "./types";
import type { FieldCapture } from "./integrity/types";

const AUTH = { auth: "app" } as const;
const base = (id: string) => `/dmrv/projects/${encodeURIComponent(id)}`;
const withKey = (key: string) => ({ ...AUTH, headers: { "Idempotency-Key": key } });

export const listProjects = () => apiClient.get<Project[]>("/dmrv/projects", AUTH);

export const createProject = (payload: ProjectCreate, idempotencyKey: string) =>
  apiClient.post<Project>("/dmrv/projects", payload, withKey(idempotencyKey));

const offlineProjectKey = (id: string) => {
  const user = useUserAuthStore.getState().user;
  const admin = useAuthStore.getState().user;
  const principalKey = user ? `user:${user.id}` : admin ? `admin:${admin.id}` : null;
  return principalKey ? `savegeo-dmrv-project:${principalKey}:${id}` : null;
};
export async function getProject(id: string): Promise<Project> {
  try {
    const project = await apiClient.get<Project>(base(id), AUTH);
    // Keep only the identity and role needed to reopen the field capture form offline.
    try {
      const minimal: Project = {
        id: project.id,
        name: project.name,
        organization: null,
        organization_id: null,
        activity_type: project.activity_type,
        jurisdiction: null,
        methodology_id: project.methodology_id,
        methodology_version: project.methodology_version,
        start_date: null,
        crediting_period_years: null,
        status: "offline_snapshot",
        revision: project.revision,
        created_at: null,
        updated_at: null,
        my_role: project.my_role,
      };
      const key = offlineProjectKey(id);
      if (key) localStorage.setItem(key, JSON.stringify(minimal));
    } catch {
      // Browser storage may be disabled; the online project page still works.
    }
    return project;
  } catch (cause) {
    if (!navigator.onLine) {
      try {
        const key = offlineProjectKey(id);
        const cached = key ? localStorage.getItem(key) : null;
        if (cached) {
          const project = JSON.parse(cached) as Project;
          if (project.id === id && project.my_role) return project;
        }
      } catch {
        // Fall through to the original API error if local data is unavailable.
      }
    }
    throw cause;
  }
}

export const getArrIllustrativeExample = () =>
  apiClient.get<ArrIllustrativePreview>("/dmrv/examples/arr-accounting", AUTH);

export const createFieldSummaryJob = (id: string, idempotencyKey: string, monitoringPeriodId?: string) =>
  apiClient.post<DmrvJob>(`${base(id)}/jobs`, {
    kind: "field_summary",
    ...(monitoringPeriodId ? { monitoring_period_id: monitoringPeriodId } : {}),
  }, withKey(idempotencyKey));

export const listDmrvJobs = (id: string) => apiClient.get<DmrvJob[]>(`${base(id)}/jobs`, AUTH);

export const cancelDmrvJob = (id: string, jobId: string) =>
  apiClient.post<DmrvJob>(`${base(id)}/jobs/${encodeURIComponent(jobId)}/cancel`, {}, AUTH);

export const getDmrvSnapshot = (id: string, snapshotId: string) =>
  apiClient.get<DmrvSnapshot>(`${base(id)}/snapshots/${encodeURIComponent(snapshotId)}`, AUTH);

export const carbonStatisticsCsvPath = (id: string, snapshotId: string) =>
  `${base(id)}/snapshots/${encodeURIComponent(snapshotId)}/carbon-statistics.csv`;

export const downloadCarbonStatisticsCsv = (id: string, snapshotId: string) =>
  apiClient.getBlob(carbonStatisticsCsvPath(id, snapshotId), AUTH);

export const createEvidencePackage = (id: string, snapshotId: string, idempotencyKey: string) =>
  apiClient.post<EvidencePackage>(`${base(id)}/evidence-packages`, { snapshot_id: snapshotId }, withKey(idempotencyKey));

export const listEvidencePackages = (id: string) =>
  apiClient.get<EvidencePackage[]>(`${base(id)}/evidence-packages`, AUTH);

export const verifyEvidencePackage = (id: string, packageId: string) =>
  apiClient.get<EvidencePackageVerification>(
    `${base(id)}/evidence-packages/${encodeURIComponent(packageId)}/verify`, AUTH,
  );

export const evidencePackageDownloadPath = (id: string, packageId: string) =>
  `/dmrv/projects/${encodeURIComponent(id)}/evidence-packages/${encodeURIComponent(packageId)}/download`;

export const listDmrvSubmissions = (id: string) =>
  apiClient.get<DmrvSubmission[]>(`${base(id)}/submissions`, AUTH);

export const createSubmissionDraft = (
  id: string,
  evidencePackageId: string,
  idempotencyKey: string,
  supersedesId?: string,
) => apiClient.post<DmrvSubmission>(`${base(id)}/submissions`, {
  evidence_package_id: evidencePackageId,
  ...(supersedesId ? { supersedes_id: supersedesId } : {}),
}, withKey(idempotencyKey));

export const submitDmrvSubmission = (id: string, submissionId: string) =>
  apiClient.post<DmrvSubmission>(`${base(id)}/submissions/${encodeURIComponent(submissionId)}/submit`, {}, AUTH);

export const startDmrvReview = (id: string, submissionId: string) =>
  apiClient.post<DmrvSubmission>(`${base(id)}/submissions/${encodeURIComponent(submissionId)}/review/start`, {}, AUTH);

export const listDmrvFindings = (id: string, submissionId: string) =>
  apiClient.get<DmrvReviewFinding[]>(`${base(id)}/submissions/${encodeURIComponent(submissionId)}/findings`, AUTH);

export const createDmrvFinding = (
  id: string,
  submissionId: string,
  payload: { code: string; message: string },
  idempotencyKey: string,
) => apiClient.post<DmrvReviewFinding>(
  `${base(id)}/submissions/${encodeURIComponent(submissionId)}/findings`, payload, withKey(idempotencyKey),
);

export const respondDmrvFinding = (
  id: string,
  submissionId: string,
  findingId: string,
  response: string,
) => apiClient.post<DmrvReviewFinding>(
  `${base(id)}/submissions/${encodeURIComponent(submissionId)}/findings/${encodeURIComponent(findingId)}/respond`,
  { response, evidence_references: [] }, AUTH,
);

export const resolveDmrvFinding = (id: string, submissionId: string, findingId: string) =>
  apiClient.post<DmrvReviewFinding>(
    `${base(id)}/submissions/${encodeURIComponent(submissionId)}/findings/${encodeURIComponent(findingId)}/resolve`,
    {}, AUTH,
  );

export const decideDmrvSubmission = (
  id: string,
  submissionId: string,
  decision: "approved" | "changes_requested" | "rejected",
  reason: string,
) => apiClient.post<DmrvSubmission>(
  `${base(id)}/submissions/${encodeURIComponent(submissionId)}/decision`, { decision, reason }, AUTH,
);

export const listMonitoringPeriods = (id: string) =>
  apiClient.get<MonitoringPeriod[]>(`${base(id)}/monitoring-periods`, AUTH);

export const createMonitoringPeriod = (
  id: string,
  payload: { name: string; start_date: string; end_date: string; boundary_version: number },
  idempotencyKey: string,
) => apiClient.post<MonitoringPeriod>(`${base(id)}/monitoring-periods`, payload, withKey(idempotencyKey));

export const updateMonitoringPeriod = (
  id: string,
  period: MonitoringPeriod,
  status: "in_progress" | "completed",
) => apiClient.patch<MonitoringPeriod>(
  `${base(id)}/monitoring-periods/${encodeURIComponent(period.id)}`,
  { status },
  { ...AUTH, headers: { "If-Match": `"${period.revision}"` } },
);

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

export interface FieldCaptureDraft {
  capture_id: string;
  plot_code: string;
  observed_at: string;
  latitude: number;
  longitude: number;
  gps_accuracy_m: number | null;
  observation: string;
  photo: File | null;
}

export const listFieldCaptures = (id: string) =>
  apiClient.get<FieldCapture[]>(`${base(id)}/field-data/captures`, AUTH);

export const syncFieldCapture = (id: string, draft: FieldCaptureDraft) => {
  const form = new FormData();
  const { photo, ...payload } = draft;
  form.append("data", JSON.stringify(payload));
  if (photo) form.append("file", photo, photo.name);
  return apiClient.upload<FieldCapture>(`${base(id)}/field-data/captures`, form, AUTH);
};

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
