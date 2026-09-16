import { useEffect, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import { useI18nStore } from "@/hooks/useI18nStore";
import { interpolate } from "@/i18n/translations";
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
import MapLegend from "@/components/map/MapLegend";
import type { CarbonDeltaResponse } from "@/features/carbon/types";
import { RESULT_PANE } from "@/config/mapPanes";
import type { MapLegendEntry } from "@/types/map";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

interface Props {
  result: CarbonDeltaResponse;
  zoom: number;
  center: [number, number];
  visMin: number;
  visMax: number;
  visPalette: string[];
  legendBins: number;
}

const DIRECTION_META: Record<string, { key: string; icon: string; className: string }> = {
  increase: { key: "carbon.ts.directionIncrease", icon: "bi-arrow-up-circle-fill", className: "text-success" },
  decrease: { key: "carbon.ts.directionDecrease", icon: "bi-arrow-down-circle-fill", className: "text-danger" },
  stable: { key: "carbon.ts.directionStable", icon: "bi-dash-circle-fill", className: "text-muted" },
};

function normalizeHex(color: string) {
  const trimmed = color.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(trimmed) ? `#${trimmed}` : "#2e7d32";
}

function hexToRgb(color: string): [number, number, number] {
  const hex = normalizeHex(color).slice(1);
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;
}

function buildLegendColors(palette: string[], requestedBins: number) {
  const base = palette.map(normalizeHex);
  const bins = Math.min(Math.max(Number.isFinite(requestedBins) ? Math.round(requestedBins) : base.length, 2), 20);
  if (base.length === bins) return base;
  if (base.length === 1) return Array.from({ length: bins }, () => base[0]);

  return Array.from({ length: bins }, (_, i) => {
    const t = bins === 1 ? 0 : i / (bins - 1);
    const scaled = t * (base.length - 1);
    const left = Math.floor(scaled);
    const right = Math.min(left + 1, base.length - 1);
    const local = scaled - left;
    const a = hexToRgb(base[left]);
    const b = hexToRgb(base[right]);
    return rgbToHex([
      a[0] + (b[0] - a[0]) * local,
      a[1] + (b[1] - a[1]) * local,
      a[2] + (b[2] - a[2]) * local,
    ]);
  });
}

function buildCarbonLegend(visMin: number, visMax: number, visPalette: string[], legendBins: number): MapLegendEntry[] {
  const palette = visPalette.length ? visPalette : ["#440154", "#414487", "#2a788e", "#22a884", "#7ad151", "#fde725"];
  const colors = buildLegendColors(palette, legendBins);
  const safeMax = visMax > visMin ? visMax : visMin + 1;
  const n = colors.length;
  const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toString() : Number(v.toFixed(2)).toString());
  return colors.map((color, i) => {
    const from = visMin + (i * (safeMax - visMin)) / n;
    const to = visMin + ((i + 1) * (safeMax - visMin)) / n;
    return {
      color,
      label: i === n - 1 ? `${fmt(from)} - ${fmt(visMax)}` : `${fmt(from)} - ${fmt(to)}`,
    };
  });
}

/**
 * P0 "time-series & timelapse": grafik densitas/total karbon per tahun +
 * tabel delta tahun-ke-tahun (dari POST /analyze/carbon-delta, yang sudah
 * ada di backend tapi belum pernah dipanggil frontend), plus timelapse
 * playback kalau responsnya bawa tile_url per tahun (include_tiles:true).
 */
export default function CarbonTimeSeriesPanel({ result, zoom, center, visMin, visMax, visPalette, legendBins }: Props) {
  const t = useI18nStore((s) => s.t);
  const language = useI18nStore((s) => s.language);
  const locale = language === "id" ? "id-ID" : "en-US";
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
  const visualization = result.visualization;
  const legendEntries = buildCarbonLegend(
    visualization?.min ?? visMin,
    visualization?.max ?? visMax,
    visualization?.palette?.length ? visualization.palette : visPalette,
    visualization?.legend_bins ?? legendBins,
  );

  return (
    <div className="card mt-3">
      <div className="card-header">
        <i className="bi bi-clock-history me-1" /> {t("carbon.ts.title")} ({summary.start_year}–{summary.end_year})
      </div>
      <div className="card-body">
        <div className="row g-2 mb-3">
          <div className="col-md-4">
            <div className="cs-card">
              <div className="cs-card-body py-2">
                <span className="cs-config-label d-block">{t("carbon.ts.netDeltaTotal")}</span>
                <span className={`cs-config-value fs-5 ${summary.net_delta_total_carbon_tons >= 0 ? "text-success" : "text-danger"}`}>
                  {summary.net_delta_total_carbon_tons >= 0 ? "+" : ""}
                  {summary.net_delta_total_carbon_tons.toLocaleString(locale)} ton
                </span>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="cs-card">
              <div className="cs-card-body py-2">
                <span className="cs-config-label d-block">{t("carbon.ts.netDeltaCo2")}</span>
                <span className={`cs-config-value fs-5 ${summary.net_delta_co2e_tons >= 0 ? "text-success" : "text-danger"}`}>
                  {summary.net_delta_co2e_tons >= 0 ? "+" : ""}
                  {summary.net_delta_co2e_tons.toLocaleString(locale)} ton CO₂e
                </span>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="cs-card">
              <div className="cs-card-body py-2">
                <span className="cs-config-label d-block">{t("carbon.ts.pointsAnalyzed")}</span>
                <span className="cs-config-value fs-5">{series.length} {t("carbon.ts.years")}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="table-responsive mb-3">
          <table className="table table-sm mb-0" style={{ fontSize: ".8rem" }}>
            <thead>
              <tr className="text-muted">
                <th>{t("carbon.ts.year")}</th>
                <th>{t("carbon.ts.density")}</th>
                <th>{t("carbon.ts.imagesUsed")}</th>
                <th>{t("carbon.ts.cloudFreePct")}</th>
                <th>{t("carbon.ts.source")}</th>
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
                        <span className="text-warning" title={t("carbon.ts.gapFilledTitle")}>
                          <i className="bi bi-exclamation-triangle" /> {t("carbon.ts.gapFilled")}
                        </span>
                      ) : (
                        <span className="text-success">
                          <i className="bi bi-check-circle" /> {t("carbon.ts.mainPeriod")}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <small className="text-muted d-block mt-1">
            <i className="bi bi-info-circle" /> {t("carbon.ts.lowQualityHint")}
          </small>
        </div>

        <div style={{ height: 320 }}>
          <Line
            data={{
              labels: series.map((p) => p.year),
              datasets: [
                {
                  label: t("carbon.ts.chartDensityLabel"),
                  data: series.map((p) => p.mean_density),
                  borderColor: "#2e7d32",
                  backgroundColor: "#2e7d3255",
                  yAxisID: "y",
                  tension: 0.2,
                  pointRadius: 3,
                },
                {
                  label: t("carbon.ts.chartTotalLabel"),
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
                x: { title: { display: true, text: t("carbon.ts.year") } },
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
                <th>{t("carbon.ts.period")}</th>
                <th>{t("carbon.ts.direction")}</th>
                <th>{t("carbon.ts.deltaTotalCarbon")}</th>
                <th>{t("carbon.ts.deltaPercent")}</th>
                <th>{t("carbon.ts.deltaDensity")}</th>
              </tr>
            </thead>
            <tbody>
              {deltas.map((d) => {
                const dir = DIRECTION_META[d.direction] ?? DIRECTION_META.stable;
                return (
                  <tr key={`${d.from_year}-${d.to_year}`}>
                    <td>
                      {d.from_year} → {d.to_year}
                    </td>
                    <td className={dir.className}>
                      <i className={`bi ${dir.icon}`} /> {t(dir.key)}
                    </td>
                    <td>{d.delta_total_carbon_tons.toLocaleString(locale)} ton</td>
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
                <i className={`bi ${playing ? "bi-pause-fill" : "bi-play-fill"}`} /> {playing ? t("carbon.ts.pause") : t("carbon.ts.playTimelapse")}
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
            <div className="carbon-timelapse-map-shell">
              <MapView id="carbonTimelapseMap" center={center} zoom={zoom} historicalDate={series[frame]?.year != null ? `${series[frame].year}-12-31` : undefined}>
                <BasemapSwitcher />
                {series.map((point, idx) =>
                  point.tile_url ? (
                    <TileLayer
                      key={`${point.year}-${point.tile_url}`}
                      url={point.tile_url}
                      opacity={idx === frame ? 0.85 : 0}
                      zIndex={idx === frame ? 30 : 10}
                      pane={RESULT_PANE}
                      attribution="Google Earth Engine"
                      keepBuffer={4}
                      updateWhenIdle={false}
                      updateWhenZooming
                    />
                  ) : null,
                )}
              </MapView>
              {activeTile && (
                <div className="carbon-timelapse-legend">
                  <MapLegend title="Densitas Karbon (Mg/ha)" entries={legendEntries} />
                </div>
              )}
            </div>
            <small className="text-muted d-block mt-1">
              {interpolate(t("carbon.ts.densityAt"), { year: series[frame]?.year ?? "" })}: {series[frame]?.mean_density} Mg/ha {t("carbon.ts.avgSuffix")}
            </small>
          </div>
        )}
        {!hasTiles && (
          <small className="text-muted d-block mt-2">
            <i className="bi bi-info-circle" /> {t("carbon.ts.noTilesHint")}
          </small>
        )}
      </div>
    </div>
  );
}
