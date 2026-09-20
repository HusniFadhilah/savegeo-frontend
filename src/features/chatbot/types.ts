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
  type?: string;
  /** Typed UI command emitted by the grounded assistant. */
  action?: string;
  parameters?: Record<string, unknown>;
  reason?: string;
  expected_state?: Record<string, unknown>;
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
  /** geoai-mode map actions: zoom_to_feature / highlight_polygon carry the geometry inline. */
  geometry?: GeoJSON.Geometry;
  /** geoai-mode: highlight_hotspot / show_before_after reference a hotspot from this turn's cards[]. */
  hotspot_id?: string;
  /** geoai-mode: open_analysis_result. */
  kind?: "carbon" | "vegetation" | "landcover" | "landcover_transition";
}

export interface ChatWarning {
  message?: string;
  [key: string]: unknown;
}

/** Provenance stamp carried by geoai-mode results, per "never invent numbers" (spec section 10). */
export interface ResultSource {
  source?: string;
  analysis_id?: string | null;
  dataset?: string | null;
  period?: string | number | null;
  generated_at?: string | null;
}

/** One reusable structured result card the SaveGeo Assistant can attach to a response. */
export type ResultCard =
  | {
      type: "metric";
      title: string;
      metrics: { label: string; value: string | number; unit?: string }[];
      source?: ResultSource;
    }
  | {
      type: "hotspot";
      id: string;
      title: string;
      area_ha: number;
      metric_label: string;
      metric_value: string | number;
      period?: string;
      geometry: GeoJSON.Geometry;
      centroid?: [number, number] | null;
      source?: ResultSource;
    }
  | {
      type: "comparison";
      title: string;
      before: Record<string, unknown>;
      after: Record<string, unknown>;
      source?: ResultSource;
    }
  | { type: "warning"; message: string }
  | { type: "suggested_action"; label: string; message: string };

/** Response shape for POST /agent/control. */
export interface AgentControlResponse {
  intent?: string;
  confidence?: number;
  needs_confirmation?: boolean;
  message?: string;
  warnings?: (string | ChatWarning)[];
  actions?: ChatAction[];
  /** geoai-mode only: structured result cards (spec section 14). */
  cards?: ResultCard[];
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

/**
 * Richer grounding context sent to POST /agent/control when mode="geoai" -
 * the actual AOI geometry + already-computed analysis results (not just
 * booleans), so the assistant can answer without re-running anything. See
 * windowBridge.ts buildGeoAiContext().
 */
export interface GeoAiContext {
  aoi: GeoJSON.GeoJSON | null;
  aoi_name: string | null;
  area_ha: number | null;
  bbox: [number, number, number, number] | null;
  current_module: string;
  period: string | null;
  selected_year: number;
  active_layer: string | null;
  selected_feature: GeoJSON.Feature | null;
  landcover_dataset: string | null;
  results: {
    carbon?: Record<string, unknown> | null;
    direct?: Array<Record<string, unknown>> | null;
    vegetation?: Record<string, unknown> | null;
    landcover?: Record<string, unknown> | null;
    landcover_transition?: Record<string, unknown> | null;
    crop?: Record<string, unknown> | null;
    disaster?: Record<string, unknown> | null;
  };
}

/** Page-state snapshot sent alongside every chat message for AI context. */
export interface ChatPageState {
  route?: string;
  map?: { center: number[] | null; zoom: number | null };
  ui?: { carbon: Record<string, unknown> | null; lc_change: Record<string, unknown> | null; results: Record<string, unknown> | null; scenes: Record<string, unknown> | null; crop: Record<string, unknown> | null; disaster: Record<string, unknown> | null };
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
  | { id: string; kind: "boundaryDownload"; name: string; downloadUrl: string; filename: string }
  | { id: string; kind: "resultCard"; card: ResultCard };
