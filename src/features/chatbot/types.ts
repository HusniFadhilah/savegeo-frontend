import type { ChatSession } from "@/types/api";

/** Session list item as returned inline by GET /chat/sessions (no messages array). */
export type ChatSessionSummary = Omit<ChatSession, "messages">;

/** Quick-action chip shown under the welcome message / after each response. */
export interface QuickAction {
  label: string;
  msg: string;
}

/**
 * Weakly-typed AI-issued action, mirroring the backend agent's action schema
 * one-to-one (savegeo-chatbot.js ActionExecutor._dispatch). Not every field
 * applies to every `type` - see actionExecutor.ts for which fields each type
 * reads.
 */
export interface ChatAction {
  type: string;
  module?: string;
  target?: string;
  value?: string | number | boolean | string[];
  analysis?: string;
  layer?: string;
  report?: string;
  lat?: number;
  lng?: number;
  zoom?: number;
  query?: string;
  label?: string;
  step?: number;
  total?: number;
  title?: string;
  body?: string;
  element_id?: string;
  hint?: string;
  question?: string;
  choices?: QuickAction[];
  topic?: string;
}

export interface ChatWarning {
  message?: string;
  [key: string]: unknown;
}

/** Response shape for POST /agent/control. */
export interface AgentControlResponse {
  intent?: string;
  confidence?: number;
  needs_confirmation?: boolean;
  message?: string;
  warnings?: (string | ChatWarning)[];
  actions?: ChatAction[];
  session_id?: number;
  retry_after?: number;
  error?: string;
  /** Legacy /agent/analyze-shaped fallback, handled defensively. */
  plan?: {
    user_guidance?: { plain_language?: string };
    message?: string;
    warnings?: (string | ChatWarning)[];
  };
  execution?: {
    executed?: boolean;
    report?: { audience_summary?: string };
  };
}

/** Page-state snapshot sent alongside every chat message for AI context. */
export interface ChatPageState {
  current_module: string;
  has_aoi: boolean;
  aoi_name: string | null;
  selected_year: number;
  selected_carbon_dataset: string | null;
  selected_carbon_model: string | null;
  available_carbon_datasets: string[];
  available_carbon_models: string[];
  available_landcover_datasets: string[];
  analysis_results: {
    carbon: boolean;
    landcover: boolean;
    vegetation: boolean;
    transition: boolean;
    carbon_data: Record<string, unknown> | null;
    vegetation_data: Record<string, unknown> | null;
  };
}

/** A file attached (not as an AOI) and queued to send with the next message. */
export interface PendingFileAttachment {
  name: string;
  mime_type: string;
  size_label: string;
  icon: string;
  text?: string | null;
  b64?: string | null;
}

/**
 * One entry in the on-screen chat log, in display order. Mirrors the sequence
 * of DOM nodes the original vanilla widget appended to #sgc-messages, but as
 * React-owned state so updates (rename, progress, resolution) go through
 * normal re-renders instead of manual DOM mutation.
 */
export type LogEntry =
  | {
      id: string;
      kind: "message";
      role: "user" | "assistant";
      text: string;
      image?: string | null;
      file?: { name: string; size_label: string; icon: string } | null;
    }
  | {
      id: string;
      kind: "loading";
      startedAt: number;
      /** Request in flight - kept on the entry so the inline 30s "Coba Lagi" can resend it directly. */
      message: string;
      image: string | null;
      file: PendingFileAttachment | null;
    }
  | { id: string; kind: "warnings"; warnings: string[] }
  | { id: string; kind: "actionHistory"; actions: ChatAction[]; timestamp?: string }
  | {
      id: string;
      kind: "confirmCard";
      actions: ChatAction[];
      status: "pending" | "running" | "done";
      runningStepIndex?: number;
    }
  | {
      id: string;
      kind: "choiceCard";
      question?: string;
      choices: QuickAction[];
      selectedIndex: number | null;
    }
  | { id: string; kind: "guideStep"; step: number; total: number; title: string; body: string }
  | {
      id: string;
      kind: "aoiOffer";
      geo: GeoJSON.GeoJSON;
      /** Original file text (or a re-serialization for parsed formats like KML/SHP), used by "Kirim ke AI". */
      rawText: string;
      fileName: string;
      name: string;
      sizeLabel: string;
      resolved: boolean;
    }
  | {
      id: string;
      kind: "retryChip";
      message: string;
      image: string | null;
      file: PendingFileAttachment | null;
      cancelNote?: string;
    }
  | { id: string; kind: "boundaryDownload"; name: string; downloadUrl: string; filename: string };
