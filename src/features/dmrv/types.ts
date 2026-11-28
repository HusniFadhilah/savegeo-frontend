/** dMRV types matching the backend contract (savegeo/backend /api/dmrv, Plans 1 and 3). */

export type ProjectRole = "project_owner" | "analyst" | "field_operator" | "reviewer" | "verifier";

export interface Project {
  id: string;
  name: string;
  organization: string | null;
  organization_id?: string | null;
  activity_type: string;
  jurisdiction: string | null;
  methodology_id: string | null;
  methodology_version: string | null;
  start_date: string | null;
  crediting_period_years: number | null;
  status: string;
  revision: number;
  created_at: string | null;
  updated_at: string | null;
  my_role: ProjectRole | null;
}

export interface ProjectCreate {
  name: string;
  organization?: string | null;
  organization_id?: string | null;
  activity_type?: string;
  jurisdiction?: string | null;
  methodology_id?: string | null;
  methodology_version?: string | null;
}

export interface BoundaryOverlap {
  other_projects: number;
  overlap_ha: number;
}

export interface BoundaryVersion {
  id: string;
  version: number;
  crs: string;
  area_ha: number;
  area_method: string;
  checksum: string;
  created_by: string;
  reason: string;
  created_at: string | null;
  validated_geojson: object | null;
  overlap: BoundaryOverlap | null;
}

export interface RowIssue {
  row: number;
  level: "error" | "warning";
  code: string;
  message: string;
}

export interface ImportPreview {
  headers: string[];
  suggested_mapping: Record<string, string>;
  sample: Record<string, string>[];
  report: { rows_total: number; errors: number; warnings: number; issues: RowIssue[] };
}

export interface ImportResult {
  batch_id: string;
  status: "committed" | "partial" | "rejected";
  mode: "atomic" | "partial";
  rows_total: number;
  rows_imported: number;
  rows_rejected: number;
  plots_created: number;
  visits_created: number;
  issues: RowIssue[];
}

export interface Plot {
  plot_code: string;
  latitude: number | null;
  longitude: number | null;
  area_m2: number | null;
  area_basis: "measured" | "assumed" | null;
  visit_count: number;
}

export interface PlotDensity {
  source_type: string;
  biomass_dry_mg_per_ha: number | null;
  carbon_mg_c_per_ha: number | null;
  area_m2: number | null;
  area_basis: "measured" | "assumed" | null;
  carbon_fraction: number;
  trees_without_biomass: number;
  /** Dead or missing trees: left out of living biomass. */
  trees_excluded: number;
  blockers: string[];
}

export interface Visit {
  visit_date: string;
  date_precision: "day" | "year";
  tree_count: number;
  density: PlotDensity;
}

export interface ArrIllustrativeInput {
  key: string;
  value: string | null;
}

export interface ArrIllustrativeLine {
  key: string;
  value: string | null;
  unit: string;
  status: "computed" | "requires_data";
  equation: string;
}

export interface ArrIllustrativePreview {
  example_id: "arr_fixed_area_illustrative_v1";
  title: string;
  source_type: "accounting_result";
  qualification: "illustrative_only";
  formula_id: string;
  methodology_profile: null;
  verification_status: "not_verified";
  issuance_status: "not_issued";
  rounding_policy: string;
  area_ha: string;
  normalized_inputs: ArrIllustrativeInput[];
  lines: ArrIllustrativeLine[];
  blockers: string[];
}

export type DmrvJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface DmrvJob {
  id: string;
  project_id: string;
  kind: string;
  status: DmrvJobStatus;
  progress: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  attempts: number;
  cancel_requested: boolean;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface DmrvSnapshot {
  id: string;
  project_id: string;
  job_id: string | null;
  kind: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  snapshot_hash: string;
  created_by: string;
  created_at: string | null;
  mrv_review_status?: {
    status: string;
    submission_id: string | null;
    reviewer_key: string | null;
    decided_at: string | null;
    decision_reason: string | null;
    qualification: string;
  };
}

export interface EvidencePackage {
  id: string;
  project_id: string;
  snapshot_id: string;
  manifest: {
    snapshot: { id: string; kind: string; sha256: string };
    components: { name: string; status: "provided" | "missing" }[];
    entries: { path: string; size_bytes: number; sha256: string }[];
    verification_status: "not_verified";
    issuance_status: "not_issued";
    carbon_mrv_status?: {
      estimate: string | null;
      calibration: string | null;
      validation: string | null;
      validation_type: string | null;
      segmentation: string | null;
      review: string | null;
      accounting: string | null;
      registry: string | null;
    } | null;
  };
  manifest_hash: string;
  package_sha256: string;
  missing_components: string[];
  readiness: "incomplete" | "ready";
  created_by: string;
  created_at: string | null;
}

export interface EvidencePackageVerification {
  package_id: string;
  valid: boolean;
  code: string | null;
  checked_entries: number;
}

export type SubmissionStatus = "draft" | "submitted" | "under_review" | "changes_requested" | "approved" | "rejected" | "superseded";

export interface DmrvSubmission {
  id: string;
  project_id: string;
  version: number;
  evidence_package_id: string;
  locked_snapshot_hash: string;
  locked_manifest_hash: string;
  status: SubmissionStatus;
  created_by: string;
  reviewer_key: string | null;
  supersedes_id: string | null;
  revision: number;
  decision_reason: string | null;
  created_at: string | null;
  submitted_at: string | null;
  decided_at: string | null;
}

export interface DmrvReviewFinding {
  id: string;
  submission_id: string;
  code: string;
  message: string;
  status: "open" | "responded" | "resolved";
  due_date: string | null;
  response: string | null;
  evidence_references: string[];
  created_by: string;
  responded_by: string | null;
  resolved_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type MonitoringPeriodStatus = "planned" | "in_progress" | "completed";

export interface MonitoringPeriod {
  id: string;
  project_id: string;
  boundary_version: number;
  boundary_checksum: string;
  name: string;
  start_date: string;
  end_date: string;
  status: MonitoringPeriodStatus;
  revision: number;
  created_at: string | null;
  updated_at: string | null;
}
