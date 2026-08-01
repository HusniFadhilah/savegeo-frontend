import { useCallback, useRef, useState } from "react";
import type L from "leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import AoiDrawingTools, { setAoiOnMap } from "@/components/map/AoiDrawingTools";
import { boundsFromGeoJSON, areaKm2 } from "@/features/carbon/lib/geo";
import type { AoiState, AoiSource } from "@/features/carbon/types";
import type { AoiFeature } from "@/types/map";
import AoiRegionTab from "./AoiRegionTab";
import AoiCoordinateTab from "./AoiCoordinateTab";
import AoiUploadTab from "./AoiUploadTab";
import AoiCompanyTab from "./AoiCompanyTab";

interface Props {
  aoi: AoiState | null;
  onAoiChange: (aoi: AoiState | null) => void;
}

type TabKey = "admin" | "coordinate" | "draw" | "upload" | "company";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "admin", label: "Indonesia Admin", icon: "bi-map-fill" },
  { key: "coordinate", label: "Koordinat", icon: "bi-pin-map-fill" },
  { key: "draw", label: "Gambar di Peta", icon: "bi-vector-pen" },
  { key: "upload", label: "Unggah File", icon: "bi-upload" },
  { key: "company", label: "Perusahaan", icon: "bi-building-fill" },
];

/**
 * AOI selection card: 5 tabs (Indonesia Admin / Koordinat / Gambar di Peta /
 * Unggah File / Perusahaan) sharing one embedded map, ported from
 * module-carbon.html's #aoiAdmin/#aoiCoord/#aoiDraw/#aoiUpload/#aoiCompany.
 * Non-draw tabs push their geometry onto the same Leaflet FeatureGroup the
 * draw tool owns (via AoiDrawingTools' externalGroupRef), so an imported AOI
 * stays editable/deletable with the same toolbar.
 */
export default function AoiPanel({ aoi, onAoiChange }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("admin");
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.FeatureGroup | null>(null);

  const applyAoi = useCallback(
    (feature: AoiFeature, name: string, source: AoiSource) => {
      const bounds = boundsFromGeoJSON(feature);
      const area = areaKm2(feature, bounds);
      if (mapRef.current && groupRef.current) {
        setAoiOnMap(mapRef.current, groupRef.current, feature);
      }
      onAoiChange({ source, name, areaKm2: area, feature, bounds });
    },
    [onAoiChange],
  );

  const handleDrawChange = useCallback(
    (feature: AoiFeature | null) => {
      if (!feature) {
        onAoiChange(null);
        return;
      }
      const bounds = boundsFromGeoJSON(feature);
      const area = areaKm2(feature, bounds);
      onAoiChange({ source: "drawn", name: "Poligon Kustom", areaKm2: area, feature, bounds });
    },
    [onAoiChange],
  );

  return (
    <div className="card">
      <div className="card-header">
        <i className="bi bi-geo-alt-fill" /> Area of Interest (AOI)
      </div>
      <div className="card-body">
        <div className="aoi-tabs mb-3">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`aoi-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <i className={`bi ${tab.icon}`} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="tab-content mb-3">
          {activeTab === "admin" && (
            <AoiRegionTab onApply={(f, n) => applyAoi(f, n, "admin")} />
          )}
          {activeTab === "coordinate" && (
            <AoiCoordinateTab onApply={(f, n) => applyAoi(f, n, "coordinate")} />
          )}
          {activeTab === "draw" && (
            <div className="alert alert-info py-2 small mb-0">
              <i className="bi bi-info-circle me-1" />
              Gambar polygon atau rectangle langsung di peta di bawah. Bentuk otomatis menjadi
              AOI dan tetap bisa diedit/dihapus lewat toolbar peta.
            </div>
          )}
          {activeTab === "upload" && (
            <AoiUploadTab onApply={(f, n) => applyAoi(f, n, "upload")} />
          )}
          {activeTab === "company" && (
            <AoiCompanyTab onApply={(f, n) => applyAoi(f, n, "company")} />
          )}
        </div>

        <MapView
          id="carbonAoiMap"
          onMapReady={(map) => {
            mapRef.current = map;
          }}
        >
          <BasemapSwitcher />
          <AoiDrawingTools onChange={handleDrawChange} externalGroupRef={groupRef} />
        </MapView>

        {aoi && (
          <div className="alert alert-success mt-3 mb-0 py-2">
            <i className="bi bi-check-circle-fill me-1" />
            AOI: <strong>{aoi.name}</strong>
            {aoi.areaKm2 != null && <> &middot; {aoi.areaKm2.toFixed(2)} km²</>}
          </div>
        )}
      </div>
    </div>
  );
}
