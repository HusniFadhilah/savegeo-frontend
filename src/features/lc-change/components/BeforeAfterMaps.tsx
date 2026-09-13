import { useEffect, useRef, useState } from "react";
import { GeoJSON, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { nativeZoomForResolution, HIGH_DETAIL_MAX_ZOOM } from "@/config/mapZoom";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import LayerOpacityControl from "@/components/map/LayerOpacityControl";
import MapLegend from "@/components/map/MapLegend";
import SwipeCompareMap, { type SwipeOrientation } from "@/components/map/SwipeCompareMap";
import { identifyLandCoverPoint } from "../api";
import type { AoiFeature, MapLegendEntry } from "@/types/map";
import type { ChangeMapMode, LcChangeMapResponse, LcDataset, LcIdentifyResponse, LcYearResult } from "../types";
import { translateLulcClass } from "../utils";
import { RESULT_PANE } from "@/config/mapPanes";

type ViewMode = "split" | "swipe";

const AOI_STYLE = { color: "#ef4444", weight: 2, fillOpacity: 0.06 };

function FitToAoi({ aoi }: { aoi: AoiFeature | null }) {
  const map = useMap();
  useEffect(() => {
    if (!aoi) return;
    const bounds = L.geoJSON(aoi as GeoJSON.Feature).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 12 });
  }, [aoi, map]);
  return null;
}

function MapClickInspector({ onClick }: { onClick: (latitude: number, longitude: number) => void }) {
  useMapEvents({
    click: (event) => onClick(event.latlng.lat, event.latlng.lng),
  });
  return null;
}

function classLegend(classes: LcYearResult["classes"] | undefined): MapLegendEntry[] {
  if (!classes) return [];
  return Object.entries(classes)
    .sort((a, b) => (b[1].percentage || 0) - (a[1].percentage || 0))
    .map(([name, cls]) => ({
      color: cls.color,
      label: translateLulcClass(name),
      value: `${cls.percentage.toFixed(1)}%`,
    }));
}

interface Props {
  aoi: AoiFeature | null;
  onAoiChange: (f: AoiFeature | null) => void;
  dataset: LcDataset;
  yearA: number | null;
  yearB: number | null;
  yearData: Record<number, LcYearResult>;
  mode: ChangeMapMode;
  onModeChange: (m: ChangeMapMode) => void;
  changeMapData: LcChangeMapResponse | null;
  changeMapLoading: boolean;
  changeMapError: string | null;
  startMonth?: number;
  endMonth?: number;
  startDate?: string;
  endDate?: string;
  dwProbabilityThreshold?: number;
}

/**
 * Two side-by-side Leaflet maps (before = yearA, after = yearB), each its
 * own MapView instance per the app's shared map primitives. AOI editing now
 * happens in the module-level AOI modal; these maps focus on preview/results.
 */
export default function BeforeAfterMaps({
  aoi,
  onAoiChange,
  dataset,
  yearA,
  yearB,
  yearData,
  mode,
  onModeChange,
  changeMapData,
  changeMapLoading,
  changeMapError,
  startMonth = 1,
  endMonth = 12,
  startDate,
  endDate,
  dwProbabilityThreshold,
}: Props) {
  const beforeTile = (yearA != null ? yearData[yearA]?.tile_url : null) ?? changeMapData?.from_tile_url ?? null;
  const afterRawTile = (yearB != null ? yearData[yearB]?.tile_url : null) ?? changeMapData?.to_tile_url ?? null;
  const afterTile = mode === "destination" ? changeMapData?.destination_tile_url ?? afterRawTile : afterRawTile;
  const swipeAfterTile = mode === "changed" ? changeMapData?.changed_tile_url ?? afterTile : afterTile;

  const beforeNativeZoom = nativeZoomForResolution(Number.parseFloat(String(yearA != null ? yearData[yearA]?.resolution ?? changeMapData?.resolution : changeMapData?.resolution)));
  const afterNativeZoom = nativeZoomForResolution(Number.parseFloat(String(yearB != null ? yearData[yearB]?.resolution ?? changeMapData?.resolution : changeMapData?.resolution)));

  const beforeLegend = classLegend(yearA != null ? yearData[yearA]?.classes : undefined);
  const afterLegend = classLegend(yearB != null ? yearData[yearB]?.classes : undefined);

  const [view, setView] = useState<ViewMode>("swipe");
  const [swipeOrientation, setSwipeOrientation] = useState<SwipeOrientation>("vertical");
  const [opacity, setOpacity] = useState(0.88);
  const [inspectResults, setInspectResults] = useState<LcIdentifyResponse[]>([]);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const inspectRequestRef = useRef(0);

  const handleMapClick = async (latitude: number, longitude: number) => {
    if (!aoi || yearA == null || yearB == null) return;
    const requestId = ++inspectRequestRef.current;
    setInspectLoading(true);
    setInspectError(null);
    try {
      const base = {
        aoi: { geojson: aoi as GeoJSON.Feature },
        dataset,
        latitude,
        longitude,
        start_month: startMonth,
        end_month: endMonth,
        ...(startDate && endDate ? { start_date: startDate, end_date: endDate } : {}),
        ...(dwProbabilityThreshold != null ? { dw_probability_threshold: dwProbabilityThreshold } : {}),
      };
      const results = await Promise.all([
        identifyLandCoverPoint({ ...base, year: yearA }),
        identifyLandCoverPoint({ ...base, year: yearB }),
      ]);
      if (requestId === inspectRequestRef.current) setInspectResults(results);
    } catch (error) {
      if (requestId === inspectRequestRef.current) {
        setInspectResults([]);
        setInspectError(error instanceof Error ? error.message : "Gagal membaca kelas pada titik peta.");
      }
    } finally {
      if (requestId === inspectRequestRef.current) setInspectLoading(false);
    }
  };

  const formatArea = (value: number | null) =>
    value == null ? "-" : `${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ha`;

  return (
    <div>
      <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
        <p className="text-muted mb-0 me-auto" style={{ fontSize: ".8rem" }}>
          <i className="fas fa-info-circle" /> {view === "split" ? "Kiri" : "Sebelum"} = tahun awal (
          {yearA ?? "-"}) · {view === "split" ? "Kanan" : "Sesudah"} = tahun akhir ({yearB ?? "-"})
        </p>
        <div className="btn-group btn-group-sm" role="group" aria-label="Tampilan peta">
          <button
            type="button"
            className={`btn btn-outline-secondary ${view === "split" ? "active" : ""}`}
            onClick={() => setView("split")}
          >
            <i className="fas fa-columns" /> Berdampingan
          </button>
          <button
            type="button"
            className={`btn btn-outline-secondary ${view === "swipe" ? "active" : ""}`}
            onClick={() => setView("swipe")}
          >
            <i className="fas fa-arrows-alt-h" /> Geser (Slider)
          </button>
        </div>
        <div className="btn-group btn-group-sm" role="group" aria-label="Mode peta perubahan">
          <button
            type="button"
            className={`btn btn-outline-success ${mode === "normal" ? "active" : ""}`}
            onClick={() => onModeChange("normal")}
          >
            <i className="fas fa-map" /> Kelas Tahun
          </button>
          <button
            type="button"
            className={`btn btn-outline-success ${mode === "changed" ? "active" : ""}`}
            onClick={() => onModeChange("changed")}
          >
            <i className="fas fa-highlighter" /> Area Berubah
          </button>
          <button
            type="button"
            className={`btn btn-outline-success ${mode === "destination" ? "active" : ""}`}
            onClick={() => onModeChange("destination")}
          >
            <i className="fas fa-layer-group" /> Kelas Tujuan
          </button>
        </div>
      </div>

      {changeMapLoading && (
        <div className="alert alert-info py-2 mb-2" style={{ fontSize: ".82rem" }}>
          <i className="fas fa-spinner fa-spin" /> Memuat peta perubahan {yearA} → {yearB}...
        </div>
      )}
      {changeMapError && (
        <div className="alert alert-warning py-2 mb-2" style={{ fontSize: ".82rem" }}>
          {changeMapError}
        </div>
      )}
      {(inspectLoading || inspectError || inspectResults.length > 0) && (
        <div className="lc-map-inspector mb-2" role="status">
          <div className="lc-map-inspector-heading">
            <strong><i className="fas fa-location-dot" /> Informasi titik tutupan lahan</strong>
            {inspectLoading && <span><i className="fas fa-spinner fa-spin" /> Membaca kelas...</span>}
          </div>
          {inspectError && <div className="text-danger small">{inspectError}</div>}
          {!inspectLoading && !inspectError && (
            <div className="row g-2">
              {inspectResults.map((result) => (
                <div className="col-md-6" key={result.year}>
                  <div className="lc-map-inspector-result">
                    <span className="lc-map-inspector-year">{result.year}</span>
                    <strong>
                      {result.class_name ? translateLulcClass(result.class_name) : "Tidak ada data pada titik ini"}
                    </strong>
                    <small>
                      {result.percentage != null
                        ? `${result.percentage.toFixed(1)}% dari 100% luas AOI · ${formatArea(result.area_ha)}`
                        : "Titik berada di luar AOI atau kelas tidak tersedia."}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {!changeMapLoading && !changeMapError && changeMapData && (
        <div className="alert alert-success py-2 mb-2" style={{ fontSize: ".82rem" }}>
          <i className="fas fa-check-circle" /> Berubah:{" "}
          <strong>{Number(changeMapData.changed_area_ha || 0).toLocaleString("id-ID")} ha</strong> (
          {Number(changeMapData.changed_percentage || 0).toFixed(2)}%)
        </div>
      )}

      {view === "split" && (
        <div className="row g-2">
          <div className="col-md-6">
            <MapView id="lcChangeBeforeMap">
              <BasemapSwitcher />
              <LayerOpacityControl opacity={opacity} onChange={setOpacity} label="Opacity peta" />
              <MapClickInspector onClick={handleMapClick} />
              {aoi && <GeoJSON key={JSON.stringify(aoi.geometry)} data={aoi as GeoJSON.Feature} style={AOI_STYLE} />}
              {beforeTile && <TileLayer url={beforeTile}
                  maxNativeZoom={beforeNativeZoom} maxZoom={HIGH_DETAIL_MAX_ZOOM} opacity={opacity} attribution="Google Earth Engine" pane={RESULT_PANE} />}
              <FitToAoi aoi={aoi} />
            </MapView>
            <MapLegend title={`Tutupan lahan ${yearA ?? ""}`} entries={beforeLegend} />
          </div>
          <div className="col-md-6">
            <MapView id="lcChangeAfterMap">
              <BasemapSwitcher />
              <LayerOpacityControl opacity={opacity} onChange={setOpacity} label="Opacity peta" />
              <MapClickInspector onClick={handleMapClick} />
              {aoi && <GeoJSON key={JSON.stringify(aoi.geometry)} data={aoi as GeoJSON.Feature} style={AOI_STYLE} />}
              {afterTile && (
                <TileLayer
                  key={`${mode}-${afterTile}`}
                  url={afterTile}
                  maxNativeZoom={afterNativeZoom} maxZoom={HIGH_DETAIL_MAX_ZOOM}
                  opacity={opacity * (mode === "destination" ? 0.9 : 0.88)}
                  attribution="Google Earth Engine"
                  pane={RESULT_PANE}
                />
              )}
              {mode === "changed" && changeMapData?.changed_tile_url && (
                <TileLayer
                  key={`changed-${changeMapData.changed_tile_url}`}
                  url={changeMapData.changed_tile_url}
                  maxNativeZoom={afterNativeZoom} maxZoom={HIGH_DETAIL_MAX_ZOOM}
                  opacity={opacity * 0.78}
                  attribution="Google Earth Engine"
                  pane={RESULT_PANE}
                />
              )}
              <FitToAoi aoi={aoi} />
            </MapView>
            <MapLegend
              title={mode === "destination" ? `Kelas tujuan pada piksel berubah` : `Tutupan lahan ${yearB ?? ""}`}
              entries={mode === "changed" ? [{ color: "#ff1744", label: "Area berubah" }] : afterLegend}
            />
          </div>
        </div>
      )}

      {view === "swipe" && (
        <div>
          <SwipeCompareMap
            id="lcChangeSwipeMap"
            beforeUrl={beforeTile}
            afterUrl={swipeAfterTile}
            beforeLabel={`Tutupan lahan ${yearA ?? "-"}`}
            afterLabel={mode === "changed" ? "Area berubah" : mode === "destination" ? "Kelas tujuan" : `Tutupan lahan ${yearB ?? "-"}`}
            beforeMaxNativeZoom={beforeNativeZoom}
            afterMaxNativeZoom={afterNativeZoom}
            orientation={swipeOrientation}
            onOrientationChange={setSwipeOrientation}
            opacity={opacity}
            bounds={aoi ? L.geoJSON(aoi as GeoJSON.Feature).getBounds() : undefined}
            clipGeometry={aoi as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null}
          >
            <LayerOpacityControl opacity={opacity} onChange={setOpacity} label="Opacity peta" />
            <MapClickInspector onClick={handleMapClick} />
            {aoi && <GeoJSON key={JSON.stringify(aoi.geometry)} data={aoi as GeoJSON.Feature} style={AOI_STYLE} />}
            <FitToAoi aoi={aoi} />
          </SwipeCompareMap>
          <div className="row g-2 mt-1">
            <div className="col-md-6">
              <MapLegend title={`Tutupan lahan ${yearA ?? ""}`} entries={beforeLegend} />
            </div>
            <div className="col-md-6">
              <MapLegend
                title={mode === "destination" ? `Kelas tujuan pada piksel berubah` : `Tutupan lahan ${yearB ?? ""}`}
                entries={mode === "changed" ? [{ color: "#ff1744", label: "Area berubah" }] : afterLegend}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
