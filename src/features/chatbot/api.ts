import { apiClient } from "@/services/apiClient";
import { env } from "@/config/env";
import type { ChatSession } from "@/types/api";
import type { AgentControlResponse, ChatPageState, PendingFileAttachment } from "./types";

/**
 * Same endpoint family as the legacy vanilla chatbot (savegeo-chatbot.js
 * `ChatbotAPI` + session-panel fetch calls), reimplemented against the
 * identical backend contract (savegeo/backend/app/api/routes/agent.py,
 * chat.py, utils.py, admin.py `/config/public`). None of these payload/
 * response shapes were changed.
 *
 * `sendAgentControl` uses a raw `fetch` (not `apiClient`) because it needs
 * an externally-owned AbortController so the in-flight request can be
 * cancelled from the "Batalkan"/retry-after-30s UI - `apiClient`'s
 * `request()` always creates and owns its own AbortController for its
 * fixed timeout and does not accept an external `signal` override.
 */

export interface SendAgentControlArgs {
  message: string;
  pageState: ChatPageState;
  imageB64?: string | null;
  attachment?: PendingFileAttachment | null;
  sessionId?: number | null;
  signal?: AbortSignal;
}

export async function sendAgentControl(args: SendAgentControlArgs): Promise<AgentControlResponse> {
  const payload: Record<string, unknown> = {
    message: args.message,
    page_state: args.pageState,
  };
  if (args.imageB64) payload.image = args.imageB64;
  if (args.sessionId) payload.session_id = args.sessionId;
  if (args.attachment) {
    payload.attachment = {
      name: args.attachment.name,
      mime_type: args.attachment.mime_type,
      text: args.attachment.text ?? null,
      b64: args.attachment.b64 ?? null,
    };
  }

  const res = await fetch(`${env.apiBaseUrl}/agent/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: args.signal,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 429) {
    throw new Error((body && (body.error as string)) || `HTTP ${res.status}`);
  }
  return body as AgentControlResponse;
}

export const chatbotApi = {
  sendAgentControl,

  async fetchSessions(): Promise<ChatSession[]> {
    try {
      const data = await apiClient.get<{ sessions: ChatSession[] }>("/chat/sessions");
      return data?.sessions || [];
    } catch {
      return [];
    }
  },

  async fetchSession(id: number): Promise<ChatSession | null> {
    try {
      return await apiClient.get<ChatSession>(`/chat/sessions/${id}`);
    } catch {
      return null;
    }
  },

  async renameSession(id: number, title: string): Promise<boolean> {
    try {
      await apiClient.put(`/chat/sessions/${id}`, { title });
      return true;
    } catch {
      return false;
    }
  },

  async deleteSession(id: number): Promise<boolean> {
    try {
      await apiClient.delete(`/chat/sessions/${id}`);
      return true;
    } catch {
      return false;
    }
  },

  /** Public (unauthenticated) config values, used here only for `ai.rate_limit_max_file_mb`. */
  async fetchPublicConfig(): Promise<Record<string, unknown>> {
    try {
      return await apiClient.get<Record<string, unknown>>("/admin/config/public");
    } catch {
      return {};
    }
  },

  async geocode(query: string): Promise<{
    lat: number;
    lng: number;
    display_name: string;
    bbox: [number, number, number, number] | null;
    address_info: { country_code: string; province: string; city: string; district: string; village: string };
  } | null> {
    try {
      return await apiClient.get(`/utils/geocode?q=${encodeURIComponent(query)}`);
    } catch {
      return null;
    }
  },

  async convertShp(
    zipB64: string,
    name: string,
  ): Promise<{ geojson: GeoJSON.FeatureCollection; feature_count: number; name: string; error?: string }> {
    return apiClient.post("/utils/convert_shp", { zip_b64: zipB64, name });
  },
};
