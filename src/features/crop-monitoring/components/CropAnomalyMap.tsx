import { fmtNum, fmtPct, styleFor, ANOMALY_CATEGORY_STYLE } from "../utils";
import type { AnomalyResult } from "../types";
import { useI18nStore } from "@/hooks/useI18nStore";

interface Props {
  anomaly: AnomalyResult;
}

/** Sub-analysis C: NDVI anomaly vs historical baseline. Stats only - the
 * `tile_url` is rendered as a tab in CropMonitoringResultsMapPanel. */
export default function CropAnomalyMap({ anomaly }: Props) {
  const t = useI18nStore((state) => state.t);
  return (
    <div className="card mb-3">
      <div className="card-header">
        <i className="bi bi-exclamation-diamond-fill me-1" /> {t("crop.card.anomalyTitle")}
      </div>
      <div className="card-body">
        {!anomaly.available ? (
          <div className="alert alert-secondary py-2 mb-0 small">
            {t("crop.unavailable")}{anomaly.reason ? `: ${anomaly.reason}` : "."}
          </div>
        ) : (
          <div className="row g-2 text-center">
            <div className="col-6 col-md-2">
              <div className="text-muted small">{t("crop.ndviCurrent")}</div>
              <div className="fw-bold">{fmtNum(anomaly.current_ndvi, 4)}</div>
            </div>
            <div className="col-6 col-md-2">
              <div className="text-muted small">{t("crop.ndviHistorical")}</div>
              <div className="fw-bold">{fmtNum(anomaly.historical_expected_ndvi, 4)}</div>
            </div>
            <div className="col-6 col-md-2">
              <div className="text-muted small">{t("crop.difference")}</div>
              <div className={`fw-bold ${anomaly.difference_pct < 0 ? "text-danger" : "text-success"}`}>
                {anomaly.difference_pct > 0 ? "+" : ""}
                {fmtPct(anomaly.difference_pct)}
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="text-muted small">{t("crop.affectedArea")}</div>
              <div className="fw-bold">{fmtNum(anomaly.affected_area_ha, 2)} ha</div>
            </div>
            <div className="col-6 col-md-3">
              <div className="text-muted small">{t("crop.category")}</div>
              <span className={`fw-bold ${styleFor(ANOMALY_CATEGORY_STYLE, anomaly.category).className}`}>
                {styleFor(ANOMALY_CATEGORY_STYLE, anomaly.category).emoji} {styleFor(ANOMALY_CATEGORY_STYLE, anomaly.category).label}
              </span>
            </div>
          </div>
        )}
        {anomaly.available && (
          <small className="text-muted d-block mt-2">
            Baseline dari {anomaly.historical_years_used} tahun sebelumnya
            {anomaly.tile_url ? " · lihat layer peta \"Anomali\" di panel Peta Hasil di bawah." : ""}
          </small>
        )}
      </div>
    </div>
  );
}
