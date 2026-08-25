import { fmtNum, fmtPct, styleFor, HEALTH_LABEL_STYLE } from "../utils";
import type { HealthResult } from "../types";

interface Props {
  health: HealthResult;
}

/** Sub-analysis A: crop health (NDVI-based). */
export default function CropHealthCard({ health }: Props) {
  return (
    <div className="card mb-3 cm-panel-card cm-health-card">
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
            <div className="cm-health-metrics">
              <div className="cm-mini-stat">
                <span>Status</span>
                <strong className={styleFor(HEALTH_LABEL_STYLE, health.health_label).className}>
                  <span
                    className="cm-status-dot"
                    style={{ backgroundColor: styleFor(HEALTH_LABEL_STYLE, health.health_label).color }}
                  />
                  {styleFor(HEALTH_LABEL_STYLE, health.health_label).label}
                </strong>
              </div>
              <div className="cm-mini-stat">
                <span>NDVI Rata-rata</span>
                <strong>{fmtNum(health.ndvi_mean, 4)}</strong>
              </div>
              <div className="cm-mini-stat">
                <span>Perubahan vs Bulan Sebelumnya</span>
                <strong className={health.change_vs_previous_month_pct != null && health.change_vs_previous_month_pct < 0 ? "text-danger" : "text-success"}>
                  {health.change_vs_previous_month_pct != null ? `${health.change_vs_previous_month_pct > 0 ? "+" : ""}${fmtPct(health.change_vs_previous_month_pct)}` : "-"}
                </strong>
              </div>
              <div className="cm-mini-stat">
                <span>Piksel Valid</span>
                <strong>
                  {fmtPct(health.valid_pixel_pct)} <small className="text-muted">({health.images_used} citra)</small>
                </strong>
              </div>
            </div>

            <div className="cm-health-distribution">
              <div className="cm-health-segment cm-health-segment-good">
                <strong>{fmtPct(health.healthy_pct)}</strong>
                <span>Sehat</span>
              </div>
              <div className="cm-health-segment cm-health-segment-mid">
                <strong>{fmtPct(health.moderate_pct)}</strong>
                <span>Sedang</span>
              </div>
              <div className="cm-health-segment cm-health-segment-bad">
                <strong>{fmtPct(health.stressed_pct)}</strong>
                <span>Stres</span>
              </div>
            </div>

            <div className="progress cm-health-progress mb-3">
              <div className="progress-bar bg-success" style={{ width: `${health.healthy_pct}%` }} />
              <div className="progress-bar bg-warning" style={{ width: `${health.moderate_pct}%` }} />
              <div className="progress-bar bg-danger" style={{ width: `${health.stressed_pct}%` }} />
            </div>

            {health.classification && (
              <div className="table-responsive cm-table-wrap">
                <table className="table table-hover table-sm mb-0 cm-data-table">
                  <thead>
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
                              className="cm-color-swatch"
                              style={{
                                backgroundColor: info.color,
                              }}
                            />
                            {name}
                          </td>
                          <td>{fmtNum(info.area, 2)}</td>
                          <td>
                            <span className="badge cm-soft-badge">{fmtPct(info.percentage)}</span>
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
