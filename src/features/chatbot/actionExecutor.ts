import { chatbotApi } from "./api";
import { getAppValue } from "./windowBridge";
import { zoomToLocation, zoomToFeature, highlightPolygon } from "./mapActions";
import { useUiStore } from "@/hooks/useUiStore";
import type { ChatAction, QuickAction } from "./types";

/**
 * Executes AI-issued actions against the rest of the app. Ported 1:1 from
 * savegeo-chatbot.js `ActionExecutor` - same dispatch table, same DOM-id /
 * `window.*` function lookups, same defensive `typeof x === 'function'`
 * degradation when a hook another module owns doesn't exist yet (see
 * windowBridge.ts for why that's expected right now). The three action
 * types that need to add something to the on-screen chat log (`guide_step`,
 * `offer_choices`, `download_boundary_geojson`) go through `ActionRunContext`
 * callbacks instead of manual DOM appends, since the chat log is React state.
 */
export interface ActionRunContext {
  addAssistantMessage: (text: string) => void;
  addGuideStep: (step: number, total: number, title: string, body: string) => void;
  addChoiceCard: (question: string | undefined, choices: QuickAction[]) => void;
  /** feature === null means "AOI already set on map, nothing to download". */
  offerBoundaryDownload: (name: string, feature: GeoJSON.Feature | null) => void;
  setFileInputAccept: (accept: string) => void;
  /** geoai-mode: resolve a hotspot_id action field to that hotspot's geometry, from this turn's cards[]. */
  getHotspotGeometry?: (hotspotId: string) => GeoJSON.Geometry | null;
}

const MODULE_FOR_KIND: Record<string, "carbon" | "lc-change"> = {
  carbon: "carbon",
  vegetation: "carbon",
  landcover: "carbon",
  landcover_transition: "lc-change",
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setInputValue(id: string, value: unknown): boolean {
  const el = document.getElementById(id) as
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement
    | null;
  if (!el) return false;
  el.value = String(value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function setSelectValue(id: string, value: unknown): boolean {
  const el = document.getElementById(id) as HTMLSelectElement | null;
  if (!el) return false;
  if (Array.isArray(value)) {
    const set = new Set(value.map(String));
    Array.from(el.options).forEach((o) => {
      o.selected = set.has(o.value);
    });
  } else {
    el.value = String(value);
  }
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function firstExistingId(...ids: string[]): HTMLElement | null {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

function clickIfExists(id: string): void {
  (document.getElementById(id) as HTMLElement | null)?.click();
}

/** Runs a queue of actions sequentially (ask_user/explain are conversational-only, skipped). */
export async function runActions(
  actions: ChatAction[],
  ctx: ActionRunContext,
  onStep?: (action: ChatAction, index: number, total: number) => void,
): Promise<void> {
  const queue = (actions || []).filter((a) => a.type !== "ask_user" && a.type !== "explain");
  for (let i = 0; i < queue.length; i++) {
    const action = queue[i];
    onStep?.(action, i, queue.length);
    await dispatchAction(action, ctx);
    await delay(350);
  }
}

async function dispatchAction(action: ChatAction, ctx: ActionRunContext): Promise<void> {
  switch (action.type) {
    case "switch_module":
      return switchModule(action.module, ctx);
    case "set_value":
      return void setValue(action.target, action.value);
    case "run_analysis":
      return runAnalysis(action.analysis);
    case "show_result_layer":
      return void showResultLayer(action.layer);
    case "download_report":
      return void downloadReport(action.report);
    case "fly_to":
      return flyTo(action);
    case "set_aoi_geocode":
      return setAoiGeocode(action);
    case "guide_step":
      return void ctx.addGuideStep(action.step || 1, action.total || 1, action.title || "", action.body || "");
    case "highlight_ui":
      return void highlightUi(action.element_id);
    case "request_file_aoi":
      return void ctx.setFileInputAccept(".geojson,.json,.kml");
    case "open_draw_tool":
      return void openDrawTool();
    case "offer_choices":
      return void (action.choices?.length && ctx.addChoiceCard(action.question, action.choices));
    case "download_boundary_geojson":
      return downloadBoundaryGeoJSON(action, ctx);
    case "zoom_to_location":
      return void (action.lat != null && action.lng != null && zoomToLocation(action.lat, action.lng, action.zoom || 13));
    case "zoom_to_feature":
      return void (action.geometry && zoomToFeature(action.geometry));
    case "highlight_polygon":
      return void (action.geometry && highlightPolygon(action.geometry, { label: action.label }));
    case "highlight_hotspot":
    case "show_before_after": {
      const geom = action.hotspot_id ? ctx.getHotspotGeometry?.(action.hotspot_id) : null;
      return void (geom && highlightPolygon(geom));
    }
    case "open_analysis_result": {
      const target = action.kind ? MODULE_FOR_KIND[action.kind] : null;
      return void (target && useUiStore.getState().setActiveModule(target));
    }
    default:
      return;
  }
}

function switchModule(moduleName: string | undefined, _ctx: ActionRunContext): Promise<void> {
  const MAP: Record<string, string> = {
    carbon: "carbon",
    landcover: "carbon",
    lc_change: "lc-change",
    disaster: "disaster",
    details: "details",
    about: "about",
    guide: "guide",
  };
  const target = (moduleName && MAP[moduleName]) || moduleName || "";
  const switchFn = getAppValue("switchModule");
  if (typeof switchFn === "function") {
    switchFn(target);
  } else {
    clickIfExists("menu-" + target);
  }

  if (moduleName === "landcover") {
    return delay(350).then(() => {
      setSelectValue("analysisType", "landcover");
    });
  }
  return delay(350);
}

function setValue(target: string | undefined, value: ChatAction["value"]): void {
  switch (target) {
    case "year": {
      const sl = document.getElementById("yearSlider") as HTMLInputElement | null;
      const sp = document.getElementById("yearValue");
      if (sl) {
        sl.value = String(value);
        sl.dispatchEvent(new Event("input", { bubbles: true }));
        sl.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (sp) sp.textContent = String(value);
      break;
    }
    case "start_month":
      setInputValue(firstExistingId("startMonth", "carbonStartMonth", "lcStartMonth")?.id || "", value);
      break;
    case "end_month":
      setInputValue(firstExistingId("endMonth", "carbonEndMonth", "lcEndMonth")?.id || "", value);
      break;
    case "cloud_threshold":
      setInputValue(firstExistingId("cloudSlider", "carbonCloudSlider")?.id || "", value);
      break;
    case "carbon_reference_dataset":
      setInputValue("carbonReferenceDataset", value);
      break;
    case "carbon_dataset_year":
      setInputValue("carbonDatasetYear", value);
      break;
    case "carbon_model":
      setInputValue("carbonModelSelect", value);
      break;
    case "carbon_scale":
      setInputValue("carbonScale", value);
      break;
    case "carbon_clip_mode":
      document.querySelectorAll<HTMLInputElement>('input[name="carbonClipMode"]').forEach((r) => {
        if (r.value === value) r.click();
      });
      break;
    case "enable_carbon_delta": {
      const chk = document.getElementById("enableCarbonDelta") as HTMLInputElement | null;
      if (chk && chk.checked !== !!value) chk.click();
      break;
    }
    case "carbon_delta_start_year":
      setInputValue("carbonDeltaStartYear", value);
      break;
    case "carbon_delta_end_year":
      setInputValue("carbonDeltaEndYear", value);
      break;
    case "carbon_delta_interval":
      setInputValue("carbonDeltaInterval", value);
      break;
    case "landcover_datasets":
    case "landcover_dataset":
      setSelectValue("landcoverDatasetSelect", value);
      break;
    case "transition_dataset":
      setInputValue("transitionDataset", value);
      break;
    case "transition_start_year":
      setInputValue("transitionStartYear", value);
      break;
    case "transition_end_year":
      setInputValue("transitionEndYear", value);
      break;
    case "vegetation_indices": {
      const vals = (Array.isArray(value) ? value : [value]).map((v) => String(v).toUpperCase());
      document.querySelectorAll<HTMLElement>(".index-badge").forEach((badge) => {
        const idx = badge.getAttribute("data-index") || "";
        const want = vals.includes(idx.toUpperCase());
        const has = badge.classList.contains("active");
        if (want !== has) badge.click();
      });
      break;
    }
    case "province":
      setSelectValue("provinceSelect", value);
      break;
    case "city":
      setSelectValue("citySelect", value);
      break;
    case "district":
      setSelectValue("districtSelect", value);
      break;
    case "village":
      setSelectValue("villageSelect", value);
      break;
  }
}

function waitForAnalysisDone(): Promise<void> {
  return new Promise((resolve) => {
    let fired = false;
    const fallback = setTimeout(() => {
      if (!fired) {
        fired = true;
        window._onSaveGeoAnalysisDone = null;
        resolve();
      }
    }, 180_000);
    window._onSaveGeoAnalysisDone = () => {
      if (!fired) {
        fired = true;
        clearTimeout(fallback);
        window._onSaveGeoAnalysisDone = null;
        setTimeout(resolve, 300);
      }
    };
  });
}

async function runAnalysis(analysis: string | undefined): Promise<void> {
  const donePromise = waitForAnalysisDone();

  switch (analysis) {
    case "carbon":
      setSelectValue("analysisType", "carbon");
      setTimeout(() => clickIfExists("runAnalysis"), 200);
      break;
    case "carbon_delta": {
      const chk = document.getElementById("enableCarbonDelta") as HTMLInputElement | null;
      if (chk && !chk.checked) chk.click();
      setTimeout(() => {
        setSelectValue("analysisType", "carbon");
        setTimeout(() => clickIfExists("runAnalysis"), 200);
      }, 350);
      break;
    }
    case "landcover":
      setSelectValue("analysisType", "landcover");
      setTimeout(() => clickIfExists("runAnalysis"), 200);
      break;
    case "vegetation":
      setSelectValue("analysisType", "vegetation");
      setTimeout(() => clickIfExists("runAnalysis"), 200);
      break;
    case "complete":
      setSelectValue("analysisType", "combined");
      setTimeout(() => clickIfExists("runAnalysis"), 200);
      break;
    case "landcover_transition":
    case "landcover_change_map": {
      const lcBtn =
        firstExistingId("runLcTransition", "runTransitionAnalysis") ||
        document.querySelector<HTMLElement>(
          '#module-lc-change .btn-primary[id*="run"], #module-lc-change .btn-success[id*="run"]',
        );
      if (lcBtn) lcBtn.click();
      else getAppValue("LCChange")?.runAnalysis?.();
      break;
    }
    default:
      clickIfExists("runAnalysis");
  }

  await donePromise;
}

function showResultLayer(layer: string | undefined): void {
  const fn = getAppValue("switchResultLayer");
  if (typeof fn === "function" && layer) {
    try {
      fn(layer);
    } catch (e) {
      console.warn("SaveGeoChatbot: switchResultLayer failed", e);
    }
  }
}

function downloadReport(report: string | undefined): void {
  switch (report) {
    case "executive_summary": {
      const fn = getAppValue("downloadExecutiveSummary");
      if (typeof fn === "function") fn();
      else clickIfExists("exportExecSummary");
      break;
    }
    case "statistics_json": {
      const fn = getAppValue("downloadStatistics");
      if (typeof fn === "function") fn();
      else clickIfExists("downloadStats");
      break;
    }
    case "geotiff": {
      const fn = getAppValue("exportToGoogleDrive");
      if (typeof fn === "function") fn();
      else clickIfExists("exportGeoTIFF");
      break;
    }
  }
}

function doFly(lat: number, lng: number, zoom: number | null, bbox: number[] | null): void {
  const fn = getAppValue("flyToLocation");
  if (typeof fn === "function") {
    fn(lat, lng, zoom ?? undefined, bbox);
    return;
  }
  const map = getAppValue("map");
  if (!map) return;
  if (bbox) {
    map.fitBounds(
      [
        [bbox[1], bbox[0]],
        [bbox[3], bbox[2]],
      ],
      { padding: [30, 30] },
    );
  } else {
    map.flyTo([lat, lng], zoom || 12, { duration: 1.5 });
  }
}

async function flyTo(action: ChatAction): Promise<void> {
  if (action.lat && action.lng) {
    doFly(action.lat, action.lng, action.zoom || 12, null);
    return;
  }
  if (action.query) {
    const d = await chatbotApi.geocode(action.query);
    if (d && d.lat) doFly(d.lat, d.lng, 12, d.bbox);
  }
}

function bboxToFeature(bbox: [number, number, number, number], name: string): GeoJSON.Feature {
  const [w, s, e, n] = bbox;
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [w, s],
          [e, s],
          [e, n],
          [w, n],
          [w, s],
        ],
      ],
    },
    properties: { name },
  };
}

async function setAoiGeocode(action: ChatAction): Promise<void> {
  const query = action.query || "";
  const d = await chatbotApi.geocode(query);
  if (!d || !d.lat) return;

  const ai = d.address_info || { country_code: "", province: "", city: "", district: "", village: "" };
  const isID = ai.country_code === "id";
  const setAOIByAdminName = getAppValue("setAOIByAdminName");
  const setAOIFromGeoJSON = getAppValue("setAOIFromGeoJSON");
  const flyToLocation = getAppValue("flyToLocation");

  if (isID && ai.province && typeof setAOIByAdminName === "function") {
    const ok = await setAOIByAdminName(ai.province, ai.city || "", ai.district || "", ai.village || "");
    if (!ok && d.bbox && typeof setAOIFromGeoJSON === "function") {
      setAOIFromGeoJSON(bboxToFeature(d.bbox, d.display_name || query), d.display_name || query);
    }
    return;
  }

  if (d.bbox && typeof setAOIFromGeoJSON === "function") {
    setAOIFromGeoJSON(bboxToFeature(d.bbox, d.display_name || query), d.display_name || query);
  } else if (typeof flyToLocation === "function") {
    flyToLocation(d.lat, d.lng, 12, d.bbox);
  }
}

function highlightUi(elementId: string | undefined): void {
  const el = elementId ? document.getElementById(elementId) : null;
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("sgc-highlight-pulse");
  setTimeout(() => el.classList.remove("sgc-highlight-pulse"), 3500);
}

function openDrawTool(): void {
  const btn =
    document.getElementById("drawAOI") ||
    document.querySelector<HTMLElement>('[data-action="draw-aoi"]') ||
    document.querySelector<HTMLElement>(".leaflet-draw-draw-polygon") ||
    document.querySelector<HTMLElement>(".draw-polygon-btn");
  btn?.click();
}

async function downloadBoundaryGeoJSON(action: ChatAction, ctx: ActionRunContext): Promise<void> {
  const query = action.query || "";
  const d = await chatbotApi.geocode(query);
  if (!d || !d.lat) {
    ctx.addAssistantMessage(`Lokasi "${query}" tidak ditemukan.`);
    return;
  }

  const ai = d.address_info || { country_code: "", province: "", city: "", district: "", village: "" };
  const isID = ai.country_code === "id";
  const setAOIByAdminName = getAppValue("setAOIByAdminName");
  const setAOIFromGeoJSON = getAppValue("setAOIFromGeoJSON");

  if (isID && ai.province && typeof setAOIByAdminName === "function") {
    await setAOIByAdminName(ai.province, ai.city || "", ai.district || "", "");
    // AOI now set via admin dropdown - offer download of whatever the app exposes as the current AOI.
    const currentAOI = getAppValue("currentAOI");
    let feature: GeoJSON.Feature | null = null;
    if (currentAOI && currentAOI.geojson) {
      const g = currentAOI.geojson;
      feature = (g.type === "FeatureCollection" ? g.features[0] : (g as GeoJSON.Feature)) ?? null;
    }
    ctx.offerBoundaryDownload(query, feature);
    return;
  }

  if (d.bbox) {
    const feature = bboxToFeature(d.bbox, d.display_name || query);
    if (typeof setAOIFromGeoJSON === "function") setAOIFromGeoJSON(feature, d.display_name || query);
    ctx.offerBoundaryDownload(query, feature);
    return;
  }

  ctx.addAssistantMessage(`Tidak dapat mengambil batas wilayah untuk "${query}".`);
}
