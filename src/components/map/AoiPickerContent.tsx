import { useCallback, useRef, useState } from "react";
import L from "leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import AoiDrawingTools, { setAoiOnMap, SyncAoiToGroup } from "@/components/map/AoiDrawingTools";
import AoiRegionTab from "@/features/carbon/components/AoiRegionTab";
import AoiCoordinateTab from "@/features/carbon/components/AoiCoordinateTab";
import AoiUploadTab from "@/features/carbon/components/AoiUploadTab";
import AoiCompanyTab from "@/features/carbon/components/AoiCompanyTab";
import MapCursorPosition from "@/components/map/MapCursorPosition";
import MapClickPicker from "@/components/map/MapClickPicker";
import { boundsFromGeoJSON, areaKm2 } from "@/features/carbon/lib/geo";
import type { AoiState, AoiSource } from "@/features/carbon/types";
import type { AoiFeature } from "@/types/map";
import { useI18nStore } from "@/hooks/useI18nStore";

type TabKey = "admin" | "coordinate" | "draw" | "upload" | "company";

const TABS: { key: TabKey; labelKey: string; icon: string }[] = [
  { key: "admin", labelKey: "aoi.tab.admin", icon: "bi-map-fill" },
  { key: "coordinate", labelKey: "aoi.tab.coordinate", icon: "bi-pin-map-fill" },
  { key: "draw", labelKey: "aoi.tab.draw", icon: "bi-vector-pen" },
  { key: "upload", labelKey: "aoi.tab.upload", icon: "bi-upload" },
  { key: "company", labelKey: "aoi.tab.company", icon: "bi-building-fill" },
];

interface Props {
  id: string;
  aoi: AoiState | null;
  onAoiChange: (aoi: AoiState | null) => void;
  defaultTab?: TabKey;
}

export default function AoiPickerContent({ id, aoi, onAoiChange, defaultTab = "admin" }: Props) {
  const t = useI18nStore((state) => state.t);
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);
  const [coordLat, setCoordLat] = useState("-6.9667");
  const [coordLon, setCoordLon] = useState("110.4167");
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
      onAoiChange({ source: "drawn", name: "Poligon Kustom", areaKm2: areaKm2(feature, bounds), feature, bounds });
    },
    [onAoiChange],
  );

  return (
    <div className="aoi-picker-content">
      <div className="aoi-tabs mb-3">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`aoi-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <i className={`bi ${tab.icon}`} />
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <div className="tab-content mb-3">
        {activeTab === "admin" && <AoiRegionTab onApply={(f, n) => applyAoi(f, n, "admin")} />}
        {activeTab === "coordinate" && (
          <AoiCoordinateTab
            onApply={(f, n) => applyAoi(f, n, "coordinate")}
            lat={coordLat}
            lon={coordLon}
            onLatChange={setCoordLat}
            onLonChange={setCoordLon}
          />
        )}
        {activeTab === "draw" && (
          <div className="alert alert-info py-2 small mb-0">
            <i className="bi bi-info-circle me-1" />
            {t("aoi.drawHint")}
          </div>
        )}
        {activeTab === "upload" && <AoiUploadTab onApply={(f, n) => applyAoi(f, n, "upload")} />}
        {activeTab === "company" && <AoiCompanyTab onApply={(f, n) => applyAoi(f, n, "company")} />}
      </div>

      <MapView
        id={id}
        onMapReady={(map) => {
          mapRef.current = map;
        }}
      >
        <BasemapSwitcher />
        <AoiDrawingTools onChange={handleDrawChange} externalGroupRef={groupRef} />
        <SyncAoiToGroup aoi={aoi?.feature ?? null} groupRef={groupRef} />
        <MapClickPicker
          active={activeTab === "coordinate"}
          onPick={(lat, lng) => {
            setCoordLat(lat.toFixed(5));
            setCoordLon(lng.toFixed(5));
          }}
        />
        <MapCursorPosition />
      </MapView>

      {aoi && (
        <div className="alert alert-success mt-3 mb-0 py-2">
          <i className="bi bi-check-circle-fill me-1" />
          AOI: <strong>{aoi.name}</strong>
          {aoi.areaKm2 != null && <> &middot; {aoi.areaKm2.toFixed(2)} km²</>}
        </div>
      )}
    </div>
  );
}
