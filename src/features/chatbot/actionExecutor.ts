import { zoomToLocation, zoomToFeature, highlightPolygon } from "./mapActions";
import type { DashboardModule } from "@/hooks/useUiStore";
import type { ChatAction, QuickAction } from "./types";
import { AoiChoiceRequired } from "./aoiCommands";
import { executeUiCommand } from "./uiCommandBus";
import { openDashboardModule } from "./navigation";

/**
 * Runs the actions the assistant returns. Two kinds are accepted, both from a
 * fixed allowlist - anything else is rejected, never guessed at:
 *  - typed UI commands (`action` + `target`) -> `executeUiCommand`, handled by the
 *    React module that owns the state;
 *  - a few grounded map/result actions (`type`) -> `mapActions` / navigation.
 * The assistant never supplies a DOM selector, URL or callback.
 */
export interface ActionRunContext {
  addAssistantMessage: (text: string) => void;
  addGuideStep: (step: number, total: number, title: string, body: string) => void;
  addChoiceCard: (question: string | undefined, choices: QuickAction[]) => void;
  setFileInputAccept: (accept: string) => void;
  /** geoai-mode: resolve a hotspot_id action field to that hotspot's geometry, from this turn's cards[]. */
  getHotspotGeometry?: (hotspotId: string) => GeoJSON.Geometry | null;
}

const MODULE_FOR_KIND: Record<string, DashboardModule> = {
  carbon: "carbon",
  vegetation: "carbon",
  landcover: "carbon",
  landcover_transition: "lc-change",
};

/** Legacy `type` values that are accepted (conversation cards and grounded map/result actions). */
export const SUPPORTED_ACTION_TYPES: ReadonlySet<string> = new Set([
  "ask_user",
  "explain",
  "guide_step",
  "request_file_aoi",
  "offer_choices",
  "zoom_to_location",
  "zoom_to_feature",
  "highlight_polygon",
  "highlight_hotspot",
  "show_before_after",
  "open_analysis_result",
]);

/**
 * Runs a queue of actions sequentially (ask_user/explain are conversational-only,
 * skipped). Each action completes - including its state read-back - before the
 * next starts, so later steps always see the committed result of earlier ones.
 */
export async function runActions(
  actions: ChatAction[],
  ctx: ActionRunContext,
  onStep?: (action: ChatAction, index: number, total: number) => void,
): Promise<void> {
  const queue = (actions || []).filter((a) => a.type !== "ask_user" && a.type !== "explain");
  for (let i = 0; i < queue.length; i++) {
    const action = queue[i];
    onStep?.(action, i, queue.length);
    try {
      await dispatchAction(action, ctx);
    } catch (error) {
      if (error instanceof AoiChoiceRequired) {
        Object.assign(error, { remainingActions: queue.slice(i + 1) });
        throw error;
      }
      const reason = error instanceof Error ? error.message : "Kesalahan tidak diketahui.";
      ctx.addAssistantMessage(`Tindakan ${action.action || action.type || "UI"} gagal: ${reason}`);
      throw error;
    }
  }
}

async function dispatchAction(action: ChatAction, ctx: ActionRunContext): Promise<void> {
  if (action.action) {
    await executeUiCommand({
      action: action.action,
      target: action.target || "",
      parameters: action.parameters,
      reason: action.reason,
      expected_state: action.expected_state,
    });
    return;
  }
  switch (action.type) {
    case "guide_step":
      return ctx.addGuideStep(action.step || 1, action.total || 1, action.title || "", action.body || "");
    case "request_file_aoi":
      return ctx.setFileInputAccept(".geojson,.json,.kml");
    case "offer_choices":
      if (action.choices?.length) ctx.addChoiceCard(action.question, action.choices);
      return;
    case "zoom_to_location":
      if (action.lat != null && action.lng != null) {
        zoomToLocation(action.lat, action.lng, action.zoom || 13);
      }
      return;
    case "zoom_to_feature":
      if (action.geometry) zoomToFeature(action.geometry);
      return;
    case "highlight_polygon":
      if (action.geometry) highlightPolygon(action.geometry, { label: action.label });
      return;
    case "highlight_hotspot":
    case "show_before_after": {
      const geometry = action.hotspot_id ? ctx.getHotspotGeometry?.(action.hotspot_id) : null;
      if (geometry) highlightPolygon(geometry);
      return;
    }
    case "open_analysis_result": {
      const target = action.kind ? MODULE_FOR_KIND[action.kind] : undefined;
      if (target) openDashboardModule(target);
      return;
    }
    default:
      throw new Error(`Jenis tindakan tidak didukung: ${String(action.type ?? "tanpa jenis")}`);
  }
}
