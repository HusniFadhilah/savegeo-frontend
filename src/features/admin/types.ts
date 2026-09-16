/**
 * Admin-specific types not already covered by src/types/api.ts.
 * Mirrors the response/payload shapes consumed by frontend-nextjs2's
 * public/admin-scripts.js (source of truth for the legacy admin panel).
 */

export interface GeeCredential {
  id: number;
  label: string;
  notes?: string | null;
  project_id: string;
  client_email: string;
  is_active: boolean;
  uploaded_at?: string | null;
}

export interface ArcgisStatusInfo {
  enabled: boolean;
  configured: boolean;
  auth_mode?: string | null;
  portal_url?: string | null;
  can_reach_portal?: boolean | null;
  portal_error?: string | null;
  portal_name?: string | null;
  message?: string | null;
  checked_at?: string | null;
}

export interface MlModelMetrics {
  train_metrics?: { r2?: number; rmse?: number };
  cv_metrics?: { r2_mean?: number; rmse_mean?: number };
  n_features?: number;
  n_samples?: number;
  [key: string]: unknown;
}

export interface MlModel {
  id: number;
  name: string;
  display_name?: string | null;
  model_type: string;
  algorithm?: string | null;
  version?: string | null;
  metrics?: MlModelMetrics | null;
  metadata_json?: Record<string, unknown> | null;
  feature_names?: string[];
  file_size_kb?: number | null;
  is_active: boolean;
  is_default: boolean;
  is_legacy?: boolean;
  updated_at?: string | null;
}

export interface AdminConfigItem {
  key: string;
  /** Present for non-secret keys; omitted (not `false`) by the backend for secret keys - see `is_secret` below. */
  raw_value?: string | null;
  value_type: string;
  description?: string;
  /** Backend (`mask_config_dict`) only includes `is_secret`/`is_configured` at all when the key IS
   * secret - for non-secret keys both are simply absent from the response, not `false`. Falsy checks
   * (`item.is_secret ? ... : ...`) still work correctly against `undefined`. */
  is_secret?: boolean;
  is_configured?: boolean;
}

export type AdminConfigCategories = Record<string, AdminConfigItem[]>;

export interface KeyPoolKeyStatus {
  prefix: string;
  available: boolean;
  available_in?: number;
}

export type KeyPoolStatus = Record<string, KeyPoolKeyStatus[]>;

export interface OpenRouterModelInfo {
  id: string;
  name: string;
  is_free: boolean;
  input_per_m?: number;
  output_per_m?: number;
  context_length?: number;
}

export interface CompanyBoundaryFull {
  id: number;
  name: string;
  company_name?: string | null;
  industry_type: "mining" | "forestry" | "plantation" | "energy" | string;
  sub_type?: string | null;
  province?: string | null;
  district?: string | null;
  description?: string | null;
  area_ha?: number | null;
  source: "manual" | "osm" | "gfw" | string;
  is_active: boolean;
}

export interface AdminUserRow {
  id: number;
  username: string;
  email?: string | null;
  is_active: boolean;
  role?: string | null;
  permissions?: string[] | null;
  created_at?: string | null;
  last_login?: string | null;
}

export interface AdminRole {
  id: number;
  name: string;
  description?: string | null;
  is_default: boolean;
  permissions: string[];
}

export interface AiProviderDef {
  id: string;
  label: string;
  icon: string;
  keyField: string | null;
  needsKey: boolean;
  hint: string;
}

/** Same catalogue as AI_PROVIDERS in admin-scripts.js — drives the provider-card selector. */
export const AI_PROVIDERS: AiProviderDef[] = [
  { id: "anthropic", label: "Anthropic", icon: "\u{1F916}", keyField: "ai.anthropic_api_key", needsKey: true, hint: "Claude 3.x / 4.x" },
  { id: "openai", label: "OpenAI / Codex", icon: "\u{1F535}", keyField: "ai.openai_api_key", needsKey: true, hint: "GPT-4o, o1, Codex" },
  { id: "openrouter", label: "OpenRouter", icon: "\u{1F500}", keyField: "ai.openrouter_api_key", needsKey: true, hint: "Multi-model gateway" },
  { id: "deepseek", label: "DeepSeek", icon: "\u{1F30A}", keyField: "ai.deepseek_api_key", needsKey: true, hint: "deepseek-chat / coder" },
  { id: "gemini", label: "Google Gemini", icon: "✨", keyField: "ai.gemini_api_key", needsKey: true, hint: "Gemini 1.5 / 2.0" },
  { id: "ollama", label: "Ollama (lokal)", icon: "\u{1F999}", keyField: null, needsKey: false, hint: "Llama, Mistral, dsb." },
  { id: "opencode", label: "OpenCode", icon: "\u{1F4BB}", keyField: null, needsKey: false, hint: "OpenAI-compat, atur Base URL" },
];

/** Same catalogue as _KEY_POOL_PROVIDERS in admin-scripts.js. */
export const KEY_POOL_PROVIDERS: { id: string; label: string; icon: string }[] = [
  { id: "gemini", label: "Gemini", icon: "✨" },
  { id: "openrouter", label: "OpenRouter", icon: "\u{1F500}" },
  { id: "anthropic", label: "Anthropic", icon: "\u{1F9E0}" },
  { id: "openai", label: "OpenAI", icon: "\u{1F916}" },
  { id: "deepseek", label: "DeepSeek", icon: "\u{1F30A}" },
];

export const CAT_LABELS: Record<string, string> = {
  analysis: "Analisis",
  year: "Rentang Tahun",
  carbon: "Carbon & Visualisasi",
  app: "Aplikasi",
  ai: "AI Controller",
};

export const CAT_COLORS: Record<string, string> = {
  analysis: "badge-blue",
  year: "badge-amber",
  carbon: "badge-green",
  app: "badge-gray",
  ai: "badge-purple",
};

// Canonical definitions moved to src/types/api.ts (shared with the carbon
// feature's company AOI picker, which had its own drifting copy) -
// re-exported here so existing imports of `INDUSTRY_LABEL`/`SOURCE_LABEL`
// from this module keep working unchanged.
export { INDUSTRY_LABEL, INDUSTRY_OPTIONS, COMPANY_SOURCE_LABEL as SOURCE_LABEL } from "@/types/api";

export type AdminSection = "ov" | "ge" | "ag" | "ml" | "cc" | "cf" | "us" | "co" | "ds" | "sp" | "gd" | "ri";

export interface CarbonCalibrationDataset {
  id: number;
  dataset_id: string;
  name: string;
  manifest: Record<string, unknown>;
  access: string;
  status: string;
  is_active: boolean;
  validation_report?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CarbonCalibrationFile {
  id: number;
  source_name: string;
  media_type?: string | null;
  size_bytes: number;
  sha256: string;
  file_kind: string;
  metadata?: Record<string, unknown> | null;
}

/** GET /admin/satellite-providers row - merged registry defaults + DB
 * override, plus admin-only bookkeeping fields not exposed on the public
 * GET /vegetation/satellites picker. */
export interface SatelliteProviderRow {
  key: string;
  name: string;
  provider: string;
  gee_collection: string;
  band_role_map: Record<string, string>;
  resolution_m: number;
  resolution_label: string;
  revisit_days: number;
  swath_km: number;
  launch: string;
  start_year: number;
  bands_available: string[];
  description: string;
  is_active: boolean;
  display_order: number;
  /** true = an override row exists in the DB (has actually been edited); false = pure registry default still in effect. */
  has_override: boolean;
}

// ── Disaster Intelligence Dashboard (Admin) ─────────────────────────
// Mirrors savegeo/backend/docs/disaster-redesign-contract.md section A response
// shapes 1:1 (each model's `.to_dict()`). Do not rename fields without checking
// that doc + the backend models under app/db/models/ first.

export type DisasterType =
  | "flood"
  | "landslide"
  | "forest_fire"
  | "earthquake"
  | "tsunami"
  | "volcanic_eruption"
  | "storm"
  | "drought"
  | "other";

export type DisasterEventStatus = "draft" | "processing" | "ready_for_review" | "published" | "archived";

export type DisasterSeverity = "low" | "medium" | "high" | "critical";

export interface DisasterEvent {
  id: number;
  name: string;
  disaster_type: DisasterType | string;
  location_name?: string | null;
  province: string[];
  district: string[];
  event_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status: DisasterEventStatus | string;
  severity?: DisasterSeverity | string | null;
  description?: string | null;
  source?: string | null;
  thumbnail?: string | null;
  slug?: string | null;
  short_title?: string | null;
  monitoring_from?: string | null;
  monitoring_to?: string | null;
  methodology?: string | null;
  limitations?: string[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DisasterAoi {
  id: number;
  event_id: number;
  /** Only present when the backend includes geometry (AOI.to_dict(include_geojson=True), the default). */
  geojson?: GeoJSON.Feature | GeoJSON.Geometry | Record<string, unknown>;
  area_ha?: number | null;
  centroid?: { lat: number; lng: number } | null;
  bbox?: number[] | null;
  source: string;
  created_at?: string | null;
}

export type ImageryPhase = "pre" | "post";

export interface SatelliteImagery {
  id: number;
  event_id: number;
  phase: ImageryPhase | string;
  satellite: string;
  acquisition_date: string;
  sensor?: string | null;
  resolution_m?: number | null;
  cloud_coverage_pct?: number | null;
  data_source?: string | null;
  is_primary: boolean;
  preview_tile_url?: string | null;
  source_kind?: "gee" | "local_upload" | string;
  created_at?: string | null;
}

export type AnalysisRunStatus = "queued" | "processing" | "completed" | "failed" | "review_required" | "published";

export interface AnalysisRun {
  id: number;
  event_id: number;
  model_id: string;
  model_version?: string | null;
  aoi_id: number;
  pre_imagery_id?: number | null;
  post_imagery_id?: number | null;
  status: AnalysisRunStatus | string;
  started_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
  created_at?: string | null;
}

export interface AnalysisResult {
  comparison?: import("@/features/disaster/components/SegmentationComparison").SegmentationResult | null;
  id: number;
  run_id: number;
  tile_url?: string | null;
  statistics?: Record<string, unknown> | null;
  /** Only present when the backend was asked for it (`include_features=True`) - always null for MVP's 3 real models. */
  features?: GeoJSON.FeatureCollection | null;
  legend: { label: string; color: string }[];
  confidence_summary?: Record<string, unknown> | null;
  is_published: boolean;
  published_at?: string | null;
  publication_version: number;
  created_at?: string | null;
}

export interface AnalysisRunWithResult {
  run: AnalysisRun;
  result: AnalysisResult | null;
}

/** One entry from `app/registries/disaster_model_registry.py::list_models()`. */
export interface DisasterModelRegistryEntry {
  configured?: boolean; recommended?: boolean; availability_reason?: string; reliability?: string;
  inputs_ready?: boolean; default_pre_imagery_id?: number; default_post_imagery_id?: number;
  model_id: string;
  backend_label: string;
  user_label: string;
  category: string;
  version: string;
  input_type: string[];
  output_type: string;
  satellite?: string | null;
  description: string;
  enabled: boolean;
}

export type HotspotImpactLevel = "low" | "medium" | "high" | "critical";

export interface Hotspot {
  id: number;
  event_id: number;
  analysis_result_id?: number | null;
  name: string;
  impact_level: HotspotImpactLevel | string;
  geojson: GeoJSON.Feature | GeoJSON.Geometry | Record<string, unknown>;
  stats?: Record<string, unknown> | null;
  is_published: boolean;
  created_at?: string | null;
}

export interface DisasterAuditLogEntry {
  id: number;
  admin_user_id?: number | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  detail?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at?: string | null;
}

/** `GET /admin/disasters/{id}` response shape. */
export interface DisasterEventDetail {
  event: DisasterEvent;
  aoi: DisasterAoi | null;
  imagery: { pre: SatelliteImagery[]; post: SatelliteImagery[] };
  runs: AnalysisRunWithResult[];
}

/** `GET /admin/disasters/{id}/qc` response shape. */
export interface DisasterQcStatus {
  aoi_configured: boolean;
  pre_imagery_available: boolean;
  post_imagery_available: boolean;
  analyses: { model_id: string; status: string; has_statistics: boolean; has_legend: boolean; has_confidence: boolean }[];
  ready_to_publish: boolean;
}
