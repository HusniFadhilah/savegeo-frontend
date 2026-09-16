import { useState } from "react";
import { Line } from "react-chartjs-2";
import { CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { VEGETATION_INDICES } from "@/features/vegetation/indices";
import { ApiError } from "@/services/apiClient";
import { runCropMonitoring } from "../api";
import { fmtNum } from "../utils";
import type { CropMonitoringPeriodInput, TimeseriesResult } from "../types";
import { useI18nStore } from "@/hooks/useI18nStore";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

interface Props {
  fieldId: number;
  period: CropMonitoringPeriodInput | undefined;
  timeseries: TimeseriesResult | undefined;
  index: string;
  onResult: (index: string, result: TimeseriesResult) => void;
}

const TREND_LABEL: Record<string, string> = {
  naik: "crop.trend.up",
  turun: "crop.trend.down",
  stabil: "crop.trend.stable",
  insufficient_data: "crop.trend.insufficient",
};

/** Sub-analysis B: vegetation time series. Changing the index triggers a
 * cheap scoped re-run (sub_analyses: ["timeseries"] only). */
export default function VegetationTimeSeriesChart({ fieldId, period, timeseries, index, onResult }: Props) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useI18nStore((state) => state.t);

  async function handleIndexChange(newIndex: string) {
    setRunning(true);
    setError(null);
    try {
      const res = await runCropMonitoring({
        field_id: fieldId,
        period,
        sub_analyses: ["timeseries"],
        timeseries_index: newIndex,
      });
      onResult(newIndex, res.sub_analyses.timeseries ?? { available: false });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("crop.timeseries.reloadFailed"));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="card mb-3">
      <div className="card-header d-flex justify-content-between align-items-center">
        <span>
          <i className="bi bi-graph-up me-1" /> {t("crop.card.timeseriesTitle")}
        </span>
        <select
          className="form-select form-select-sm"
          style={{ width: "auto" }}
          value={index}
          disabled={running}
          onChange={(e) => void handleIndexChange(e.target.value)}
        >
          {VEGETATION_INDICES.map((i) => (
            <option key={i.code} value={i.code}>
              {i.label}
            </option>
          ))}
        </select>
      </div>
      <div className="card-body">
        {running && (
          <div className="text-muted small mb-2">
            <span className="spinner-border spinner-border-sm me-1" /> {t("crop.timeseries.loading")} {index}...
          </div>
        )}
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {!timeseries || !timeseries.available ? (
          <div className="alert alert-secondary py-2 mb-0 small">{t("crop.unavailable")}.</div>
        ) : (
          <>
            <div className="row g-2 mb-3 text-center">
              <div className="col-3">
                <div className="text-muted small">{t("crop.min")}</div>
                <div className="fw-bold">{fmtNum(timeseries.min, 3)}</div>
              </div>
              <div className="col-3">
                <div className="text-muted small">{t("crop.mean")}</div>
                <div className="fw-bold">{fmtNum(timeseries.mean, 3)}</div>
              </div>
              <div className="col-3">
                <div className="text-muted small">{t("crop.median")}</div>
                <div className="fw-bold">{fmtNum(timeseries.median, 3)}</div>
              </div>
              <div className="col-3">
                <div className="text-muted small">{t("crop.max")}</div>
                <div className="fw-bold">{fmtNum(timeseries.max, 3)}</div>
              </div>
            </div>
            <div className="mb-2 small">
              {t("crop.trend.label")}:{" "}
              <span className={`fw-bold ${timeseries.trend === "naik" ? "text-success" : timeseries.trend === "turun" ? "text-danger" : "text-muted"}`}>
                {TREND_LABEL[timeseries.trend] ? t(TREND_LABEL[timeseries.trend]) : timeseries.trend}
              </span>
              {timeseries.last_image_date && (
                <span className="text-muted"> · citra terakhir {timeseries.last_image_date}</span>
              )}
            </div>
            <div style={{ height: 300 }}>
              <Line
                data={{
                  labels: timeseries.periods.map((p) => p.label),
                  datasets: [
                    {
                      label: timeseries.index,
                      data: timeseries.periods.map((p) => p.mean),
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
                    x: { title: { display: true, text: "Periode" } },
                    y: { title: { display: true, text: timeseries.index } },
                  },
                }}
              />
            </div>
            {timeseries.anomaly_periods.length > 0 && (
              <small className="text-muted d-block mt-2">
                Periode anomali: {timeseries.anomaly_periods.join(", ")}
              </small>
            )}
          </>
        )}
      </div>
    </div>
  );
}
