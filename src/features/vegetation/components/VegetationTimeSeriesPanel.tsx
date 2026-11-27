import { Line } from "react-chartjs-2";
import { useBilingualCopy } from "@/hooks/useBilingualCopy";
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import type { VegetationTimeSeriesResponse } from "@/features/vegetation/types";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

interface Props {
  result: VegetationTimeSeriesResponse;
}

/**
 * P0 "time-series & timelapse" for vegetation: monthly index values across
 * one year, from POST /timeseries (existed in the backend but was never
 * called by any frontend caller until now).
 */
function LegacyVegetationTimeSeriesPanel({ result }: Props) {
  const c = useBilingualCopy();
  const points = result.data.filter((p) => p.value != null);
  const hasData = points.length > 0;

  return (
    <div className="card mt-3">
      <div className="card-header">
        <i className="bi bi-graph-up me-1" /> {c("Deret waktu bulanan", "Monthly time series")} {result.index} ({result.year})
      </div>
      <div className="card-body">
        {!hasData && (
          <div className="alert alert-warning py-2 mb-0" style={{ fontSize: ".85rem" }}>
            {c("Tidak ada cukup citra bebas awan pada bulan mana pun tahun ini untuk AOI dan ambang awan ini.", "There are not enough cloud-free images in any month this year for this AOI and cloud threshold.")}
          </div>
        )}
        {hasData && (
          <>
            <div style={{ height: 300 }}>
              <Line
                data={{
                  labels: result.data.map((p) => p.period.slice(5)),
                  datasets: [
                    {
                      label: result.index ?? "Indeks",
                      data: result.data.map((p) => p.value),
                      borderColor: "#2e7d32",
                      backgroundColor: "#2e7d3255",
                      spanGaps: true,
                      tension: 0.25,
                      pointRadius: 3,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { title: { display: true, text: c("Bulan", "Month") } },
                    y: { title: { display: true, text: result.index ?? c("Nilai indeks", "Index value") } },
                  },
                }}
              />
            </div>
            {result.satellite && (
              <small className="text-muted d-block mt-2">
                {c("Citra dari", "Imagery from")} <strong>{result.satellite.name}</strong> ({result.satellite.provider}) · {c("skala", "scale")} {result.scale} m
              </small>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const COLORS = ["#2e7d32", "#1565c0", "#ef6c00", "#8e24aa", "#00838f", "#c62828", "#6d4c41", "#5e35b1"];

/** Monthly chart for multiple vegetation indices and sensor reflectance bands. */
export default function VegetationTimeSeriesPanel({ result }: Props) {
  const c = useBilingualCopy();
  if (!result.series) return <LegacyVegetationTimeSeriesPanel result={result} />;
  const series = result.series ?? (result.index ? {
    [result.index]: { kind: "index" as const, unit: "index" as const, data: result.data },
  } : {});
  const periods = result.periods?.length ? result.periods : result.data.map((point) => point.period);
  const groups = [
    { kind: "index" as const, title: c("Indeks vegetasi", "Vegetation indices"), unit: c("Nilai indeks", "Index value"), entries: Object.entries(series).filter(([, metric]) => metric.kind === "index") },
    { kind: "band" as const, title: c("Band spektral", "Spectral bands"), unit: c("Reflektansi permukaan", "Surface reflectance"), entries: Object.entries(series).filter(([, metric]) => metric.kind === "band") },
  ].filter((group) => group.entries.length > 0);
  const hasData = Object.values(series).some((metric) => metric.data.some((point) => point.value != null));
  const unavailable = Object.entries(series).filter(([, metric]) => metric.availability);

  return (
    <div className="card mt-3">
      <div className="card-header">
        <i className="bi bi-graph-up me-1" /> {c("Deret waktu bulanan", "Monthly time series")} ({result.year})
        <span className="text-muted ms-2 small">{periods[0]?.slice(5)}–{periods.at(-1)?.slice(5)}</span>
      </div>
      <div className="card-body">
        {!hasData && (
          <div className="alert alert-warning py-2 mb-0" style={{ fontSize: ".85rem" }}>
            {c("Tidak ada data bebas awan pada rentang bulan terpilih. Bulan tanpa citra tetap ditampilkan sebagai nilai kosong.", "No cloud-free data is available in the selected month range. Months without imagery remain visible as empty values.")}
          </div>
        )}
        {unavailable.length > 0 && (
          <div className="alert alert-warning py-2 small">
            {c("Tidak tersedia untuk sensor ini:", "Unavailable for this sensor:")} {unavailable.map(([name]) => name).join(", ")}.
          </div>
        )}
        {hasData && groups.map((group) => (
          <section key={group.kind} className="mb-3">
            <h6 className="mb-2">{group.title}</h6>
            <div style={{ height: 300 }}>
              <Line
                data={{
                  labels: periods.map((period) => period.slice(5)),
                  datasets: group.entries.map(([name, metric], index) => {
                    const values = new Map(metric.data.map((point) => [point.period, point.value]));
                    return {
                      label: name,
                      data: periods.map((period) => values.get(period) ?? null),
                      borderColor: COLORS[index % COLORS.length],
                      backgroundColor: `${COLORS[index % COLORS.length]}33`,
                      spanGaps: false,
                      tension: 0.25,
                      pointRadius: 2,
                    };
                  }),
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: group.entries.length > 1, position: "bottom" } },
                  scales: {
                    x: { title: { display: true, text: c("Bulan", "Month") } },
                    y: { title: { display: true, text: group.unit } },
                  },
                }}
              />
            </div>
          </section>
        ))}
        {(result.period_errors?.length ?? 0) > 0 && (
          <div className="alert alert-warning py-2 small mb-2">
            {c(`Beberapa bulan gagal diproses (${result.period_errors?.join(", ")}); bulan lain tetap ditampilkan.`, `Some months failed to process (${result.period_errors?.join(", ")}); the other months are still shown.`)}
          </div>
        )}
        {result.satellite && (
          <small className="text-muted d-block mt-2">
            {c("Citra dari", "Imagery from")} <strong>{result.satellite.name}</strong> ({result.satellite.provider}) · {c("skala", "scale")} {result.scale} m.
            {c("Band spektral menunjukkan reflektansi permukaan. Grafik band dan indeks dipisah karena satuannya berbeda.", "Spectral bands show surface reflectance. Band and index charts are separated because their units differ.")}
          </small>
        )}
      </div>
    </div>
  );
}
