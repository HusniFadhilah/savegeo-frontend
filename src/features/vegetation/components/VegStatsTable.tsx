import { Bar } from "react-chartjs-2";
import { useBilingualCopy } from "@/hooks/useBilingualCopy";
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
  const c = useBilingualCopy();
  const entries = Object.entries(result.indices || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const skipped = result.skipped_indices ?? [];
  if (!entries.length && !skipped.length) return null;
  if (!entries.length) {
    return (
      <div className="alert alert-warning mt-4 py-2 small">
        <strong>{c("Semua indeks gagal dihitung.", "All indices failed to calculate.")}</strong>
        <ul className="mb-0 mt-1">
          {skipped.map(({ index, reason }) => <li key={index}>{index}: {reason}</li>)}
        </ul>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {skipped.length > 0 && (
        <div className="alert alert-warning py-2 small">
          <strong>{c("Beberapa indeks tidak berhasil dihitung:", "Some indices could not be calculated:")}</strong>
          <ul className="mb-0 mt-1">
            {skipped.map(({ index, reason }) => <li key={index}>{index}: {reason}</li>)}
          </ul>
        </div>
      )}
      {result.satellite && (
        <div className="alert alert-light border py-2 mb-2 d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: ".8rem" }}>
          <i className="bi bi-camera-fill text-muted" />
          <span>
            {c("Citra dari", "Imagery from")} <strong>{result.satellite.name}</strong> ({result.satellite.provider}) ·{" "}
            {result.satellite.resolution_label} · {c("kunjungan ulang", "revisit")} {result.satellite.revisit_days} {c("hari", "days")}
            {result.data_quality?.valid_pixel_pct != null && (
              <>
                {" "}
                ·{" "}
                <span className={result.data_quality.valid_pixel_pct >= 80 ? "text-success" : result.data_quality.valid_pixel_pct >= 50 ? "text-warning" : "text-danger"}>
                  {result.data_quality.valid_pixel_pct.toFixed(1)}% {c("bebas awan", "cloud-free")}
                </span>
              </>
            )}
          </span>
          {typeof result.collection_size === "number" && (
            <span className="badge bg-secondary ms-auto">{result.collection_size} {c("citra", "scenes")}</span>
          )}
        </div>
      )}
      <div className="table-responsive">
      <table className="table table-striped table-hover">
        <thead className="table-primary">
          <tr>
            <th>{c("Indeks", "Index")}</th>
            <th>{c("Minimum", "Min")}</th>
            <th>{c("Rata-rata", "Mean")}</th>
            <th>{c("Maksimum", "Max")}</th>
            <th>{c("Simpangan baku", "Std. dev.")}</th>
            <th>{c("Deskripsi", "Description")}</th>
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
            <i className="bi bi-bar-chart-fill me-1" /> {c("Perbandingan minimum / rata-rata / maksimum per indeks", "Minimum / mean / maximum by index")}
          </h6>
          <div style={{ height: Math.max(220, entries.length * 42) }}>
            <Bar
              data={{
                labels: entries.map(([index]) => index),
                datasets: [
                  { label: c("Minimum", "Min"), data: entries.map(([, s]) => s.min ?? 0), backgroundColor: "rgba(148,163,184,0.75)" },
                  { label: c("Rata-rata", "Mean"), data: entries.map(([, s]) => s.mean ?? 0), backgroundColor: "rgba(46,125,50,0.85)" },
                  { label: c("Maksimum", "Max"), data: entries.map(([, s]) => s.max ?? 0), backgroundColor: "rgba(255,167,38,0.8)" },
                ],
              }}
              options={{
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "top" } },
                scales: { x: { title: { display: true, text: c("Nilai indeks", "Index value") } } },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
