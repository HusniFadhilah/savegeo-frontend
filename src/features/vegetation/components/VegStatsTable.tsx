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
    <div className="table-responsive mt-4">
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
  );
}
