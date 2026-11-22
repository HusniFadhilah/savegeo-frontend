import CropPanelAccordion from "./CropPanelAccordion";
import { useEffect, useMemo, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import ResultTileLayer from "@/components/map/ResultTileLayer";
import LayerOpacityControl from "@/components/map/LayerOpacityControl";
import MapLegend from "@/components/map/MapLegend";
import { boundsFromGeoJSON } from "@/features/carbon/lib/geo";
import type { AoiFeature, MapLegendEntry } from "@/types/map";
import type { CropMonitoringSubAnalyses } from "../types";
import type { CarbonResult } from "@/features/carbon/types";
import { useI18nStore } from "@/hooks/useI18nStore";
import { localizeCropLabel } from "../utils";

interface Tab {
  key: string;
  label: string;
  icon: string;
  tileUrl: string;
  legend: MapLegendEntry[];
}

/** `flood.legend[].label` comes straight from `disaster_analysis_service.py`
 * (shared with the Disaster module) in English - translated here at display
 * time rather than touching that shared backend string, which other modules
 * also read as-is. */
const FLOOD_LEGEND_KEY: Record<string, string> = {
  "Existing Water": "crop.map.existingWater",
  "New Inundation": "crop.map.newInundation",
  "Receded Water": "crop.map.recededWater",
};

function buildTabs(sub: CropMonitoringSubAnalyses, productivityResults: Record<string, CarbonResult>, t: (key: string) => string, locale: string): Tab[] {
  const tabs: Tab[] = [];
  if (sub.landcover?.available && sub.landcover.tile_url) tabs.push({
    key: "landcover", label: t("crop.map.landcover"), icon: "bi-layers", tileUrl: sub.landcover.tile_url,
    legend: Object.entries(sub.landcover.classes).map(([label, item]) => ({ label: localizeCropLabel(label, t), color: item.color })),
  });
  if (sub.health?.available && sub.health.tile_url) tabs.push({
    key: "health", label: t("crop.map.health"), icon: "bi-heart-pulse", tileUrl: sub.health.tile_url,
    legend: Object.entries(sub.health.classification?.classes ?? {}).map(([label, item]) => ({ label: localizeCropLabel(label, t), color: item.color })),
  });
  if (sub.anomaly?.available && sub.anomaly.tile_url) {
    tabs.push({
      key: "anomaly",
      label: t("crop.map.anomaly"),
      icon: "bi-exclamation-diamond",
      tileUrl: sub.anomaly.tile_url,
      legend: [
        { color: "#b71c1c", label: t("crop.map.ndviDecline"), value: "< -0.15" },
        { color: "#ffee58", label: t("crop.map.nearNormal"), value: "-0.15 - 0.15" },
        { color: "#2e7d32", label: t("crop.map.ndviIncrease"), value: "> 0.15" },
      ],
    });
  }
  if (sub.flood?.available && sub.flood.tile_url) {
    tabs.push({
      key: "flood",
      label: t("crop.map.flood"),
      icon: "bi-water",
      tileUrl: sub.flood.tile_url,
      legend: sub.flood.legend.map((l) => ({ color: l.color, label: FLOOD_LEGEND_KEY[l.label] ? t(FLOOD_LEGEND_KEY[l.label]) : l.label })),
    });
  }
  if (sub.productivity_zones?.available && sub.productivity_zones.tile_url) {
    tabs.push({
      key: "productivity_zones",
      label: t("crop.map.productivity"),
      icon: "bi-grid-3x3-gap",
      tileUrl: sub.productivity_zones.tile_url,
      legend: [
        { color: "#2e7d32", label: t("crop.high") },
        { color: "#f9a825", label: t("crop.moderate") },
        { color: "#c62828", label: t("crop.low") },
      ],
    });
  }
  for (const [key, result] of Object.entries(productivityResults)) {
    const tileUrl = result.carbon_estimated?.tile_url;
    if (!tileUrl) continue;
    const vis = result.carbon_estimated.vis_params;
    const palette = vis?.palette ?? ["#440154", "#21918c", "#fde725"];
    const min = vis?.min ?? result.carbon_estimated.statistics?.min ?? 0;
    const max = vis?.max ?? result.carbon_estimated.statistics?.max ?? 1;
    tabs.push({
      key: `modis_${key}`,
      label: `MODIS ${key.toUpperCase()}`,
      icon: "bi-graph-up-arrow",
      tileUrl,
      legend: [
        { color: palette[0], label: `${Number(min).toLocaleString(locale)} ${result.carbon_estimated.unit ?? ""}`.trim() },
        { color: palette[Math.floor(palette.length / 2)], label: key.toUpperCase() },
        { color: palette[palette.length - 1], label: `${Number(max).toLocaleString(locale)} ${result.carbon_estimated.unit ?? ""}`.trim() },
      ],
    });
  }
  return tabs;
}

function FitField({ feature }: { feature: AoiFeature | null }) {
  const map = useMap();
  useEffect(() => {
    const bounds = feature ? boundsFromGeoJSON(feature) : null;
    if (bounds) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
  }, [map, feature]);
  return null;
}

interface Props {
  fieldFeature: AoiFeature | null;
  subAnalyses: CropMonitoringSubAnalyses;
  analysisDate?: string;
  productivityResults?: Record<string, CarbonResult>;
}

/**
 * Single-active-tab tile layer switcher across every sub-analysis result
 * that carries a `tile_url`, including land cover and NDVI health. Always shows the
 * field boundary as a default context layer, even with zero tile tabs.
 */
export default function CropMonitoringResultsMapPanel({ fieldFeature, subAnalyses, analysisDate, productivityResults = {} }: Props) {
  const t = useI18nStore((state) => state.t);
  const language = useI18nStore((state) => state.language);
  const locale = language === "id" ? "id-ID" : "en-US";
  const tabs = useMemo(() => buildTabs(subAnalyses, productivityResults, t, locale), [subAnalyses, productivityResults, t, locale]);
  const [activeKey, setActiveKey] = useState<string | null>(tabs[0]?.key ?? null);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    setActiveKey((current) => tabs.some((tab) => tab.key === current) ? current : tabs[0]?.key ?? null);
    setOpacity(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.map((t) => t.key).join(",")]);

  const activeTab = tabs.find((t) => t.key === activeKey) ?? null;
  const bounds = fieldFeature ? boundsFromGeoJSON(fieldFeature) : null;
  const center: [number, number] = bounds ? [bounds.getCenter().lat, bounds.getCenter().lng] : [-2.5, 118];

  return (
    <CropPanelAccordion
      title={t("crop.map.title")}
      icon="bi-globe-americas"
      className="cm-panel-card cm-result-map-card"
      defaultOpen
      headerTrailing={activeTab && <span className="cm-header-chip">{activeTab.label}</span>}
    >
      {tabs.length > 0 && (
        <ul className="nav nav-pills cm-map-tabs mb-3">
          {tabs.map((tab) => (
            <li className="nav-item" key={tab.key}>
              <button
                type="button"
                className={`nav-link ${activeKey === tab.key ? "active" : ""}`}
                onClick={() => setActiveKey(tab.key)}
              >
                <i className={`bi ${tab.icon} me-1`} />
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="cm-map-shell">
        <MapView id="cropMonitoringResultMap" center={center} zoom={fieldFeature ? 13 : 5} historicalDate={analysisDate}>
          <BasemapSwitcher />
          <FitField feature={fieldFeature} />
          {fieldFeature && <GeoJSON key={JSON.stringify(fieldFeature.geometry)} data={fieldFeature} style={{ color: "#ef4444", weight: 2, fillOpacity: 0.04 }} />}
          {activeTab && (
            <>
              <ResultTileLayer layerKey={activeTab.key} tileUrl={activeTab.tileUrl} opacity={opacity} clipGeometry={fieldFeature} />
              <LayerOpacityControl opacity={opacity} onChange={setOpacity} label={t("crop.map.opacity")} />
            </>
          )}
        </MapView>
        {activeTab && activeTab.legend.length > 0 && (
          <div className="cm-map-legend">
            <MapLegend title={activeTab.label} entries={activeTab.legend} />
          </div>
        )}
      </div>

      {tabs.length === 0 && (
        <div className="alert alert-info mt-2 mb-0 py-2 small">
          <i className="bi bi-info-circle me-1" /> {t("crop.map.empty")}
        </div>
      )}
    </CropPanelAccordion>
  );
}
