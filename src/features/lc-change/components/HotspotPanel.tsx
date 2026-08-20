import { useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import type { AoiFeature } from "@/types/map";
import type { LcDataset, LcHotspot, LcHotspotResponse } from "../types";
import { analyzeLandCoverHotspots } from "../api";
import { translateLulcClass } from "../utils";
import { RESULT_PANE } from "@/config/mapPanes";

interface Props {
  aoi: AoiFeature | null;
  dataset: LcDataset;
  yearA: number | null;
  yearB: number | null;
  startMonth: number;
  endMonth: number;
}

const AOI_STYLE = { color: "#94a3b8", weight: 1, dashArray: "4 3", fillOpacity: 0 };

function FitToHotspots({ hotspots, aoi }: { hotspots: LcHotspot[]; aoi: AoiFeature | null }) {
  const map = useMap();
  useEffect(() => {
    if (hotspots.length) {
      const group = L.geoJSON(hotspots.map((h) => h.geometry) as unknown as GeoJSON.GeoJSON[]);
      const bounds = group.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
      return;
    }
    if (aoi) {
      const bounds = L.geoJSON(aoi as GeoJSON.Feature).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
    }
  }, [hotspots, aoi, map]);
  return null;
}

function FlyToHotspot({ target }: { target: LcHotspot | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    const bounds = L.geoJSON(target.geometry as unknown as GeoJSON.GeoJSON).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
  }, [target, map]);
  return null;
}

/**
 * P0 hotspot detection: ranked, vectorized pixel-change polygons from
 * POST /analyze/landcover-hotspots (ee.Image.reduceToVectors over the same
 * from_image.neq(to_image) mask BeforeAfterMaps already renders as a flat
 * raster). Lists top-N change polygons by area with from-class -> to-class
 * transition and (Dynamic World only) confidence; clicking a row or a
 * polygon on the map flies to/highlights it.
 */
export default function HotspotPanel({ aoi, dataset, yearA, yearB, startMonth, endMonth }: Props) {
  const [minAreaHa, setMinAreaHa] = useState(1);
  const [topN, setTopN] = useState(20);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LcHotspotResponse | null>(null);
  const [selected, setSelected] = useState<LcHotspot | null>(null);

  const canRun = !!aoi && yearA != null && yearB != null;

  const run = async () => {
    if (!aoi || yearA == null || yearB == null) return;
    setRunning(true);
    setError(null);
    setSelected(null);
    try {
      const res = await analyzeLandCoverHotspots({
        aoi: { geojson: aoi },
        dataset,
        from_year: yearA,
        to_year: yearB,
        start_month: startMonth,
        end_month: endMonth,
        min_area_ha: minAreaHa,
        top_n: topN,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat hotspot perubahan.");
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  // Re-fetch is manual (not on every param tweak) - vectorization is a heavier
  // GEE call than the flat change-map tile, no point re-running on every keystroke.
  useEffect(() => {
    setResult(null);
    setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aoi, dataset, yearA, yearB, startMonth, endMonth]);

  const hotspots = result?.hotspots ?? [];
  const maxArea = useMemo(() => Math.max(1, ...hotspots.map((h) => h.area_ha)), [hotspots]);

  const polyStyle = (h: LcHotspot, isSelected: boolean) => {
    const intensity = h.area_ha / maxArea; // 0..1, biggest hotspot = most saturated
    return {
      color: isSelected ? "#facc15" : "#ff1744",
      weight: isSelected ? 3 : 1,
      fillColor: h.to_class.color,
      fillOpacity: 0.35 + intensity * 0.4,
    };
  };

  return (
    <div>
      <div className="d-flex align-items-end gap-3 flex-wrap mb-3">
        <div>
          <label className="form-label mb-1" style={{ fontSize: ".78rem" }}>
            Luas minimum (ha)
          </label>
          <input
            type="number"
            className="form-control form-control-sm"
            style={{ width: 90 }}
            min={0}
            step={0.5}
            value={minAreaHa}
            onChange={(e) => setMinAreaHa(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="form-label mb-1" style={{ fontSize: ".78rem" }}>
            Jumlah hotspot
          </label>
          <input
            type="number"
            className="form-control form-control-sm"
            style={{ width: 90 }}
            min={1}
            max={100}
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
          />
        </div>
        <button className="btn btn-warning btn-sm fw-bold" disabled={!canRun || running} onClick={run}>
          {running ? (
            <>
              <i className="fas fa-spinner fa-spin" /> Memvektorkan...
            </>
          ) : (
            <>
              <i className="fas fa-map-pin" /> Deteksi Hotspot
            </>
          )}
        </button>
        {result && (
          <span className="badge bg-secondary align-self-center">
            {result.hotspot_count} hotspot · skala vektorisasi {result.vector_scale}m
          </span>
        )}
      </div>

      {!canRun && (
        <div className="alert alert-warning py-2 mb-2" style={{ fontSize: ".82rem" }}>
          Gambar AOI dan pilih 2 tahun (di tab Matriks Transisi/Peta Perubahan) dulu.
        </div>
      )}
      {error && (
        <div className="alert alert-danger py-2 mb-2" style={{ fontSize: ".82rem" }}>
          {error}
        </div>
      )}
      {result && result.hotspot_count === 0 && (
        <div className="alert alert-info py-2 mb-2" style={{ fontSize: ".82rem" }}>
          Tidak ada perubahan yang lolos ambang luas minimum di AOI ini.
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-7">
          <MapView id="lcHotspotMap">
            <BasemapSwitcher />
            {aoi && <GeoJSON key={JSON.stringify(aoi.geometry)} data={aoi as GeoJSON.Feature} style={AOI_STYLE} pane={RESULT_PANE} />}
            {hotspots.map((h, i) => (
              <GeoJSON
                key={i}
                data={h.geometry as GeoJSON.Geometry}
                style={() => polyStyle(h, selected === h)}
                eventHandlers={{ click: () => setSelected(h) }}
              >
              </GeoJSON>
            ))}
            <FitToHotspots hotspots={hotspots} aoi={aoi} />
            <FlyToHotspot target={selected} />
          </MapView>
          <small className="text-muted d-block mt-1">
            Warna isi = kelas tujuan (to_class) · opasitas = besar relatif area · klik polygon atau baris tabel untuk fokus.
          </small>
        </div>

        <div className="col-lg-5">
          <div className="table-responsive" style={{ maxHeight: 460, overflowY: "auto" }}>
            <table className="table table-sm table-hover mb-0">
              <thead className="table-primary sticky-top">
                <tr>
                  <th>#</th>
                  <th>Luas (ha)</th>
                  <th>Transisi</th>
                  <th>Keyakinan</th>
                </tr>
              </thead>
              <tbody>
                {hotspots.map((h, i) => (
                  <tr
                    key={i}
                    className={selected === h ? "table-warning" : ""}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelected(h)}
                  >
                    <td>{i + 1}</td>
                    <td className="fw-bold">{h.area_ha.toLocaleString("id-ID")}</td>
                    <td style={{ fontSize: ".78rem" }}>
                      <span className="badge" style={{ background: h.from_class.color, color: "#fff" }}>
                        {translateLulcClass(h.from_class.label)}
                      </span>{" "}
                      <i className="bi bi-arrow-right" />{" "}
                      <span className="badge" style={{ background: h.to_class.color, color: "#fff" }}>
                        {translateLulcClass(h.to_class.label)}
                      </span>
                    </td>
                    <td>
                      {h.confidence != null ? (
                        <span className={`badge ${h.confidence >= 0.6 ? "bg-success" : h.confidence >= 0.4 ? "bg-warning text-dark" : "bg-danger"}`}>
                          {(h.confidence * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {result && hotspots.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted py-3">
                      Tidak ada hotspot.
                    </td>
                  </tr>
                )}
                {!result && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted py-3">
                      Klik "Deteksi Hotspot" untuk memuat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!result?.confidence_available && result && (
            <small className="text-muted d-block mt-2">
              <i className="bi bi-info-circle" /> Dataset {result.dataset_name} tidak punya sumber confidence per-piksel
              (hanya Dynamic World yang punya). Kolom keyakinan kosong, bukan galat.
            </small>
          )}
        </div>
      </div>
    </div>
  );
}
