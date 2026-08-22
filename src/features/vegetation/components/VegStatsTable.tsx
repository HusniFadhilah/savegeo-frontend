import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import type { VegetationResult } from "@/features/vegetation/types";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface Props {
  result: VegetationResult;
}

function fmt(v: number | undefined, digits = 4): string {
  return Number.isFinite(v) ? Number(v).toFixed(digits) : "-";
}

/** Ported from main.js displayStatsTable(): vegetation index min/mean/max/std table. */
export default function VegStatsTable({ result }: Props) {
  const entries = Object.entries(result.indices || {}).sort((a, b) => a[0].localeCompare(b[0]));
  if (!entries.length) return null;

  return (
    <div className="mt-4">
      {result.satellite && (
        <div className="alert alert-light border py-2 mb-2 d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: ".8rem" }}>
          <i className="bi bi-camera-fill text-muted" />
          <span>
            Citra dari <strong>{result.satellite.name}</strong> ({result.satellite.provider}) ·{" "}
            {result.satellite.resolution_label} · revisit {result.satellite.revisit_days} hari
            {result.data_quality?.valid_pixel_pct != null && (
              <>
                {" "}
                ·{" "}
                <span className={result.data_quality.valid_pixel_pct >= 80 ? "text-success" : result.data_quality.valid_pixel_pct >= 50 ? "text-warning" : "text-danger"}>
                  {result.data_quality.valid_pixel_pct.toFixed(1)}% bebas awan
                </span>
              </>
            )}
          </span>
          {typeof result.collection_size === "number" && (
            <span className="badge bg-secondary ms-auto">{result.collection_size} scene</span>
          )}
        </div>
      )}
      <div className="table-responsive">
      <table className="table table-striped table-hover">
        <thead className="table-primary">
          <tr>
            <th>Indeks</th>
            <th>Min</th>
            <th>Mean</th>
            <th>Max</th>
            <th>Std Dev</th>
            <th>Deskripsi</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([index, stats]) => (
            <tr key={index}>
              <td>
                <strong>{index}</strong>
              </td>
              <td>{fmt(stats.min)}</td>
              <td>
                <span className="badge bg-primary">{fmt(stats.mean)}</span>
              </td>
              <td>{fmt(stats.max)}</td>
              <td>{fmt(stats.std_dev)}</td>
              <td>{stats.description ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <div className="card mt-3">
        <div className="card-body">
          <h6 className="mb-2">
            <i className="bi bi-bar-chart-fill me-1" /> Perbandingan Min / Mean / Max per Indeks
          </h6>
          <div style={{ height: Math.max(220, entries.length * 42) }}>
            <Bar
              data={{
                labels: entries.map(([index]) => index),
                datasets: [
                  { label: "Min", data: entries.map(([, s]) => s.min ?? 0), backgroundColor: "rgba(148,163,184,0.75)" },
                  { label: "Mean", data: entries.map(([, s]) => s.mean ?? 0), backgroundColor: "rgba(46,125,50,0.85)" },
                  { label: "Max", data: entries.map(([, s]) => s.max ?? 0), backgroundColor: "rgba(255,167,38,0.8)" },
                ],
              }}
              options={{
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "top" } },
                scales: { x: { title: { display: true, text: "Nilai indeks" } } },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
