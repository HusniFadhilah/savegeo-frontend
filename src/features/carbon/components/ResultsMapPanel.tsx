import { useEffect, useMemo, useState } from "react";
import { GeoJSON } from "react-leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import ResultTileLayer from "@/components/map/ResultTileLayer";
import LayerOpacityControl from "@/components/map/LayerOpacityControl";
import MapLegend from "@/components/map/MapLegend";
import type { AoiState } from "@/features/carbon/types";
import type { AnalysisResultsBundle } from "@/features/reports/export";
import { isLandCoverDatasetEntry } from "@/features/landcover/types";
import type { MapLegendEntry } from "@/types/map";

interface ResultTab {
  key: string;
  label: string;
  icon: string;
  tileUrl?: string;
}

interface Props {
  aoi: AoiState;
  zoom: number;
  results: AnalysisResultsBundle;
  visMin: number;
  visMax: number;
  visPalette: string[];
  showReference: boolean;
  mapKey: string | number;
}

function buildTabs(results: AnalysisResultsBundle, showReference: boolean): ResultTab[] {
  const tabs: ResultTab[] = [];

  if (results.vegetation) {
    if (results.vegetation.rgb_tile_url) {
      tabs.push({ key: "rgb", label: "RGB", icon: "bi-image", tileUrl: results.vegetation.rgb_tile_url });
    }
    for (const [index, stats] of Object.entries(results.vegetation.indices || {})) {
      tabs.push({ key: index, label: index, icon: "bi-flower1", tileUrl: stats.tile_url });
    }
  }

  if (results.landcover) {
    for (const [key, val] of Object.entries(results.landcover)) {
      if (!isLandCoverDatasetEntry(key, val)) continue;
      tabs.push({ key, label: key.replace(/_/g, " "), icon: "bi-map", tileUrl: val.tile_url });
    }
  }

  if (results.carbon) {
    tabs.push({
      key: "carbon_estimated",
      label: "Carbon Stock",
      icon: "bi-tree",
      tileUrl: results.carbon.carbon_estimated?.tile_url,
    });
    if (showReference && results.carbon.carbon_reference?.tile_url) {
      tabs.push({
        key: "carbon_reference",
        label: "Reference Carbon",
        icon: "bi-database",
        tileUrl: results.carbon.carbon_reference.tile_url,
      });
    }
  }

  return tabs;
}

function buildLegend(
  activeKey: string | null,
  results: AnalysisResultsBundle,
  visMin: number,
  visMax: number,
  visPalette: string[],
): { title: string; entries: MapLegendEntry[] } {
  if (!activeKey) return { title: "", entries: [] };

  if (activeKey === "carbon_estimated" || activeKey === "carbon_reference") {
    const colors = visPalette.length
      ? visPalette.map((c) => (c.startsWith("#") ? c : `#${c}`))
      : ["#440154", "#414487", "#2a788e", "#22a884", "#7ad151", "#fde725"];
    const n = colors.length;
    const entries = colors.map((color, i) => ({
      color,
      label: `${Math.round(visMin + (i * (visMax - visMin)) / Math.max(n - 1, 1))}${i === n - 1 ? "+" : ""}`,
    }));
    return { title: "Densitas Karbon (Mg/ha)", entries };
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
  showReference,
  mapKey,
}: Props) {
  const tabs = useMemo(() => buildTabs(results, showReference), [results, showReference]);
  const [activeKey, setActiveKey] = useState<string | null>(tabs[0]?.key ?? null);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    setActiveKey(tabs[0]?.key ?? null);
    setOpacity(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapKey]);

  useEffect(() => {
    setOpacity(1);
  }, [activeKey]);

  const activeTab = tabs.find((t) => t.key === activeKey) ?? null;
  const legend = buildLegend(activeKey, results, visMin, visMax, visPalette);
  const center: [number, number] = aoi.bounds
    ? [aoi.bounds.getCenter().lat, aoi.bounds.getCenter().lng]
    : [-2.5, 118];

  return (
    <div className="card">
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

        {activeTab?.tileUrl && (
          <div className="d-flex align-items-center mb-2 gap-2">
            <LayerOpacityControl opacity={opacity} onChange={setOpacity} label="Opacity" />
          </div>
        )}

        <div style={{ position: "relative" }}>
          <MapView
            key={mapKey}
            id="carbonResultMap"
            className="result-map"
            center={center}
            zoom={zoom}
          >
            <BasemapSwitcher />
            <GeoJSON data={aoi.feature} style={{ color: "red", weight: 2, fillOpacity: 0.1 }} />
            {activeTab?.tileUrl && (
              <ResultTileLayer layerKey={activeTab.key} tileUrl={activeTab.tileUrl} opacity={opacity} />
            )}
          </MapView>
          {legend.entries.length > 0 && (
            <div style={{ position: "absolute", bottom: 12, right: 12, zIndex: 1000, maxWidth: 220 }}>
              <MapLegend title={legend.title} entries={legend.entries} />
            </div>
          )}
        </div>

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
