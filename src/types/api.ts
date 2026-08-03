export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface HealthStatus {
  status: string;
  ee_initialized: boolean;
  database_connected: boolean;
  active_model?: string | null;
}

export interface RegionOption {
  code: string;
  name: string;
}

export interface AdminUser {
  username: string;
  role: string;
}

export interface LoginResponse {
  token: string;
  user: AdminUser;
  expires_at?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  version: string;
  is_default: boolean;
  created_at: string;
  description?: string;
}

export interface ConfigEntry {
  key: string;
  value: string | null;
  category: string;
  is_secret: boolean;
  is_configured: boolean;
  label?: string;
  description?: string;
}

export interface CompanyBoundary {
  id: string;
  name: string;
  is_active: boolean;
  source?: string;
}

/**
 * `industry_type` is a free-text `String(50)` column in the `companies`
 * table (no backend catalog endpoint constrains it), so this genuinely
 * belongs in the frontend per the KEEP_IN_FRONTEND audit finding. It used
 * to be defined independently in 3 places (admin/types.ts, admin's
 * CompanyBoundaries.tsx, carbon's AoiCompanyTab.tsx) with slightly
 * different label text - single source of truth now.
 */
export const INDUSTRY_LABEL: Record<string, string> = {
  mining: "Pertambangan",
  forestry: "Kehutanan (HPH/HTI)",
  plantation: "Perkebunan (HGU)",
  energy: "Energi (PLTU/PLTS/Migas)",
};

export const INDUSTRY_OPTIONS: { value: string; label: string }[] = Object.entries(INDUSTRY_LABEL).map(
  ([value, label]) => ({ value, label }),
);

export const COMPANY_SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  osm: "OpenStreetMap",
  gfw: "GlobalForestWatch",
};

/**
 * Chat session/message shapes - corrected to match the actual backend
 * (savegeo/backend/app/db/models/chat_session.py, chat_message.py, and
 * app/api/routes/chat.py). Ids are numeric (SQL autoincrement PKs), not
 * strings, and ChatSession carries a `message_count` (always present in
 * list/detail responses) plus an optional `messages` array only present
 * when a single session is fetched with full detail.
 */
export interface ChatSession {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id: number;
  session_id: number;
  role: "user" | "assistant";
  content: string;
  has_image: boolean;
  file_name: string | null;
  created_at: string;
}
