import CropPanelAccordion from "./CropPanelAccordion";
import { fmtNum } from "../utils";
import type { HistoricalComparisonResult } from "../types";
import { useI18nStore } from "@/hooks/useI18nStore";

interface Props {
  historicalComparison: HistoricalComparisonResult;
}

/** Sub-analysis I: multi-year NDVI comparison, with the backend's
 * auto-generated Indonesian narrative shown as a highlighted callout. */
export default function HistoricalComparisonPanel({ historicalComparison }: Props) {
  const t = useI18nStore((state) => state.t);
  return (
    <CropPanelAccordion title={t("crop.card.historicalTitle")} icon="bi-bar-chart-line-fill">
      {!historicalComparison.available ? (
        <div className="alert alert-secondary py-2 mb-0 small">{t("crop.unavailable")}.</div>
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
                  <th>{t("crop.year")}</th>
                  <th>{t("crop.ndviMean")}</th>
                  <th>{t("crop.status")}</th>
                </tr>
              </thead>
              <tbody>
                {historicalComparison.years.map((y) => (
                  <tr key={y.year}>
                    <td>{y.year}</td>
                    <td>{y.ndvi_mean != null ? fmtNum(y.ndvi_mean, 4) : "-"}</td>
                    <td>
                      {y.available ? (
                        <span className="badge bg-success">{t("crop.available")}</span>
                      ) : (
                        <span className="badge bg-secondary">{t("crop.unavailable")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </CropPanelAccordion>
  );
}
