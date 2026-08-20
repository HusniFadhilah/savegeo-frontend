import { useEffect, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { TileLayer } from "react-leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import type { CarbonDeltaResponse } from "@/features/carbon/types";
import { RESULT_PANE } from "@/config/mapPanes";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

interface Props {
  result: CarbonDeltaResponse;
  zoom: number;
  center: [number, number];
}

const DIRECTION_LABEL: Record<string, { label: string; icon: string; className: string }> = {
  increase: { label: "Naik", icon: "bi-arrow-up-circle-fill", className: "text-success" },
  decrease: { label: "Turun", icon: "bi-arrow-down-circle-fill", className: "text-danger" },
  stable: { label: "Stabil", icon: "bi-dash-circle-fill", className: "text-muted" },
};

/**
 * P0 "time-series & timelapse": grafik densitas/total karbon per tahun +
 * tabel delta tahun-ke-tahun (dari POST /analyze/carbon-delta, yang sudah
 * ada di backend tapi belum pernah dipanggil frontend), plus timelapse
 * playback kalau responsnya bawa tile_url per tahun (include_tiles:true).
 */
export default function CarbonTimeSeriesPanel({ result, zoom, center }: Props) {
  const { series, deltas, summary } = result;
  const hasTiles = series.some((p) => p.tile_url);

  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (playing && hasTiles) {
      timerRef.current = setInterval(() => {
        setFrame((f) => (f + 1) % series.length);
      }, 1200);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, hasTiles, series.length]);

  useEffect(() => {
    setFrame(0);
    setPlaying(false);
  }, [series]);

  const activeTile = series[frame]?.tile_url;

  return (
    <div className="card mt-3">
      <div className="card-header">
        <i className="bi bi-clock-history me-1" /> Time-Series Stok Karbon ({summary.start_year}–{summary.end_year})
      </div>
      <div className="card-body">
        <div className="row g-2 mb-3">
          <div className="col-md-4">
            <div className="cs-card">
              <div className="cs-card-body py-2">
                <span className="cs-config-label d-block">Perubahan Bersih Total</span>
                <span className={`cs-config-value fs-5 ${summary.net_delta_total_carbon_tons >= 0 ? "text-success" : "text-danger"}`}>
                  {summary.net_delta_total_carbon_tons >= 0 ? "+" : ""}
                  {summary.net_delta_total_carbon_tons.toLocaleString("id-ID")} ton
                </span>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="cs-card">
              <div className="cs-card-body py-2">
                <span className="cs-config-label d-block">Setara CO₂ Bersih</span>
                <span className={`cs-config-value fs-5 ${summary.net_delta_co2e_tons >= 0 ? "text-success" : "text-danger"}`}>
                  {summary.net_delta_co2e_tons >= 0 ? "+" : ""}
                  {summary.net_delta_co2e_tons.toLocaleString("id-ID")} ton CO₂e
                </span>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="cs-card">
              <div className="cs-card-body py-2">
                <span className="cs-config-label d-block">Titik Waktu Dianalisis</span>
                <span className="cs-config-value fs-5">{series.length} tahun</span>
              </div>
            </div>
          </div>
        </div>

        <div className="table-responsive mb-3">
          <table className="table table-sm mb-0" style={{ fontSize: ".8rem" }}>
            <thead>
              <tr className="text-muted">
                <th>Tahun</th>
                <th>Densitas</th>
                <th>Citra Dipakai</th>
                <th>% Bebas Awan</th>
                <th>Sumber</th>
              </tr>
            </thead>
            <tbody>
              {series.map((p) => {
                const lowQuality = p.valid_pixel_pct != null && p.valid_pixel_pct < 70;
                return (
                  <tr key={p.year} className={lowQuality ? "table-warning" : ""}>
                    <td className="fw-bold">{p.year}</td>
                    <td>{p.mean_density} Mg/ha</td>
                    <td>{p.images_used ?? "-"} scene</td>
                    <td className={lowQuality ? "text-danger fw-bold" : ""}>
                      {p.valid_pixel_pct != null ? `${p.valid_pixel_pct}%` : "-"}
                    </td>
                    <td>
                      {p.gap_filled ? (
                        <span className="text-warning" title="Sebagian piksel diisi dari jendela +/-90 hari karena awan tebal di periode utama">
                          <i className="bi bi-exclamation-triangle" /> gap-filled
                        </span>
                      ) : (
                        <span className="text-success">
                          <i className="bi bi-check-circle" /> periode utama
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <small className="text-muted d-block mt-1">
            <i className="bi bi-info-circle" /> Baris kuning = kualitas citra rendah tahun itu (&lt;70% bebas awan) -
            cek ini dulu sebelum baca kenaikan/penurunan sebagai perubahan karbon yang nyata.
          </small>
        </div>

        <div style={{ height: 320 }}>
          <Line
            data={{
              labels: series.map((p) => p.year),
              datasets: [
                {
                  label: "Densitas Rata-rata (Mg/ha)",
                  data: series.map((p) => p.mean_density),
                  borderColor: "#2e7d32",
                  backgroundColor: "#2e7d3255",
                  yAxisID: "y",
                  tension: 0.2,
                  pointRadius: 3,
                },
                {
                  label: "Total Karbon (ton)",
                  data: series.map((p) => p.total_carbon_tons),
                  borderColor: "#fb8c00",
                  backgroundColor: "#fb8c0055",
                  yAxisID: "y1",
                  tension: 0.2,
                  pointRadius: 3,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: "index", intersect: false },
              plugins: { legend: { position: "bottom" } },
              scales: {
                x: { title: { display: true, text: "Tahun" } },
                y: { type: "linear", position: "left", title: { display: true, text: "Mg/ha" } },
                y1: { type: "linear", position: "right", title: { display: true, text: "ton" }, grid: { drawOnChartArea: false } },
              },
            }}
          />
        </div>

        <div className="table-responsive mt-3">
          <table className="table table-sm table-striped mb-0">
            <thead className="table-primary">
              <tr>
                <th>Periode</th>
                <th>Arah</th>
                <th>Δ Total Karbon</th>
                <th>Δ %</th>
                <th>Δ Densitas</th>
              </tr>
            </thead>
            <tbody>
              {deltas.map((d) => {
                const dir = DIRECTION_LABEL[d.direction] ?? DIRECTION_LABEL.stable;
                return (
                  <tr key={`${d.from_year}-${d.to_year}`}>
                    <td>
                      {d.from_year} → {d.to_year}
                    </td>
                    <td className={dir.className}>
                      <i className={`bi ${dir.icon}`} /> {dir.label}
                    </td>
                    <td>{d.delta_total_carbon_tons.toLocaleString("id-ID")} ton</td>
                    <td>{d.delta_total_carbon_percent}%</td>
                    <td>{d.delta_mean_density} Mg/ha</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {hasTiles && (
          <div className="mt-3">
            <div className="d-flex align-items-center gap-2 mb-2">
              <button
                type="button"
                className="btn btn-sm btn-warning fw-bold"
                onClick={() => setPlaying((p) => !p)}
              >
                <i className={`bi ${playing ? "bi-pause-fill" : "bi-play-fill"}`} /> {playing ? "Jeda" : "Putar Timelapse"}
              </button>
              <input
                type="range"
                className="form-range flex-grow-1"
                min={0}
                max={series.length - 1}
                value={frame}
                onChange={(e) => {
                  setPlaying(false);
                  setFrame(Number(e.target.value));
                }}
              />
              <span className="badge bg-secondary" style={{ minWidth: 48 }}>
                {series[frame]?.year}
              </span>
            </div>
            <MapView id="carbonTimelapseMap" center={center} zoom={zoom}>
              <BasemapSwitcher />
              {activeTile && <TileLayer key={activeTile} url={activeTile} opacity={0.85} pane={RESULT_PANE} attribution="Google Earth Engine" />}
            </MapView>
            <small className="text-muted d-block mt-1">
              Densitas karbon {series[frame]?.year}: {series[frame]?.mean_density} Mg/ha rata-rata
            </small>
          </div>
        )}
        {!hasTiles && (
          <small className="text-muted d-block mt-2">
            <i className="bi bi-info-circle" /> Timelapse peta tidak diminta untuk run ini (aktifkan opsi "sertakan
            tile" untuk memutar citra per tahun - lebih lambat karena generate tile tiap titik waktu).
          </small>
        )}
      </div>
    </div>
  );
}
