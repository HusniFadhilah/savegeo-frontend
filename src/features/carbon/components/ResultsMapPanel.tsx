import { useEffect, useMemo, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import { nativeZoomForResolution } from "@/config/mapZoom";
import MapView from "@/components/map/MapView";
import { isFiniteMapBounds, safeMapCenter } from "@/components/map/mapViewValidation";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import ResultTileLayer from "@/components/map/ResultTileLayer";
import LayerOpacityControl from "@/components/map/LayerOpacityControl";
import MapLegend from "@/components/map/MapLegend";
import ResultMapLegendControl from "@/components/map/ResultMapLegendControl";
import SwipeCompareMap, { type SwipeOrientation } from "@/components/map/SwipeCompareMap";
import { registerMap } from "@/features/chatbot/mapActions";
import { registerUiCommands } from "@/features/chatbot/uiCommandBus";
import type { AoiState } from "@/features/carbon/types";
import type { CarbonLayerResult } from "@/features/carbon/types";
import type { CarbonPoolKey, CarbonVisualizationStretch } from "@/features/carbon/types";
import type { AnalysisResultsBundle } from "@/features/reports/export";
import type { DirectReferenceLayer } from "@/features/carbon/api";
import { isLandCoverDatasetEntry } from "@/features/landcover/types";
import type { MapLegendEntry } from "@/types/map";
import { useI18nStore } from "@/hooks/useI18nStore";

interface ResultTab {
  key: string;
  label: string;
  icon: string;
  tileUrl?: string;
  resolutionM?: number;
}

function carbonQuantityLabel(layer?: CarbonLayerResult): string {
  if (layer?.quantity === "concentration" || layer?.unit === "g/kg") return "Konsentrasi SOC";
  if (layer?.target_pool === "belowground_biomass_carbon") return "Karbon BGB";
  if (layer?.target_pool === "soil_organic_carbon") return "Stok SOC";
  return "Densitas Karbon";
}

function FitResultAoi({ aoi, zoom }: { aoi: AoiState; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (isFiniteMapBounds(aoi.bounds)) map.fitBounds(aoi.bounds, { maxZoom: zoom, animate: false });
  }, [aoi.bounds, map, zoom]);
  return null;
}

interface Props {
  aoi: AoiState | null;
  zoom: number;
  results: AnalysisResultsBundle;
  visMin: number;
  visMax: number;
  visPalette: string[];
  legendBins: number;
  showReference: boolean;
  mapKey: string | number;
  analysisDate?: string;
  onCarbonVisualizationChange?: (
    target: CarbonPoolKey | "primary",
    stretch: CarbonVisualizationStretch,
  ) => Promise<void>;
}

function isCarbonPoolTab(key: string) {
  return key === "carbon_estimated" || key.startsWith("carbon_pool:");
}

function buildTabs(results: AnalysisResultsBundle, showReference: boolean): ResultTab[] {
  const tabs: ResultTab[] = [];

  if (results.vegetation) {
    if (results.vegetation.rgb_tile_url) {
      const sat = results.vegetation.satellite;
      tabs.push({
        key: "rgb",
        label: sat ? `RGB (${sat.name})` : "RGB",
        icon: "bi-image",
        tileUrl: results.vegetation.rgb_tile_url,
        resolutionM: sat?.resolution_m,
      });
    }
    for (const [index, stats] of Object.entries(results.vegetation.indices || {})) {
      tabs.push({ key: index, label: index, icon: "bi-flower21", tileUrl: stats.tile_url, resolutionM: stats.native_scale_m ?? results.vegetation.satellite?.resolution_m });
    }
  }

  if (results.landcover) {
    for (const [key, val] of Object.entries(results.landcover)) {
      if (!isLandCoverDatasetEntry(key, val)) continue;
      tabs.push({ key, label: key.replace(/_/g, " "), icon: "bi-map", tileUrl: val.tile_url, resolutionM: val.native_scale ?? (Number.parseFloat(String(val.resolution)) || undefined) });
    }
  }

  if (results.carbon) {
    const referenceOnly =
      results.carbon.model_info?.display_mode === "reference_only" ||
      results.carbon.model_info?.model_name === "reference_only" ||
      results.carbon.carbon_estimated?.inference_mode === "reference_only";

    if (!referenceOnly && results.carbon.carbon_estimated?.tile_url) {
      tabs.push({
        key: "carbon_estimated",
        label: carbonQuantityLabel(results.carbon.carbon_estimated),
        icon: "bi-tree",
        tileUrl: results.carbon.carbon_estimated.tile_url,
        resolutionM: results.carbon.model_info?.map_resolution_m ?? results.carbon.model_info?.scale,
      });
    }
    if ((referenceOnly || showReference) && results.carbon.carbon_reference?.tile_url) {
      tabs.push({
        key: "carbon_reference",
        label: "Peta Referensi Asli",
        icon: "bi-database",
        tileUrl: results.carbon.carbon_reference.tile_url,
        resolutionM: results.carbon.carbon_reference.resolution,
      });
    }
    if (results.carbon.carbon_uncertainty?.tile_url) {
      tabs.push({ key: "carbon_uncertainty", label: "BGB · standard error referensi", icon: "bi-question-circle",
        tileUrl: results.carbon.carbon_uncertainty.tile_url, resolutionM: results.carbon.carbon_reference?.resolution });
    }
  }

  const poolLabels: Record<CarbonPoolKey, string> = { agb: "AGB", bgb: "BGB", soc: "SOC", litter: "Litter / serasah", deadwood: "Deadwood / kayu mati" };
  for (const pool of ["agb", "bgb", "soc", "litter", "deadwood"] as const) {
    const result = results.carbonPools?.[pool];
    const tileUrl = result?.carbon_estimated?.tile_url ?? result?.carbon_reference?.tile_url;
    if (!result || !tileUrl) continue;
    tabs.push({
      key: `carbon_pool:${pool}`,
      label: poolLabels[pool],
      icon: pool === "soc" ? "bi-layers" : "bi-tree",
      tileUrl,
      resolutionM: result.model_info?.map_resolution_m ?? result.model_info?.scale,
    });
  }

  for (const layer of results.direct ?? []) {
    const datasetYear = layer.effective_year ?? layer.year;
    tabs.push({
      key: `direct:${layer.dataset}`,
      label: `${layer.dataset_name}${datasetYear != null ? ` · Tahun dataset ${datasetYear}` : ""}`,
      icon: layer.legend ? "bi-map" : "bi-tree",
      tileUrl: layer.tile_url ?? undefined,
      resolutionM: Number.parseFloat(String(layer.resolution)) || undefined,
    });
  }

  for (const [key, result] of Object.entries(results.carbonExtensions || {})) {
    tabs.push({ key: `carbon_extension:${key}`, label: result.carbon_reference?.name || key.toUpperCase(), icon: "bi-tree", tileUrl: result.carbon_estimated.tile_url, resolutionM: result.carbon_reference?.resolution });
  }
  return tabs;
}

function buildLegend(
  activeKey: string | null,
  results: AnalysisResultsBundle,
  visMin: number,
  visMax: number,
  visPalette: string[],
  legendBins: number,
): { title: string; entries: MapLegendEntry[]; scale?: { min: number; max: number; unit: string; colors: string[] } } {
  if (!activeKey) return { title: "", entries: [] };

  if (activeKey === "carbon_estimated" || activeKey === "carbon_reference" || activeKey === "carbon_uncertainty") {
    const layer = results.carbon?.[activeKey] as CarbonLayerResult | undefined;
    const palette = layer?.vis_params?.palette?.length ? layer.vis_params.palette : visPalette;
    const colors = buildLegendColors(palette.length ? palette : ["#440154", "#414487", "#2a788e", "#22a884", "#7ad151", "#fde725"], legendBins);
    const statsMin = Number(layer?.statistics?.min);
    const statsMax = Number(layer?.statistics?.max);
    const visParamMin = Number(layer?.vis_params?.min);
    const visParamMax = Number(layer?.vis_params?.max);
    // Labels describe the colors used by the tile. Prefer its visualization
    // range over raw statistics, which may include values outside the rendered
    // stretch (or use a different range after auto visualization).
    const legendMin = Number.isFinite(visParamMin) ? visParamMin : Number.isFinite(statsMin) ? statsMin : visMin;
    const legendMax = Number.isFinite(visParamMax) ? visParamMax : Number.isFinite(statsMax) ? statsMax : visMax;
    const safeMax = legendMax > legendMin ? legendMax : legendMin + 1;
    const n = colors.length;
    const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toString() : Number(v.toFixed(2)).toString());
    const entries = colors.map((color, i) => {
      const from = legendMin + (i * (safeMax - legendMin)) / n;
      const to = legendMin + ((i + 1) * (safeMax - legendMin)) / n;
      return {
        color,
        label: i === n - 1 ? `${fmt(from)} - ${fmt(legendMax)}` : `${fmt(from)} - ${fmt(to)}`,
      };
    });
    const unit = layer?.unit || "Mg/ha";
    return { title: `${activeKey === "carbon_uncertainty" ? "Standard error BGB referensi" : carbonQuantityLabel(layer)} (${unit})`, entries };
  }

  if (activeKey.startsWith("carbon_pool:") || activeKey.startsWith("carbon_extension:")) {
    const extension = activeKey.startsWith("carbon_extension:");
    const pool = activeKey.slice(extension ? "carbon_extension:".length : "carbon_pool:".length);
    const result = extension ? results.carbonExtensions?.[pool] : results.carbonPools?.[pool as CarbonPoolKey];
    const layer = result?.carbon_estimated?.tile_url ? result.carbon_estimated : result?.carbon_reference;
    if (!layer) return { title: "", entries: [] };
    const palette = layer.vis_params?.palette?.length ? layer.vis_params.palette : visPalette;
    const colors = buildLegendColors(palette.length ? palette : ["#440154", "#414487", "#2a788e", "#22a884", "#7ad151", "#fde725"], legendBins);
    const rawMin = Number(layer.vis_params?.min);
    const rawMax = Number(layer.vis_params?.max);
    const statsMin = Number(layer.statistics?.min);
    const statsMax = Number(layer.statistics?.max);
    const min = Number.isFinite(rawMin) ? rawMin : Number.isFinite(statsMin) ? statsMin : visMin;
    const maxValue = Number.isFinite(rawMax) ? rawMax : Number.isFinite(statsMax) ? statsMax : visMax;
    const max = maxValue > min ? maxValue : min + 1;
    const unit = layer.unit || "Mg C/ha";
    const fmt = (value: number) => (Math.abs(value) >= 100 ? Math.round(value).toString() : Number(value.toFixed(2)).toString());
    const entries = colors.map((color, index) => {
      const from = min + (index * (max - min)) / colors.length;
      const to = min + ((index + 1) * (max - min)) / colors.length;
      return { color, label: index === colors.length - 1 ? `${fmt(from)} - ${fmt(max)}` : `${fmt(from)} - ${fmt(to)}` };
    });
    return { title: `${pool.toUpperCase()} (${unit})`, entries };
  }

  if (activeKey.startsWith("direct:")) {
    const dataset = activeKey.slice("direct:".length);
    const layer = (results.direct ?? []).find((item) => item.dataset === dataset) as DirectReferenceLayer | undefined;
    const year = layer?.effective_year ?? layer?.year;
    const yearLabel = year != null ? " · Tahun dataset " + year : "";

    // Global carbon rasters contain continuous density values. Their palette
    // is a color ramp, not a set of land-cover classes.
    if (layer?.analysis_kind === "carbon") {
      const palette = layer.vis_params?.palette?.length ? layer.vis_params.palette : visPalette;
      const colors = buildLegendColors(
        palette.length ? palette : ["#440154", "#414487", "#2a788e", "#22a884", "#7ad151", "#fde725"],
        Math.min(Math.max(palette.length || legendBins, 2), 20),
      );
      const rawMin = Number(layer.vis_params?.min);
      const rawMax = Number(layer.vis_params?.max);
      const min = Number.isFinite(rawMin) ? rawMin : visMin;
      const maxCandidate = Number.isFinite(rawMax) ? rawMax : visMax;
      const max = maxCandidate > min ? maxCandidate : min + 1;
      const unit = layer.unit || "Mg C/ha";
      return {
        title: carbonQuantityLabel({ unit: layer.unit ?? undefined, target_pool: layer.target_pool ?? undefined, quantity: layer.quantity ?? undefined }) + " (" + unit + ") · " + layer.dataset_name + yearLabel,
        entries: [],
        scale: { min, max, unit, colors },
      };
    }

    if (layer?.legend) {
      return {
        title: (layer?.dataset_name || "Dataset") + yearLabel,
        entries: Object.values(layer.legend).map((item) => ({
          color: item.color || "#2e7d32",
          label: item.label || "Kelas",
        })),
      };
    }
    const palette = layer?.vis_params?.palette || [];
    return {
      title: (layer?.dataset_name || "Dataset") + (layer?.unit ? " (" + layer.unit + ")" : "") + yearLabel,
      entries: buildLegendColors(palette.length ? palette : ["#440154", "#fde725"], Math.min(Math.max(palette.length, 2), 8)).map((color, i) => ({
        color,
        label: "Nilai " + (i + 1),
      })),
    };
  }

  const lcVal = results.landcover?.[activeKey];
  if (lcVal && isLandCoverDatasetEntry(activeKey, lcVal)) {
    const entries = Object.entries(lcVal.classes)
      .sort((a, b) => (a[1].class_value || 0) - (b[1].class_value || 0))
      .map(([name, info]) => ({
        color: info.color,
        label: name.replace(/_/g, " "),
        value: `${(info.percentage ?? 0).toFixed(1)}%`,
      }));
    return { title: lcVal.dataset_name || activeKey.replace(/_/g, " "), entries };
  }

  return { title: "", entries: [] };
}

function normalizeHex(color: string) {
  const trimmed = color.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(trimmed) ? `#${trimmed}` : "#2e7d32";
}

function hexToRgb(color: string): [number, number, number] {
  const hex = normalizeHex(color).slice(1);
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;
}

function buildLegendColors(palette: string[], requestedBins: number) {
  const base = palette.map(normalizeHex);
  const bins = Math.min(Math.max(Number.isFinite(requestedBins) ? Math.round(requestedBins) : base.length, 2), 20);
  if (base.length === bins) return base;
  if (base.length === 1) return Array.from({ length: bins }, () => base[0]);

  return Array.from({ length: bins }, (_, i) => {
    const t = bins === 1 ? 0 : i / (bins - 1);
    const scaled = t * (base.length - 1);
    const left = Math.floor(scaled);
    const right = Math.min(left + 1, base.length - 1);
    const local = scaled - left;
    const a = hexToRgb(base[left]);
    const b = hexToRgb(base[right]);
    return rgbToHex([
      a[0] + (b[0] - a[0]) * local,
      a[1] + (b[1] - a[1]) * local,
      a[2] + (b[2] - a[2]) * local,
    ]);
  });
}

/**
 * Ported from main.js createResultTabs()/initializeResultMap()/
 * switchResultLayer()/updateLegend(): result layer tabs, tile map, opacity
 * slider and dynamic legend (carbon gradient or land-cover class swatches).
 */
export default function ResultsMapPanel({
  aoi,
  zoom,
  results,
  visMin,
  visMax,
  visPalette,
  legendBins,
  showReference,
  mapKey,
  analysisDate,
  onCarbonVisualizationChange,
}: Props) {
  const t = useI18nStore((state) => state.t);
  const [refreshToken, setRefreshToken] = useState(0);
  const tabs = useMemo(() => buildTabs(results, showReference), [results, showReference]);
  const [activeKey, setActiveKey] = useState<string | null>(tabs[0]?.key ?? null);
  const [opacity, setOpacity] = useState(1);

  // Swipe/compare: overlays a second layer on the same map with a draggable
  // divider (satellite RGB vs. land cover vs. carbon stock, or the same
  // layer across two separate analysis runs kept in `results`).
  const [compareOn, setCompareOn] = useState(false);
  const [compareKey, setCompareKey] = useState<string | null>(null);
  const [compareOrientation, setCompareOrientation] = useState<SwipeOrientation>("vertical");
  const [stretchMenuOpen, setStretchMenuOpen] = useState(false);
  const [stretchMode, setStretchMode] = useState<CarbonVisualizationStretch>("p2_98");
  const [stretchBusy, setStretchBusy] = useState(false);
  const [stretchError, setStretchError] = useState("");

  useEffect(() => {
    setActiveKey(tabs[0]?.key ?? null);
    setOpacity(1);
    setCompareOn(false);
    setCompareKey(null);
    setRefreshToken(0);
    setStretchMenuOpen(false);
    setStretchMode("p2_98");
    setStretchError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapKey]);

  useEffect(() => {
    setOpacity(1);
    setStretchMenuOpen(false);
    setStretchError("");
  }, [activeKey]);

  useEffect(() => {
    const mode = activeKey === "carbon_estimated"
      ? results.carbon?.model_info?.visualization_mode
      : activeKey?.startsWith("carbon_pool:")
        ? results.carbonPools?.[activeKey.slice("carbon_pool:".length) as CarbonPoolKey]?.model_info?.visualization_mode
        : undefined;
    if (mode) setStretchMode(mode);
    else if (isCarbonPoolTab(activeKey ?? "")) setStretchMode("p2_98");
  }, [activeKey, results.carbon, results.carbonPools]);

  useEffect(() => registerUiCommands("results", {
    read: () => ({ activeLayer: activeKey, availableLayers: tabs.map((tab) => tab.key), visible: activeKey !== null }),
    execute: ({ action, target, parameters }) => {
      if (action !== "toggle_layer" || target !== "results.layer") throw new Error("Perintah layer tidak dikenal.");
      const visible = parameters?.visible;
      const value = parameters?.value;
      if (typeof visible !== "boolean") throw new Error("Visibilitas layer harus true atau false.");
      if (!visible) {
        setCompareOn(false);
        setActiveKey(null);
        return;
      }
      if (typeof value !== "string" || !tabs.some((tab) => tab.key === value)) throw new Error("Layer hasil belum tersedia.");
      setActiveKey(value);
    },
  }), [activeKey, tabs]);

  const activeTab = tabs.find((t) => t.key === activeKey) ?? null;
  const legend = buildLegend(activeKey, results, visMin, visMax, visPalette, legendBins);
  const stretchTarget: CarbonPoolKey | "primary" | null = activeKey?.startsWith("carbon_pool:")
    ? activeKey.slice("carbon_pool:".length) as CarbonPoolKey
    : activeKey === "carbon_estimated" ? "primary" : null;
  const canAdjustStretch = Boolean(stretchTarget && onCarbonVisualizationChange);
  const center: [number, number] = aoi?.bounds && isFiniteMapBounds(aoi.bounds)
    ? [aoi.bounds.getCenter().lat, aoi.bounds.getCenter().lng]
    : [-2.5, 118];
  const safeCenter = safeMapCenter(center, [-2.5, 118]);

  const compareTabs = useMemo(() => tabs.filter((t) => t.key !== activeKey), [tabs, activeKey]);
  useEffect(() => {
    if (!compareOn) return;
    if (compareKey && compareTabs.some((t) => t.key === compareKey)) return;
    setCompareKey(compareTabs[0]?.key ?? null);
  }, [compareOn, compareKey, compareTabs]);
  const compareTab = compareTabs.find((t) => t.key === compareKey) ?? null;
  const compareLegend = buildLegend(compareKey, results, visMin, visMax, visPalette, legendBins);

  async function applyStretch(next: CarbonVisualizationStretch) {
    if (!stretchTarget || !onCarbonVisualizationChange || next === stretchMode || stretchBusy) return;
    setStretchBusy(true);
    setStretchError("");
    try {
      await onCarbonVisualizationChange(stretchTarget, next);
      setStretchMode(next);
      setStretchMenuOpen(false);
    } catch (error) {
      setStretchError(error instanceof Error ? error.message : "Rentang warna gagal diperbarui.");
    } finally {
      setStretchBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <i className="bi bi-globe-americas me-1" /> Peta Hasil
      </div>
      <div className="card-body">
        {tabs.length > 0 && (
          <div className="d-flex align-items-center gap-2 flex-wrap mb-3">
            <ul className="nav nav-tabs mb-0 flex-grow-1">
              {tabs.map((tab) => (
                <li className="nav-item" key={tab.key}>
                  <button
                    type="button"
                    className={`nav-link ${activeKey === tab.key ? "active" : ""}`}
                    onClick={() => {
                      setActiveKey(tab.key);
                      setCompareOn(false);
                      setCompareKey(null);
                    }}
                  >
                    <i className={`bi ${tab.icon} me-1`} />
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
            {tabs.length > 1 && (
              <button
                type="button"
                className={`btn btn-sm result-map-icon-button ${compareOn ? "btn-primary" : "btn-outline-secondary"} flex-shrink-0`}
                onClick={() => setCompareOn((v) => !v)}
                title={t("carbon.resultsMap.compareTitle")}
                aria-label={t("carbon.resultsMap.compareTitle")}
                aria-pressed={compareOn}
              >
                <i className="bi bi-arrow-left-right" aria-hidden="true" />
              </button>
            )}
            {canAdjustStretch && (
              <div className={`dropdown ${stretchMenuOpen ? "show" : ""}`}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary flex-shrink-0"
                  title="Atur kontras warna berdasarkan distribusi raster"
                  aria-label="Atur rentang warna peta karbon"
                  aria-expanded={stretchMenuOpen}
                  disabled={stretchBusy}
                  onClick={() => setStretchMenuOpen((open) => !open)}
                >
                  <i className={`bi ${stretchBusy ? "bi-arrow-repeat" : "bi-sliders"} me-1`} />
                  Skala warna
                </button>
                <div
                  className={`dropdown-menu dropdown-menu-end p-3 ${stretchMenuOpen ? "show" : ""}`}
                  style={{ minWidth: 270 }}
                >
                  <label className="form-label small fw-semibold mb-1" htmlFor="carbon-map-stretch">
                    Rentang nilai raster
                  </label>
                  <select
                    id="carbon-map-stretch"
                    className="form-select form-select-sm"
                    value={stretchMode}
                    disabled={stretchBusy}
                    onChange={(event) => void applyStretch(event.target.value as CarbonVisualizationStretch)}
                  >
                    <option value="p2_98">Persentil 2-98 - seimbang</option>
                    <option value="p5_95">Persentil 5-95 - kontras kuat</option>
                    <option value="min_max">Rentang penuh - min-maks</option>
                    <option value="admin">Rentang yang diatur admin</option>
                  </select>
                  <p className="small text-body-secondary mt-2 mb-0">
                    Nilai di luar persentil tetap terlihat, dengan warna pada ujung skala.
                  </p>
                  {stretchError && <div className="small text-danger mt-2" role="alert">{stretchError}</div>}
                </div>
              </div>
            )}
            {activeTab && isCarbonPoolTab(activeTab.key) && (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary result-map-icon-button flex-shrink-0"
                onClick={() => setRefreshToken((value) => value + 1)}
                title={t("carbon.resultsMap.refreshLayer", { layer: activeTab.label })}
                aria-label={t("carbon.resultsMap.refreshLayer", { layer: activeTab.label })}
              >
                <i className="bi bi-arrow-clockwise" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {compareOn && tabs.length > 1 && (
          <div className="d-flex align-items-center gap-2 flex-wrap mb-2" style={{ fontSize: ".85rem" }}>
            <span className="text-muted">Bandingkan <strong>{activeTab?.label}</strong> dengan:</span>
            <select
              className="form-select form-select-sm"
              style={{ maxWidth: 220 }}
              value={compareKey ?? ""}
              onChange={(e) => setCompareKey(e.target.value)}
            >
              {compareTabs.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {compareOn && compareTab ? (
          <div style={{ position: "relative" }}>
            <SwipeCompareMap
              id="carbonCompareMap"
              beforeUrl={activeTab?.tileUrl ?? null}
              afterUrl={compareTab.tileUrl ?? null}
              beforeLabel={activeTab?.label ?? "Layer A"}
              afterLabel={compareTab.label}
              beforeResolutionM={activeTab?.resolutionM}
              afterResolutionM={compareTab.resolutionM}
              beforeMaxNativeZoom={nativeZoomForResolution(activeTab?.resolutionM)}
              afterMaxNativeZoom={nativeZoomForResolution(compareTab.resolutionM)}
              orientation={compareOrientation}
              onOrientationChange={setCompareOrientation}
              center={safeCenter}
              zoom={zoom}
              opacity={opacity}
              historicalDate={analysisDate}
              bounds={aoi?.bounds ?? undefined}
              clipGeometry={aoi?.feature}
            >
              <BasemapSwitcher />
              <LayerOpacityControl opacity={opacity} onChange={setOpacity} label="Opacity" />
              {aoi?.feature && <GeoJSON key={JSON.stringify(aoi.feature.geometry)} data={aoi.feature} style={{ color: "red", weight: 2, fillOpacity: 0.1 }} />}
              {aoi && <FitResultAoi aoi={aoi} zoom={zoom} />}
              {(legend.entries.length > 0 || legend.scale || compareLegend.entries.length > 0 || compareLegend.scale) && (
                <ResultMapLegendControl>
                  {legend.entries.length > 0 || legend.scale ? (
                    <MapLegend title={legend.title} entries={legend.entries} scale={legend.scale} />
                  ) : null}
                  {compareLegend.entries.length > 0 || compareLegend.scale ? (
                    <MapLegend title={compareLegend.title} entries={compareLegend.entries} scale={compareLegend.scale} />
                  ) : null}
                </ResultMapLegendControl>
              )}
            </SwipeCompareMap>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <MapView
              key={mapKey}
              id="carbonResultMap"
              className="result-map"
              center={center}
              zoom={zoom}
              historicalDate={analysisDate}
              onMapReady={(map) => registerMap("results", map)}
            >
              <BasemapSwitcher />
              {aoi && <FitResultAoi aoi={aoi} zoom={zoom} />}
              {aoi?.feature && <GeoJSON data={aoi.feature} style={{ color: "red", weight: 2, fillOpacity: 0.1 }} />}
              {activeTab?.tileUrl && (
                <>
                  <ResultTileLayer
                    layerKey={activeTab.key}
                    tileUrl={activeTab.tileUrl}
                    resolutionM={activeTab.resolutionM}
                    opacity={opacity}
                    refreshToken={refreshToken}
                    clipGeometry={aoi?.feature}
                  />
                  <LayerOpacityControl opacity={opacity} onChange={setOpacity} label="Opacity" />
                </>
              )}
              {(legend.entries.length > 0 || legend.scale) && (
                <ResultMapLegendControl>
                  <MapLegend title={legend.title} entries={legend.entries} scale={legend.scale} />
                </ResultMapLegendControl>
              )}
            </MapView>
          </div>
        )}

        {activeTab && !activeTab.tileUrl && (
          <div className="alert alert-info mt-2 mb-0 py-2 small">
            <i className="bi bi-info-circle me-1" />
            Statistik tersedia, namun peta tile tidak tersedia untuk layer ini (mis. model
            inferensi server-side / non-GEE).
          </div>
        )}
      </div>
    </div>
  );
}
