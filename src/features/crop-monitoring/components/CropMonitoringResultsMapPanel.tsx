import { useEffect, useMemo, useState } from "react";
import { GeoJSON } from "react-leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import ResultTileLayer from "@/components/map/ResultTileLayer";
import LayerOpacityControl from "@/components/map/LayerOpacityControl";
import MapLegend from "@/components/map/MapLegend";
import { boundsFromGeoJSON } from "@/features/carbon/lib/geo";
import type { AoiFeature, MapLegendEntry } from "@/types/map";
import type { CropMonitoringSubAnalyses } from "../types";

interface Tab {
  key: string;
  label: string;
  icon: string;
  tileUrl: string;
  legend: MapLegendEntry[];
}

const PRODUCTIVITY_LEGEND: MapLegendEntry[] = [
  { color: "#2e7d32", label: "Tinggi" },
  { color: "#f9a825", label: "Sedang" },
  { color: "#c62828", label: "Rendah" },
];

/** `flood.legend[].label` comes straight from `disaster_analysis_service.py`
 * (shared with the Disaster module) in English - translated here at display
 * time rather than touching that shared backend string, which other modules
 * also read as-is. */
const FLOOD_LEGEND_LABEL: Record<string, string> = {
  "Existing Water": "Genangan Lama",
  "New Inundation": "Genangan Baru",
  "Receded Water": "Air Surut",
};

function buildTabs(sub: CropMonitoringSubAnalyses): Tab[] {
  const tabs: Tab[] = [];
  if (sub.anomaly?.available && sub.anomaly.tile_url) {
    tabs.push({ key: "anomaly", label: "Anomali", icon: "bi-exclamation-diamond", tileUrl: sub.anomaly.tile_url, legend: [] });
  }
  if (sub.flood?.available && sub.flood.tile_url) {
    tabs.push({
      key: "flood",
      label: "Banjir",
      icon: "bi-water",
      tileUrl: sub.flood.tile_url,
      legend: sub.flood.legend.map((l) => ({ color: l.color, label: FLOOD_LEGEND_LABEL[l.label] ?? l.label })),
    });
  }
  if (sub.productivity_zones?.available && sub.productivity_zones.tile_url) {
    tabs.push({
      key: "productivity_zones",
      label: "Zona Produktivitas",
      icon: "bi-grid-3x3-gap",
      tileUrl: sub.productivity_zones.tile_url,
      legend: PRODUCTIVITY_LEGEND,
    });
  }
  return tabs;
}

interface Props {
  fieldFeature: AoiFeature | null;
  subAnalyses: CropMonitoringSubAnalyses;
}

/**
 * Single-active-tab tile layer switcher across every sub-analysis result
 * that carries a `tile_url` (Anomaly/Flood/Productivity Zones - Health has
 * none directly, RGB is not part of this response shape). Always shows the
 * field boundary as a default context layer, even with zero tile tabs.
 */
export default function CropMonitoringResultsMapPanel({ fieldFeature, subAnalyses }: Props) {
  const tabs = useMemo(() => buildTabs(subAnalyses), [subAnalyses]);
  const [activeKey, setActiveKey] = useState<string | null>(tabs[0]?.key ?? null);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    setActiveKey(tabs[0]?.key ?? null);
    setOpacity(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.map((t) => t.key).join(",")]);

  const activeTab = tabs.find((t) => t.key === activeKey) ?? null;
  const bounds = fieldFeature ? boundsFromGeoJSON(fieldFeature) : null;
  const center: [number, number] = bounds ? [bounds.getCenter().lat, bounds.getCenter().lng] : [-2.5, 118];

  return (
    <div className="card mb-3">
      <div className="card-header">
        <i className="bi bi-globe-americas me-1" /> Peta Hasil
      </div>
      <div className="card-body">
        {tabs.length > 0 && (
          <ul className="nav nav-tabs mb-3">
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

        <div style={{ position: "relative" }}>
          <MapView id="cropMonitoringResultMap" center={center} zoom={fieldFeature ? 13 : 5}>
            <BasemapSwitcher />
            {fieldFeature && <GeoJSON data={fieldFeature} style={{ color: "red", weight: 2, fillOpacity: 0.05 }} />}
            {activeTab && (
              <>
                <ResultTileLayer layerKey={activeTab.key} tileUrl={activeTab.tileUrl} opacity={opacity} />
                <LayerOpacityControl opacity={opacity} onChange={setOpacity} label="Opacity" />
              </>
            )}
          </MapView>
          {activeTab && activeTab.legend.length > 0 && (
            <div style={{ position: "absolute", bottom: 12, right: 12, zIndex: 1000, maxWidth: 220 }}>
              <MapLegend title={activeTab.label} entries={activeTab.legend} />
            </div>
          )}
        </div>

        {tabs.length === 0 && (
          <div className="alert alert-info mt-2 mb-0 py-2 small">
            <i className="bi bi-info-circle me-1" /> Tidak ada layer peta tile (Anomali/Banjir/Zona Produktivitas)
            yang tersedia untuk hasil ini - batas lahan tetap ditampilkan di atas.
          </div>
        )}
      </div>
    </div>
  );
}
