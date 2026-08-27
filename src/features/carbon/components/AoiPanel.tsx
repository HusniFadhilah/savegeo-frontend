import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { useI18nStore } from "@/hooks/useI18nStore";
import { interpolate } from "@/i18n/translations";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import AoiDrawingTools, { setAoiOnMap, SyncAoiToGroup } from "@/components/map/AoiDrawingTools";
import { boundsFromGeoJSON, areaKm2 } from "@/features/carbon/lib/geo";
import type { AoiState, AoiSource } from "@/features/carbon/types";
import type { AoiFeature, AoiGeometry } from "@/types/map";
import {
  fetchCities,
  fetchDistricts,
  fetchProvinces,
  fetchRegionGeometry,
  fetchVillages,
} from "@/services/analysisService";
import AoiRegionTab from "./AoiRegionTab";
import AoiCoordinateTab from "./AoiCoordinateTab";
import AoiUploadTab from "./AoiUploadTab";
import AoiCompanyTab from "./AoiCompanyTab";
import { registerMap } from "@/features/chatbot/mapActions";
import MapCursorPosition from "@/components/map/MapCursorPosition";
import MapClickPicker from "@/components/map/MapClickPicker";
import { HIGH_DETAIL_MAX_ZOOM } from "@/config/mapZoom";

interface Props {
  aoi: AoiState | null;
  onAoiChange: (aoi: AoiState | null) => void;
}

type TabKey = "admin" | "coordinate" | "draw" | "upload" | "company";

/**
 * Soft warning threshold (not a hard block - backend `max_pixels` already
 * caps compute via bestEffort scaling). Picked from this session's own
 * timeout debugging: company-sized boundaries (tens of km²) ran fine,
 * district-scale AOIs (hundreds-thousands of km²) were where the 650s/900s
 * carbon timeouts actually started showing up. Audit item: "AOI size vs
 * timeout risk" had no user-facing warning at all before this.
 */
const AOI_TIMEOUT_RISK_KM2 = 500;

const TAB_ICONS: Record<TabKey, string> = {
  admin: "bi-map-fill",
  coordinate: "bi-pin-map-fill",
  draw: "bi-vector-pen",
  upload: "bi-upload",
  company: "bi-building-fill",
};

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/^(provinsi|province|kabupaten|kota|city|regency)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function geometryFromGeoJSON(input: GeoJSON.GeoJSON): AoiGeometry {
  if (input.type === "Feature") return geometryFromGeoJSON(input.geometry);
  if (input.type === "FeatureCollection") {
    const geometries = input.features.map((f) => f.geometry).filter((g): g is GeoJSON.Geometry => Boolean(g));
    if (!geometries.length) throw new Error(useI18nStore.getState().t("carbon.aoi.err.noGeometry"));
    return mergeGeometry(geometries.map(geometryFromGeoJSON));
  }
  if (input.type === "Polygon" || input.type === "MultiPolygon") return input;
  if (input.type === "GeometryCollection") {
    return mergeGeometry(input.geometries.map(geometryFromGeoJSON));
  }
  throw new Error(`${useI18nStore.getState().t("carbon.aoi.err.unsupportedGeometry")}: ${input.type}`);
}

function mergeGeometry(geometries: AoiGeometry[]): AoiGeometry {
  if (geometries.length === 1) return geometries[0];
  const coordinates: GeoJSON.Position[][][] = [];
  for (const geometry of geometries) {
    if (geometry.type === "Polygon") coordinates.push(geometry.coordinates);
    else coordinates.push(...geometry.coordinates);
  }
  return { type: "MultiPolygon", coordinates };
}

function toAoiFeature(input: GeoJSON.GeoJSON): AoiFeature {
  if (input.type === "Feature") {
    return {
      type: "Feature",
      geometry: geometryFromGeoJSON(input),
      properties: input.properties || {},
    };
  }
  return {
    type: "Feature",
    geometry: geometryFromGeoJSON(input),
    properties: {},
  };
}

function findByDisplayName<T extends { name: string }>(items: T[], wanted: string): T | undefined {
  const key = normalizeName(wanted);
  return items.find((item) => {
    const name = normalizeName(item.name);
    return name === key || name.includes(key) || key.includes(name);
  });
}

/**
 * AOI selection card: 5 tabs (Indonesia Admin / Koordinat / Gambar di Peta /
 * Unggah File / Perusahaan) sharing one embedded map, ported from
 * module-carbon.html's #aoiAdmin/#aoiCoord/#aoiDraw/#aoiUpload/#aoiCompany.
 * Non-draw tabs push their geometry onto the same Leaflet FeatureGroup the
 * draw tool owns (via AoiDrawingTools' externalGroupRef), so an imported AOI
 * stays editable/deletable with the same toolbar.
 */
export default function AoiPanel({ aoi, onAoiChange }: Props) {
  const t = useI18nStore((s) => s.t);
  const [activeTab, setActiveTab] = useState<TabKey>("admin");
  const [open, setOpen] = useState(true);
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

  useEffect(() => {
    (window as unknown as { L?: typeof L }).L = L;
    (window as unknown as { map?: L.Map | null }).map = mapRef.current;

    window.flyToLocation = (lat, lng, zoom, bbox) => {
      const map = mapRef.current;
      if (!map) return;
      if (bbox && bbox.length >= 4) {
        map.fitBounds(
          [
            [bbox[1], bbox[0]],
            [bbox[3], bbox[2]],
          ],
          { padding: [30, 30], maxZoom: HIGH_DETAIL_MAX_ZOOM },
        );
      } else {
        map.flyTo([lat, lng], zoom ?? 12, { duration: 1.2 });
      }
    };

    window.setAOIFromGeoJSON = (geojson, name = t("carbon.aoi.fromChatbot")) => {
      const feature = toAoiFeature(geojson);
      applyAoi(feature, name, "upload");
    };
    window.loadGeoJSONAsAOI = (geojson) => {
      window.setAOIFromGeoJSON?.(geojson, t("carbon.aoi.fromFile"));
    };
    window.setAOIByAdminName = async (province, city, district, village) => {
      try {
        const provinces = await fetchProvinces();
        const provinceMatch = findByDisplayName(provinces, province);
        if (!provinceMatch) return false;

        let endpoint: "province" | "city" | "district" | "village" = "province";
        let code = provinceMatch.code;
        let label = provinceMatch.name;

        if (city) {
          const cityMatch = findByDisplayName(await fetchCities(provinceMatch.code), city);
          if (!cityMatch) return false;
          endpoint = "city";
          code = cityMatch.code;
          label = cityMatch.name;

          if (district) {
            const districtMatch = findByDisplayName(await fetchDistricts(cityMatch.code), district);
            if (!districtMatch) return false;
            endpoint = "district";
            code = districtMatch.code;
            label = districtMatch.name;

            if (village) {
              const villageMatch = findByDisplayName(await fetchVillages(districtMatch.code), village);
              if (!villageMatch) return false;
              endpoint = "village";
              code = villageMatch.code;
              label = villageMatch.name;
            }
          }
        }

        const geometry = await fetchRegionGeometry(endpoint, code);
        applyAoi(toAoiFeature(geometry), label, "admin");
        return true;
      } catch {
        return false;
      }
    };

    return () => {
      (window as unknown as { map?: L.Map | null }).map = null;
      delete window.flyToLocation;
      delete window.setAOIFromGeoJSON;
      delete window.loadGeoJSONAsAOI;
      delete window.setAOIByAdminName;
    };
  }, [applyAoi]);

  const handleDrawChange = useCallback(
    (feature: AoiFeature | null) => {
      if (!feature) {
        onAoiChange(null);
        return;
      }
      const bounds = boundsFromGeoJSON(feature);
      const area = areaKm2(feature, bounds);
      onAoiChange({ source: "drawn", name: t("carbon.aoi.customPolygon"), areaKm2: area, feature, bounds });
    },
    [onAoiChange, t],
  );

  useEffect(() => {
    if (!open) return;
    // Leaflet doesn't notice its container growing back from display:none -
    // nudge it once the collapse transition/reflow has settled.
    const timer = setTimeout(() => mapRef.current?.invalidateSize(), 260);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <div className="card">
      <button
        type="button"
        className="card-header d-flex align-items-center justify-content-between w-100 border-0 text-start"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>
          <i className="bi bi-geo-alt-fill" /> {t("carbon.aoi.title")}
          {aoi && !open && (
            <span className="ms-2 fw-normal" style={{ fontSize: ".8rem", opacity: 0.85 }}>
              &middot; {aoi.name}
              {aoi.areaKm2 != null && <> ({aoi.areaKm2.toFixed(2)} km²)</>}
            </span>
          )}
        </span>
        <i className={`bi ${open ? "bi-chevron-up" : "bi-chevron-down"}`} />
      </button>
      <div className="card-body" style={{ display: open ? "block" : "none" }}>
        <div className="aoi-tabs mb-3">
          {(["admin", "coordinate", "draw", "upload", "company"] as TabKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`aoi-tab ${activeTab === key ? "active" : ""}`}
              onClick={() => setActiveTab(key)}
            >
              <i className={`bi ${TAB_ICONS[key]}`} />
              {t(`carbon.aoi.tab.${key}`)}
            </button>
          ))}
        </div>

        <div className="tab-content mb-3">
          {activeTab === "admin" && (
            <AoiRegionTab onApply={(f, n) => applyAoi(f, n, "admin")} />
          )}
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
              {t("carbon.aoi.drawHint")}
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
            (window as unknown as { map?: L.Map | null }).map = map;
            registerMap("aoi", map);
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
            {t("carbon.aoi.selectedLabel")}: <strong>{aoi.name}</strong>
            {aoi.areaKm2 != null && <> &middot; {aoi.areaKm2.toFixed(2)} km²</>}
          </div>
        )}
        {aoi?.areaKm2 != null && aoi.areaKm2 >= AOI_TIMEOUT_RISK_KM2 && (
          <div className="alert alert-warning mt-2 mb-0 py-2" style={{ fontSize: ".8rem" }}>
            <i className="fas fa-triangle-exclamation me-1" />
            {interpolate(t("carbon.aoi.sizeWarning"), { area: aoi.areaKm2.toFixed(0) })}
          </div>
        )}
      </div>
    </div>
  );
}
