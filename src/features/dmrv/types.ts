/** dMRV types matching the backend contract (savegeo/backend /api/dmrv, Plans 1 and 3). */

export type ProjectRole = "project_owner" | "analyst" | "field_operator" | "reviewer" | "verifier";

export interface Project {
  id: string;
  name: string;
  organization: string | null;
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
  blockers: string[];
}

export interface Visit {
  visit_date: string;
  date_precision: "day" | "year";
  tree_count: number;
  density: PlotDensity;
}
