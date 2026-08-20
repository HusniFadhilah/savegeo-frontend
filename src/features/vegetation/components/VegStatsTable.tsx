import type { VegetationResult } from "@/features/vegetation/types";

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
    </div>
  );
}
