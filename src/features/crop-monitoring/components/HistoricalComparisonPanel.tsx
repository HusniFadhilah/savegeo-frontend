import { fmtNum } from "../utils";
import type { HistoricalComparisonResult } from "../types";

interface Props {
  historicalComparison: HistoricalComparisonResult;
}

/** Sub-analysis I: multi-year NDVI comparison, with the backend's
 * auto-generated Indonesian narrative shown as a highlighted callout. */
export default function HistoricalComparisonPanel({ historicalComparison }: Props) {
  return (
    <div className="card mb-3">
      <div className="card-header">
        <i className="bi bi-bar-chart-line-fill me-1" /> I. Perbandingan Historis
      </div>
      <div className="card-body">
        {!historicalComparison.available ? (
          <div className="alert alert-secondary py-2 mb-0 small">Tidak tersedia.</div>
        ) : (
          <>
            {historicalComparison.narrative && (
              <div className="alert alert-info py-2 mb-3">
                <i className="bi bi-lightbulb-fill me-1" /> {historicalComparison.narrative}
              </div>
            )}
            <div className="table-responsive">
              <table className="table table-striped table-hover table-sm mb-0">
                <thead className="table-secondary">
                  <tr>
                    <th>Tahun</th>
                    <th>NDVI Rata-rata</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historicalComparison.years.map((y) => (
                    <tr key={y.year}>
                      <td>{y.year}</td>
                      <td>{y.ndvi_mean != null ? fmtNum(y.ndvi_mean, 4) : "-"}</td>
                      <td>
                        {y.available ? (
                          <span className="badge bg-success">Tersedia</span>
                        ) : (
                          <span className="badge bg-secondary">Tidak tersedia</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
