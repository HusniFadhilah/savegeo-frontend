import { fmtNum, fmtPct, styleFor, HEALTH_LABEL_STYLE } from "../utils";
import type { HealthResult } from "../types";

interface Props {
  health: HealthResult;
}

/** Sub-analysis A: crop health (NDVI-based). */
export default function CropHealthCard({ health }: Props) {
  return (
    <div className="card mb-3">
      <div className="card-header">
        <i className="bi bi-heart-pulse-fill me-1" /> A. Kesehatan Tanaman
      </div>
      <div className="card-body">
        {!health.available ? (
          <div className="alert alert-secondary py-2 mb-0 small">
            Tidak tersedia{health.reason ? `: ${health.reason}` : "."}
          </div>
        ) : (
          <>
            <div className="row g-2 mb-3">
              <div className="col-6 col-md-3">
                <div className="text-muted small">Status</div>
                <span className={`fw-bold ${styleFor(HEALTH_LABEL_STYLE, health.health_label).className}`}>
                  {styleFor(HEALTH_LABEL_STYLE, health.health_label).emoji}{" "}
                  {styleFor(HEALTH_LABEL_STYLE, health.health_label).label}
                </span>
              </div>
              <div className="col-6 col-md-3">
                <div className="text-muted small">NDVI Rata-rata</div>
                <div className="fw-bold">{fmtNum(health.ndvi_mean, 4)}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="text-muted small">Perubahan vs Bulan Sebelumnya</div>
                <div className={`fw-bold ${health.change_vs_previous_month_pct != null && health.change_vs_previous_month_pct < 0 ? "text-danger" : "text-success"}`}>
                  {health.change_vs_previous_month_pct != null ? `${health.change_vs_previous_month_pct > 0 ? "+" : ""}${fmtPct(health.change_vs_previous_month_pct)}` : "-"}
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="text-muted small">Piksel Valid</div>
                <div className="fw-bold">
                  {fmtPct(health.valid_pixel_pct)} <small className="text-muted">({health.images_used} citra)</small>
                </div>
              </div>
            </div>

            <div className="row g-2 text-center mb-3">
              <div className="col-4">
                <div className="p-2 rounded" style={{ background: "#e8f5e9" }}>
                  <div className="fw-bold text-success">{fmtPct(health.healthy_pct)}</div>
                  <div className="small text-muted">Sehat</div>
                </div>
              </div>
              <div className="col-4">
                <div className="p-2 rounded" style={{ background: "#fff8e1" }}>
                  <div className="fw-bold text-warning">{fmtPct(health.moderate_pct)}</div>
                  <div className="small text-muted">Sedang</div>
                </div>
              </div>
              <div className="col-4">
                <div className="p-2 rounded" style={{ background: "#ffebee" }}>
                  <div className="fw-bold text-danger">{fmtPct(health.stressed_pct)}</div>
                  <div className="small text-muted">Stres</div>
                </div>
              </div>
            </div>

            <div className="progress mb-3" style={{ height: 10 }}>
              <div className="progress-bar bg-success" style={{ width: `${health.healthy_pct}%` }} />
              <div className="progress-bar bg-warning" style={{ width: `${health.moderate_pct}%` }} />
              <div className="progress-bar bg-danger" style={{ width: `${health.stressed_pct}%` }} />
            </div>

            {health.classification && (
              <div className="table-responsive">
                <table className="table table-striped table-hover table-sm mb-0">
                  <thead className="table-secondary">
                    <tr>
                      <th>Kelas</th>
                      <th>Luas (ha)</th>
                      <th>Persentase</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(health.classification.classes)
                      .sort((a, b) => (a[1].class_value || 0) - (b[1].class_value || 0))
                      .map(([name, info]) => (
                        <tr key={name}>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                width: 12,
                                height: 12,
                                backgroundColor: info.color,
                                marginRight: 5,
                                border: "1px solid #ccc",
                              }}
                            />
                            {name}
                          </td>
                          <td>{fmtNum(info.area, 2)}</td>
                          <td>
                            <span className="badge bg-primary">{fmtPct(info.percentage)}</span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
