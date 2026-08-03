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

export type AdminSection = "ov" | "ge" | "ag" | "ml" | "cf" | "us" | "co";
