import L from "leaflet";
import { useAnalysisJobStore } from "@/services/analysisJobStore";
import { useUiStore } from "@/hooks/useUiStore";
import { useAoiStore } from "@/hooks/useAoiStore";
import type { GeoAiContext } from "./types";
import { readUiCommandState } from "./uiCommandBus";
import { getActiveMap } from "./mapActions";
import { useChatContextStore } from "./chatContextStore";

/**
 * Page/AOI/result context sent with every chat message. Reads typed state only:
 * `useAoiStore` (AOI), `useChatContextStore` (module results), the UI-command
 * registry (`readUiCommandState`) and the active map. No `window.*` globals.
 */
export const SaveGeoContext = {
  getActiveAOI(): GeoJSON.GeoJSON | null {
    return useAoiStore.getState().aoi?.feature ?? null;
  },
  getActiveAOIName(): string | null {
    return useAoiStore.getState().aoi?.name || null;
  },
  getCurrentYear(): number {
    const year = readUiCommandState("carbon")?.analysisYear;
    return typeof year === "number" && Number.isFinite(year) ? year : new Date().getFullYear();
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
  const ar = useChatContextStore.getState().analysisResults;
  const currentModule = useUiStore.getState().activeModule.replace("-", "_");

  const carbonData = (ar.carbon as Record<string, unknown>) || {};
  const hasCarbon = !!(carbonData.carbon_estimated || carbonData.tile_url);
  const landcoverData = (ar.landcover as Record<string, unknown>) || {};
  const hasLandcover = !!(ar.landcover && Object.keys(landcoverData).length > 0);
  const vegData = (ar.vegetation as Record<string, unknown>) || {};
  const hasVegetation = !!ar.vegetation;
  const hasTransition = !!ar.landcover_transition;

  const carbonStats =
    (carbonData.statistics as Record<string, unknown>) ||
    (carbonData.stats as Record<string, unknown>) ||
    {};
  const vegStats =
    (vegData.statistics as Record<string, unknown>) ||
    (vegData.stats as Record<string, unknown>) ||
    {};
  const carbonUi = readUiCommandState("carbon");
  const changeUi = readUiCommandState("lc_change");
  const resultsUi = readUiCommandState("results");
  const scenesUi = readUiCommandState("scenes");
  const cropUi = readUiCommandState("crop");
  const disasterUi = readUiCommandState("disaster");
  const cropSummaryUi = cropUi
    ? Object.fromEntries(Object.entries(cropUi).filter(([key]) => key !== "result"))
    : null;
  const disasterSummaryUi = disasterUi
    ? Object.fromEntries(Object.entries(disasterUi).filter(([key]) => key !== "result"))
    : null;
  const map = getActiveMap();
  const center = map?.getCenter();

  return {
    route: window.location.pathname,
    jobs: useAnalysisJobStore.getState().jobs,
    current_module: currentModule,
    map: {
      center: center ? [center.lat, center.lng] : null,
      zoom: map?.getZoom() ?? null,
    },
    ui: {
      carbon: carbonUi,
      lc_change: changeUi,
      results: resultsUi,
      scenes: scenesUi,
      crop: cropSummaryUi,
      disaster: disasterSummaryUi,
    },
    has_aoi: !!SaveGeoContext.getActiveAOI(),
    aoi_name: SaveGeoContext.getActiveAOIName(),
    selected_year:
      typeof carbonUi?.analysisYear === "number"
        ? carbonUi.analysisYear
        : SaveGeoContext.getCurrentYear(),
    selected_carbon_dataset:
      (typeof carbonUi?.referenceDataset === "string" ? carbonUi.referenceDataset : null) ||
      (document.getElementById("carbonReferenceDataset") as HTMLSelectElement | null)?.value ||
      null,
    selected_carbon_model:
      (document.getElementById("carbonModelSelect") as HTMLSelectElement | null)?.value || null,
    available_carbon_datasets: optionValues("carbonReferenceDataset"),
    available_carbon_models: optionValues("carbonModelSelect"),
    available_landcover_datasets: Array.isArray(changeUi?.availableDatasets)
      ? (changeUi.availableDatasets as string[])
      : optionValues("landcoverDatasetSelect"),
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
 * from both CarbonModule (`useChatContextStore.analysisResults`) and
 * LcChangeModule (`useChatContextStore.lcChange`) since DashboardPage keeps every
 * visited module mounted (see DashboardPage.tsx) - a user can be looking at
 * LC-Change while an earlier Carbon run is still valid grounding data, so
 * results are merged rather than switched on the active module; only the
 * AOI (needed for live hotspot search geometry) prefers whichever module is
 * currently in front of the user.
 */
export function buildGeoAiContext(): GeoAiContext {
  const activeModule = useUiStore.getState().activeModule;
  const lcState = useChatContextStore.getState().lcChange;
  const sharedAoi = useAoiStore.getState().aoi;

  const preferLc = activeModule === "lc-change" && !!lcState?.aoi;
  const aoi = sharedAoi?.feature || lcState?.aoi || null;
  const aoiName = sharedAoi?.name || (preferLc ? "AOI (LC-Change)" : null);
  const areaKm2 = sharedAoi?.areaKm2 ?? null;

  const ar = useChatContextStore.getState().analysisResults;
  const disasterResult = readUiCommandState("disaster")?.result as
    Record<string, unknown> | undefined;
  const resultsUi = readUiCommandState("results");
  const period =
    preferLc && lcState?.from_year && lcState?.to_year
      ? `${lcState.from_year}-${lcState.to_year}`
      : String(SaveGeoContext.getCurrentYear());

  return {
    aoi,
    aoi_name: aoiName,
    area_ha: areaKm2 != null ? Math.round(areaKm2 * 100 * 100) / 100 : null,
    bbox: aoi ? bboxOfGeoJSON(aoi) : null,
    jobs: useAnalysisJobStore.getState().jobs,
    current_module: activeModule.replace("-", "_"),
    period,
    selected_year: SaveGeoContext.getCurrentYear(),
    active_layer:
      typeof resultsUi?.activeLayer === "string" ? resultsUi.activeLayer : null,
    selected_feature: null, // no feature-selection concept wired in the app yet - honestly null, not fabricated
    landcover_dataset: lcState?.dataset || null,
    results: {
      carbon: (ar.carbon as Record<string, unknown>) || null,
      direct: (ar.direct as Array<Record<string, unknown>>) || null,
      vegetation: (ar.vegetation as Record<string, unknown>) || null,
      landcover: (ar.landcover as Record<string, unknown>) || null,
      landcover_transition: lcState?.transition || null,
      crop: (readUiCommandState("crop")?.result as Record<string, unknown>) || null,
      disaster:
        disasterResult && Object.values(disasterResult).some(Boolean) ? disasterResult : null,
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
    getActiveMap()?.getContainer() ??
    document.getElementById("map") ??
    document.querySelector<HTMLElement>(".savegeo-map");
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
