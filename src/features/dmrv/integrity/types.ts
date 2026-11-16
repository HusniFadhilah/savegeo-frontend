import type { ProjectRole } from "../types";

export type Category =
  | "readiness"
  | "safeguard"
  | "risk"
  | "accounting"
  | "registry"
  | "validation"
  | "scan"
  | "grievance";
export interface Criterion {
  category: Category;
  key: string;
  title: string;
  title_en: string;
  required: boolean;
}
export interface Readiness {
  score_pct: number;
  accepted: number;
  submitted: number;
  total: number;
  blockers: (Criterion & { status: string })[];
  qualification: string;
}
export interface Metrics {
  n: number;
  r2: number | null;
  rmse: number;
  mae: number;
  bias: number;
}
export interface LedgerLine {
  pool: string;
  project_change_mg_c: number;
  baseline_change_mg_c: number;
  additional_change_mg_c: number;
  additional_tco2: number;
}
export interface IntegrityResult {
  [key: string]: unknown;
  lines?: LedgerLine[];
  gross_additional_tco2?: number;
  net_mitigation_tco2e?: number | null;
  scenario_units_tco2e?: number | null;
  buffer_reserve_tco2e?: number | null;
  missing_inputs?: string[];
  raw_map?: Metrics;
  calibrated_oof?: Metrics | null;
  n_blocks?: number;
  warnings?: string[];
  calibration_status?: string;
  boundary_version?: number;
  event_count?: number;
}
export interface IntegrityRecord {
  id: string;
  project_id: string;
  category: Category;
  record_key: string;
  title: string;
  payload: Record<string, unknown>;
  result: IntegrityResult;
  status: string;
  revision: number;
  created_by: string;
  updated_by: string;
  reviewed_by: string | null;
  review_reason: string | null;
  created_at: string;
  updated_at: string;
}
export interface IntegrityDocument {
  id: string;
  filename: string;
  content_type: string;
  sha256: string;
  size_bytes: number;
  created_at: string;
}
export interface RiskPolicy {
  enabled: boolean;
  interval_days: number;
  lookback_days: number;
  tree_loss_threshold_ha: number;
  min_observations: number;
  revision: number;
  next_run_at: string | null;
  last_enqueued_at: string | null;
}
export interface RegistryCheck {
  serial_conflicts: { record_id: string; conflicting_records: number }[];
  overlapping_projects: number;
  unique_overlap_ha: number;
  boundary_version: number | null;
  external_registry_status: string;
  qualification: string;
}
export interface IntegrityWorkspace {
  project_id: string;
  catalog: Criterion[];
  readiness: Readiness;
  records: IntegrityRecord[];
  documents: IntegrityDocument[];
  risk_policy: RiskPolicy;
  registry_check: RegistryCheck;
}
export interface PortfolioItem {
  id: string;
  name: string;
  organization: string | null;
  activity_type: string;
  methodology_id: string | null;
  methodology_version: string | null;
  my_role: ProjectRole;
  area_ha: number | null;
  readiness: Readiness;
  open_risks: number;
  overdue_periods: number;
  open_findings: number;
  data_gaps: string[];
}
export interface Portfolio {
  total: number;
  limit: number;
  offset: number;
  items: PortfolioItem[];
  summary: { projects: number; open_risks: number; overdue_periods: number; scope?: string };
}
export interface RecordSave {
  title: string;
  payload: Record<string, unknown>;
  status: "draft" | "submitted" | "open";
}
