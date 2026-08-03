import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import AoiDrawingTools, { setAoiOnMap } from "@/components/map/AoiDrawingTools";
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
    if (!geometries.length) throw new Error("GeoJSON tidak berisi geometry");
    return mergeGeometry(geometries.map(geometryFromGeoJSON));
  }
  if (input.type === "Polygon" || input.type === "MultiPolygon") return input;
  if (input.type === "GeometryCollection") {
    return mergeGeometry(input.geometries.map(geometryFromGeoJSON));
  }
  throw new Error(`Tipe geometry tidak didukung: ${input.type}`);
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
          { padding: [30, 30] },
        );
      } else {
        map.flyTo([lat, lng], zoom ?? 12, { duration: 1.2 });
      }
    };

    window.setAOIFromGeoJSON = (geojson, name = "AOI dari chatbot") => {
      const feature = toAoiFeature(geojson);
      applyAoi(feature, name, "upload");
    };
    window.loadGeoJSONAsAOI = (geojson) => {
      window.setAOIFromGeoJSON?.(geojson, "AOI dari file");
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
            (window as unknown as { map?: L.Map | null }).map = map;
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
