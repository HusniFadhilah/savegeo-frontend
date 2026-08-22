/**
 * Bridge to the rest of the SaveGeo app.
 *
 * The legacy vanilla-JS chatbot (frontend-nextjs2/public/savegeo-chatbot.js)
 * read shared classic-script globals (`currentAOI`, `map`, `L`, `window.
 * switchModule`, `window.setAOIFromGeoJSON`, ...) directly, and always
 * guarded every call with `typeof window.X === 'function'` so the widget
 * degraded gracefully instead of throwing when a given module hadn't wired
 * that hook up yet.
 *
 * This Vite/React rewrite has NO such globals yet - map state lives in local
 * component state (see components/map/AoiDrawingTools.tsx), and there is no
 * `window.currentAOI`/`window.map`/`window.switchModule` etc. anywhere in the
 * app. Per the migration notes (frontend-nextjs2/MIGRATION.md, "Known
 * follow-ups") this is an accepted, expected gap: the same defensive
 * typeof-checked bridge is kept here so that as soon as another module
 * exposes these globals (or a future integration pass wires them up), the
 * chatbot's map/AOI/analysis actions start working with zero changes to this
 * file. Until then, those specific actions silently no-op.
 */

import L from "leaflet";
import { useUiStore } from "@/hooks/useUiStore";
import type { GeoAiContext } from "./types";

/** Minimal structural subset of a Leaflet map/tileLayer, enough for addMapLayer/flyTo fallbacks. */
interface LeafletLikeMap {
  flyTo: (latlng: [number, number], zoom?: number, opts?: Record<string, unknown>) => void;
  fitBounds: (bounds: unknown, opts?: Record<string, unknown>) => void;
}
interface LeafletLikeNamespace {
  tileLayer: (
    url: string,
    opts?: Record<string, unknown>,
  ) => { addTo: (map: LeafletLikeMap) => unknown };
}

/** Mirrored by LcChangeModule.tsx - that module has its own AOI/results, separate
 * from CarbonModule's `window.currentAOI`/`window.analysisResults` (see
 * buildGeoAiContext() below for why the SaveGeo Assistant needs both). */
interface LcChangeBridgeState {
  aoi: GeoJSON.GeoJSON | null;
  dataset: string | null;
  from_year: number | null;
  to_year: number | null;
  transition: {
    dataset: string | null;
    from_year: number | null;
    to_year: number | null;
    gains: Record<string, number>;
    losses: Record<string, number>;
    matrix: Record<string, Record<string, number>>;
  } | null;
}

declare global {
  interface Window {
    switchModule?: (module: string) => void;
    switchResultLayer?: (layer: string) => void;
    downloadExecutiveSummary?: () => void;
    downloadStatistics?: () => void;
    exportToGoogleDrive?: () => void;
    flyToLocation?: (lat: number, lng: number, zoom?: number, bbox?: number[] | null) => void;
    setAOIByAdminName?: (
      province: string,
      city: string,
      district: string,
      village: string,
    ) => Promise<boolean>;
    setAOIFromGeoJSON?: (feature: GeoJSON.GeoJSON, name?: string) => void;
    loadGeoJSONAsAOI?: (feature: GeoJSON.GeoJSON) => void;
    LCChange?: { runAnalysis?: () => void };
    currentAOI?: { geojson?: GeoJSON.GeoJSON; name?: string; areaKm2?: number | null } | null;
    lcChangeState?: LcChangeBridgeState | null;
    drawnItems?: { toGeoJSON: () => GeoJSON.FeatureCollection } | null;
    map?: LeafletLikeMap | null;
    L?: LeafletLikeNamespace;
    geeTileLayers?: Record<string, unknown>;
    activeResultLayerName?: string;
    analysisResults?: Record<string, unknown>;
    API_BASE_URL?: string;
    config?: { api?: { baseUrl?: string } };
    _onSaveGeoAnalysisDone?: (() => void) | null;
    $?: (el: unknown) => { trigger: (...args: unknown[]) => unknown; val: (v?: unknown) => unknown };
  }
}

/** Typed, safe accessor for the optional globals described above. */
export function getAppValue<K extends keyof Window>(name: K): Window[K] | undefined {
  try {
    return window[name];
  } catch {
    return undefined;
  }
}

/** Context adapter - reads active AOI / current year from shared globals or DOM, defensively. */
export const SaveGeoContext = {
  getActiveAOI(): GeoJSON.GeoJSON | null {
    const aoi = getAppValue("currentAOI");
    if (aoi && aoi.geojson) return aoi.geojson;
    const drawn = getAppValue("drawnItems");
    if (drawn && typeof drawn.toGeoJSON === "function") {
      const fc = drawn.toGeoJSON();
      if (fc && fc.features && fc.features.length > 0) return fc;
    }
    return null;
  },
  getActiveAOIName(): string | null {
    const aoi = getAppValue("currentAOI");
    return (aoi && aoi.name) || null;
  },
  getCurrentYear(): number {
    const sp = document.getElementById("yearValue");
    if (sp && sp.textContent?.trim()) {
      const v = parseInt(sp.textContent.trim(), 10);
      if (!isNaN(v)) return v;
    }
    const sl = document.getElementById("yearSlider") as HTMLInputElement | null;
    if (sl && sl.value) {
      const s = parseInt(sl.value, 10);
      if (!isNaN(s)) return s;
    }
    return new Date().getFullYear();
  },
  addMapLayer(layer: { url?: string; tile_url?: string; name?: string; opacity?: number }): boolean {
    const m = getAppValue("map");
    const Lf = getAppValue("L");
    if (!m || !Lf) return false;
    try {
      const url = layer.url || layer.tile_url;
      if (!url) return false;
      const name = layer.name || `chatbot_layer_${Date.now()}`;
      const tl = Lf.tileLayer(url, { opacity: layer.opacity != null ? layer.opacity : 0.8, maxZoom: 20 });
      tl.addTo(m);
      const layers = getAppValue("geeTileLayers");
      if (layers) layers[name] = tl;
      return true;
    } catch (e) {
      console.warn("SaveGeoChatbot: addMapLayer failed", e);
    }
    return false;
  },
};

function optionValues(id: string): string[] {
  const el = document.getElementById(id) as HTMLSelectElement | null;
  if (!el || !el.options) return [];
  return Array.from(el.options)
    .map((o) => o.value)
    .filter(Boolean);
}

/** Collects a page-state snapshot sent alongside every chat message, for AI context. */
export function getPageState() {
  const ar = getAppValue("analysisResults") || {};
  const currentModule = useUiStore.getState().activeModule.replace("-", "_");

  const carbonData = (ar.carbon as Record<string, unknown>) || {};
  const hasCarbon = !!(carbonData.carbon_estimated || carbonData.tile_url);
  const landcoverData = (ar.landcover as Record<string, unknown>) || {};
  const hasLandcover = !!(ar.landcover && Object.keys(landcoverData).length > 0);
  const vegData = (ar.vegetation as Record<string, unknown>) || {};
  const hasVegetation = !!ar.vegetation;
  const hasTransition = !!ar.landcover_transition;

  const carbonStats =
    (carbonData.statistics as Record<string, unknown>) || (carbonData.stats as Record<string, unknown>) || {};
  const vegStats =
    (vegData.statistics as Record<string, unknown>) || (vegData.stats as Record<string, unknown>) || {};

  return {
    current_module: currentModule,
    has_aoi: !!SaveGeoContext.getActiveAOI(),
    aoi_name: SaveGeoContext.getActiveAOIName(),
    selected_year: SaveGeoContext.getCurrentYear(),
    selected_carbon_dataset:
      (document.getElementById("carbonReferenceDataset") as HTMLSelectElement | null)?.value || null,
    selected_carbon_model:
      (document.getElementById("carbonModelSelect") as HTMLSelectElement | null)?.value || null,
    available_carbon_datasets: optionValues("carbonReferenceDataset"),
    available_carbon_models: optionValues("carbonModelSelect"),
    available_landcover_datasets: optionValues("landcoverDatasetSelect"),
    analysis_results: {
      carbon: hasCarbon,
      landcover: hasLandcover,
      vegetation: hasVegetation,
      transition: hasTransition,
      carbon_data: hasCarbon
        ? {
            carbon_estimated: carbonData.carbon_estimated ?? null,
            total_carbon: carbonData.total_carbon ?? null,
            carbon_unit: carbonData.carbon_unit ?? carbonData.unit ?? null,
            area_ha: carbonData.area_ha ?? null,
            model_r2: carbonData.model_r2 ?? null,
            target_pool: carbonData.target_pool ?? null,
            dataset_name: carbonData.dataset_name ?? carbonData.reference_dataset ?? null,
            statistics: Object.keys(carbonStats).length ? carbonStats : null,
          }
        : null,
      vegetation_data: hasVegetation
        ? {
            indices:
              vegData.indices ||
              Object.keys(vegData).filter((k) => k !== "tile_url" && k !== "statistics"),
            statistics: Object.keys(vegStats).length ? vegStats : null,
          }
        : null,
    },
  };
}

function bboxOfGeoJSON(geo: GeoJSON.GeoJSON): [number, number, number, number] | null {
  try {
    const bounds = L.geoJSON(geo).getBounds();
    if (!bounds.isValid()) return null;
    return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
  } catch {
    return null;
  }
}

/**
 * Richer grounding context for the SaveGeo Assistant (mode="geoai") - the
 * actual AOI geometry and already-computed analysis results, not just
 * booleans (contrast with the legacy getPageState() above). Merges state
 * from both CarbonModule (`window.currentAOI`/`window.analysisResults`) and
 * LcChangeModule (`window.lcChangeState`) since DashboardPage keeps every
 * visited module mounted (see DashboardPage.tsx) - a user can be looking at
 * LC-Change while an earlier Carbon run is still valid grounding data, so
 * results are merged rather than switched on the active module; only the
 * AOI (needed for live hotspot search geometry) prefers whichever module is
 * currently in front of the user.
 */
export function buildGeoAiContext(): GeoAiContext {
  const activeModule = useUiStore.getState().activeModule;
  const carbonAoi = getAppValue("currentAOI") || null;
  const lcState = getAppValue("lcChangeState") || null;

  const preferLc = activeModule === "lc-change" && !!lcState?.aoi;
  const aoi = preferLc ? lcState!.aoi : carbonAoi?.geojson || lcState?.aoi || null;
  const aoiName = preferLc ? "AOI (LC-Change)" : carbonAoi?.name || null;
  const areaKm2 = !preferLc ? carbonAoi?.areaKm2 ?? null : null;

  const ar = getAppValue("analysisResults") || {};
  const period = preferLc && lcState?.from_year && lcState?.to_year
    ? `${lcState.from_year}-${lcState.to_year}`
    : String(SaveGeoContext.getCurrentYear());

  return {
    aoi,
    aoi_name: aoiName,
    area_ha: areaKm2 != null ? Math.round(areaKm2 * 100 * 100) / 100 : null,
    bbox: aoi ? bboxOfGeoJSON(aoi) : null,
    current_module: activeModule.replace("-", "_"),
    period,
    selected_year: SaveGeoContext.getCurrentYear(),
    active_layer: getAppValue("activeResultLayerName") || null,
    selected_feature: null, // no feature-selection concept wired in the app yet - honestly null, not fabricated
    landcover_dataset: lcState?.dataset || null,
    results: {
      carbon: (ar.carbon as Record<string, unknown>) || null,
      vegetation: (ar.vegetation as Record<string, unknown>) || null,
      landcover: (ar.landcover as Record<string, unknown>) || null,
      landcover_transition: lcState?.transition || null,
    },
  };
}

/**
 * Dynamically imports html2canvas (npm dependency, code-split so it's not in
 * the main bundle) and captures the #map element (falls back to the first
 * `.savegeo-map` element if no #map id exists yet - module wiring for map
 * container ids is still in progress in parallel). Cross-origin basemap
 * tiles may render blank (useCORS mitigates same-origin/CORS-enabled tiles);
 * AOI/analysis SVG overlays capture correctly.
 */
export async function captureMapScreenshot(): Promise<string> {
  const mapEl =
    document.getElementById("map") || document.querySelector<HTMLElement>(".savegeo-map");
  if (!mapEl) throw new Error("Elemen peta tidak ditemukan.");

  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(mapEl, {
    allowTaint: true,
    useCORS: true,
    logging: false,
    scale: window.devicePixelRatio || 1,
  });
  const dataUrl = canvas.toDataURL("image/png");
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}
