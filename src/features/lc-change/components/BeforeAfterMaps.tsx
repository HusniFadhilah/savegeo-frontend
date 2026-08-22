import { useEffect, useState } from "react";
import { GeoJSON, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import MapLegend from "@/components/map/MapLegend";
import SwipeCompareMap, { type SwipeOrientation } from "@/components/map/SwipeCompareMap";
import type { AoiFeature, MapLegendEntry } from "@/types/map";
import type { ChangeMapMode, LcChangeMapResponse, LcDataset, LcYearResult } from "../types";
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
}: Props) {
  const beforeTile = (yearA != null ? yearData[yearA]?.tile_url : null) ?? changeMapData?.from_tile_url ?? null;
  const afterRawTile = (yearB != null ? yearData[yearB]?.tile_url : null) ?? changeMapData?.to_tile_url ?? null;
  const afterTile = mode === "destination" ? changeMapData?.destination_tile_url ?? null : afterRawTile;

  const beforeLegend = classLegend(yearA != null ? yearData[yearA]?.classes : undefined);
  const afterLegend = classLegend(yearB != null ? yearData[yearB]?.classes : undefined);

  const [view, setView] = useState<ViewMode>("swipe");
  const [swipeOrientation, setSwipeOrientation] = useState<SwipeOrientation>("vertical");

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
              {aoi && <GeoJSON key={JSON.stringify(aoi.geometry)} data={aoi as GeoJSON.Feature} style={AOI_STYLE} />}
              {beforeTile && <TileLayer url={beforeTile} opacity={0.88} attribution="Google Earth Engine" pane={RESULT_PANE} />}
              <FitToAoi aoi={aoi} />
            </MapView>
            <MapLegend title={`Tutupan lahan ${yearA ?? ""}`} entries={beforeLegend} />
          </div>
          <div className="col-md-6">
            <MapView id="lcChangeAfterMap">
              <BasemapSwitcher />
              {aoi && <GeoJSON key={JSON.stringify(aoi.geometry)} data={aoi as GeoJSON.Feature} style={AOI_STYLE} />}
              {afterTile && (
                <TileLayer
                  key={`${mode}-${afterTile}`}
                  url={afterTile}
                  opacity={mode === "destination" ? 0.9 : 0.88}
                  attribution="Google Earth Engine"
                  pane={RESULT_PANE}
                />
              )}
              {mode === "changed" && changeMapData?.changed_tile_url && (
                <TileLayer
                  key={`changed-${changeMapData.changed_tile_url}`}
                  url={changeMapData.changed_tile_url}
                  opacity={0.78}
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
            afterUrl={afterTile}
            beforeLabel={`Tutupan lahan ${yearA ?? "-"}`}
            afterLabel={`Tutupan lahan ${yearB ?? "-"}`}
            orientation={swipeOrientation}
            onOrientationChange={setSwipeOrientation}
          >
            {aoi && <GeoJSON key={JSON.stringify(aoi.geometry)} data={aoi as GeoJSON.Feature} style={AOI_STYLE} pane={RESULT_PANE} />}
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
