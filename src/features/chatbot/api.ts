import { ApiError, apiClient } from "@/services/apiClient";
import type { ChatSession } from "@/types/api";
import type { AgentControlResponse, AiCatalog, ChatPageState, GeoAiContext, PendingFileAttachment } from "./types";

/**
 * Same endpoint family as the legacy vanilla chatbot (savegeo-chatbot.js
 * `ChatbotAPI` + session-panel fetch calls), reimplemented against the
 * identical backend contract (savegeo/backend/app/api/routes/agent.py,
 * chat.py, utils.py, admin.py `/config/public`). None of these payload/
 * response shapes were changed.
 *
 * Requests share cancellation, safe errors and session expiry with apiClient.
 */

export interface SendAgentControlArgs {
  message: string;
  pageState: ChatPageState;
  /** "geoai" (default, grounded tool-calling assistant) or "control" (legacy UI-automation planner). */
  mode?: "geoai" | "control";
  /** Required when mode="geoai" - see pageContext.ts buildGeoAiContext(). */
  context?: GeoAiContext;
  imageB64?: string | null;
  attachment?: PendingFileAttachment | null;
  sessionId?: number | null;
  /** Chosen provider/model; the backend rejects anything outside the admin allowlist. */
  ai?: { provider: string; model: string } | null;
  signal?: AbortSignal;
}

export async function sendAgentControl(args: SendAgentControlArgs): Promise<AgentControlResponse> {
  const payload: Record<string, unknown> = {
    message: args.message,
    page_state: args.pageState,
    mode: args.mode || "geoai",
  };
  if (args.context) payload.context = args.context;
  if (args.imageB64) payload.image = args.imageB64;
  if (args.sessionId) payload.session_id = args.sessionId;
  if (args.ai) payload.ai = args.ai;
  if (args.attachment) {
    payload.attachment = {
      name: args.attachment.name,
      mime_type: args.attachment.mime_type,
      text: args.attachment.text ?? null,
      b64: args.attachment.b64 ?? null,
    };
  }

  try {
    return await apiClient.post<AgentControlResponse>("/agent/control", payload, {
      auth: "app", signal: args.signal,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 429 && error.payload && typeof error.payload === "object") {
      return error.payload as AgentControlResponse;
    }
    if (error instanceof ApiError && error.status === 500 && error.payload && typeof error.payload === "object"
      && (error.payload as Record<string, unknown>).intent === "error") {
      // Preserve retry state without reflecting a raw server exception in the conversation.
      return { ...(error.payload as AgentControlResponse), message: error.message };
    }
    throw error;
  }
}

export const chatbotApi = {
  sendAgentControl,

  /** Provider/model choices this user may select, with live status. Null when unavailable. */
  async fetchProviders(): Promise<AiCatalog | null> {
    try {
      return await apiClient.get<AiCatalog>("/agent/providers");
    } catch {
      return null;
    }
  },

  async fetchSessions(): Promise<ChatSession[]> {
    try {
      const data = await apiClient.get<{ sessions: ChatSession[] }>("/chat/sessions", { auth: "app" });
      return data?.sessions || [];
    } catch {
      return [];
    }
  },

  async fetchSession(id: number): Promise<ChatSession | null> {
    try {
      return await apiClient.get<ChatSession>(`/chat/sessions/${id}`, { auth: "app" });
    } catch {
      return null;
    }
  },

  async renameSession(id: number, title: string): Promise<boolean> {
    try {
      await apiClient.put(`/chat/sessions/${id}`, { title }, { auth: "app" });
      return true;
    } catch {
      return false;
    }
  },

  async deleteSession(id: number): Promise<boolean> {
    try {
      await apiClient.delete(`/chat/sessions/${id}`, { auth: "app" });
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
