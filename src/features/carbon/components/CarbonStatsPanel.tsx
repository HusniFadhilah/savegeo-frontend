import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import { useI18nStore } from "@/hooks/useI18nStore";
import { interpolate } from "@/i18n/translations";
import RichText from "@/components/ui/RichText";
import type { CarbonResult } from "@/features/carbon/types";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface Props {
  result: CarbonResult;
}

function StatRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="cs-stat-row">
      <span className="cs-stat-label">{label}</span>
      <span className={`cs-stat-value ${strong ? "cs-stat-value-strong" : ""}`}>{value}</span>
    </div>
  );
}

/** Ported from main.js displayCarbonStats(): density/total tables + model performance. */
export default function CarbonStatsPanel({ result }: Props) {
  const t = useI18nStore((s) => s.t);
  const language = useI18nStore((s) => s.language);
  const locale = language === "id" ? "id-ID" : "en-US";
  const stats = result.carbon_estimated?.statistics || {};
  const areaInfo = result.area_info || {};
  const modelInfo = result.model_info || {};
  const reference = result.carbon_reference;
  const dataQuality = result.data_quality;
  // `model_performance` was never actually populated by the backend (dead
  // field, verified live against app/services/carbon_service.py) - the real
  // R²/RMSE live under model_info.cv_metrics.
  const cv = modelInfo.cv_metrics;
  const perf = cv
    ? { r2_score: cv.r2_mean, rmse: cv.rmse_mean, rmse_std: cv.rmse_std, cv_folds: cv.n_folds ?? cv.cv_folds }
    : undefined;

  if (modelInfo.load_only || modelInfo.statistics_available === false) {
    return (
      <div className="alert alert-info mt-4" role="status">
        <i className="bi bi-layers me-1" />
        {modelInfo.load_only
          ? "Layer dataset referensi sudah dimuat. Statistik, luas AOI, dan total stok dilewati pada mode load-only."
          : "Layer estimasi berhasil dimuat, tetapi statistik AOI tidak tersedia karena Earth Engine membatasi agregasi untuk AOI ini."}
      </div>
    );
  }

  const calculationAreaHa = areaInfo.calculation_area_ha ?? areaInfo.area_ha ?? 0;
  const isClipped = modelInfo.calculation_mode === "clipped_aoi";

  const fmt = (n: number, digits = 2) => n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const fmtInt = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 0 });

  return (
    <div className="mt-4 cs-panel">
      <h5 className="mb-3">
        <i className="bi bi-tree me-1" /> {t("carbon.detail.title")}
      </h5>

      {reference?.year != null && modelInfo.analysis_year != null && reference.year !== modelInfo.analysis_year && (
        <div className="alert alert-warning py-2 mb-3" style={{ fontSize: ".85rem" }}>
          <i className="bi bi-exclamation-triangle-fill me-1" />
          <RichText
            text={interpolate(t("carbon.detail.yearMismatchWarning"), {
              analysisYear: modelInfo.analysis_year,
              refName: reference.name || reference.full_name || "",
              refYear: reference.year,
            })}
          />
        </div>
      )}

      {reference?.resolution != null && modelInfo.scale != null && reference.resolution >= modelInfo.scale * 3 && (
        <div className="alert alert-warning py-2 mb-3" style={{ fontSize: ".85rem" }}>
          <i className="bi bi-grid-3x3-gap-fill me-1" />
          <RichText
            text={interpolate(t("carbon.detail.resolutionMismatchWarning"), {
              refName: reference.name || reference.full_name || "",
              refRes: reference.resolution,
              scale: modelInfo.scale,
            })}
          />
        </div>
      )}

      <div className={`cs-mode-bar ${isClipped ? "cs-mode-bar-clipped" : "cs-mode-bar-full"}`}>
        <div className="cs-mode-col">
          <div className="cs-mode-title">
            <i className={`bi ${isClipped ? "bi-scissors" : "bi-layers"}`} />
            {isClipped ? t("carbon.detail.modeClipped") : t("carbon.detail.modeBoundingBox")}
          </div>
          <div className="cs-mode-detail">
            {t("carbon.detail.area")}: <strong>{fmtInt(calculationAreaHa)} ha</strong>
            {areaInfo.description ? <span className="cs-mode-desc"> · {areaInfo.description}</span> : null}
          </div>
        </div>
        {reference && (
          <div className="cs-mode-col">
            <div className="cs-mode-title">
              <i className="bi bi-database" />
              {t("carbon.detail.referenceDataset")}
            </div>
            <div className="cs-mode-detail">
              {reference.name || reference.full_name || "N/A"}
              {reference.year != null ? ` (${reference.year})` : ""}
              {reference.resolution ? <span className="cs-mode-desc"> · Resolusi {reference.resolution}m</span> : null}
            </div>
          </div>
        )}
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <div className="cs-card">
            <div className="cs-card-header">
              <i className="bi bi-bar-chart-line" /> {t("carbon.detail.densityStats")}
            </div>
            <div className="cs-card-body">
              <StatRow label={t("carbon.detail.mean")} value={`${fmt(stats.mean ?? 0)} Mg/ha`} strong />
              <StatRow label={t("carbon.detail.stdDev")} value={`${fmt(stats.std_dev ?? 0)} Mg/ha`} />
              <StatRow label={t("carbon.detail.min")} value={`${fmt(stats.min ?? 0)} Mg/ha`} />
              <StatRow label={t("carbon.detail.max")} value={`${fmt(stats.max ?? 0)} Mg/ha`} />
              <div style={{ height: 160, marginTop: 10 }}>
                <Bar
                  data={{
                    labels: [t("carbon.detail.min"), t("carbon.detail.mean"), t("carbon.detail.max")],
                    datasets: [
                      {
                        label: t("carbon.detail.chartLabel"),
                        data: [stats.min ?? 0, stats.mean ?? 0, stats.max ?? 0],
                        backgroundColor: ["rgba(148,163,184,0.75)", "rgba(46,125,50,0.85)", "rgba(255,167,38,0.8)"],
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { title: { display: true, text: "Mg/ha" } } },
                  }}
                />
              </div>
            </div>
            {(reference?.name || reference?.full_name) && (
              <div className="cs-card-footer">
                <i className="bi bi-info-circle me-1" />
                {t("carbon.detail.reference")}: {reference.full_name || reference.name}
                {reference.description ? <span className="d-block mt-1 text-muted">{reference.description}</span> : null}
              </div>
            )}
          </div>
        </div>

        <div className="col-md-6">
          <div className="cs-card">
            <div className="cs-card-header">
              <i className="bi bi-clipboard-data" /> {t("carbon.detail.totalStock")}
            </div>
            <div className="cs-card-body">
              <StatRow label={t("carbon.detail.calcArea")} value={`${fmtInt(calculationAreaHa)} ha`} />
              <StatRow label={t("carbon.detail.totalCarbon")} value={areaInfo.total_carbon_tons == null ? "—" : `${fmtInt(areaInfo.total_carbon_tons)} ton`} strong />
              <StatRow label={t("carbon.detail.co2Equivalent")} value={areaInfo.carbon_dioxide_equivalent_tons == null ? "—" : `${fmtInt(areaInfo.carbon_dioxide_equivalent_tons)} ton CO₂e`} strong />
            </div>
            <div className="cs-card-footer">
              <i className="bi bi-info-circle me-1" />
              {t("carbon.detail.co2Formula")}
            </div>
          </div>
        </div>
      </div>

      <div className="cs-card mt-3">
        <div className="cs-card-header">
          <i className="bi bi-gear" /> {t("carbon.detail.modelConfig")}
        </div>
        <div className="cs-card-body">
          <div className="cs-config-grid">
            <div className="cs-config-item">
              <span className="cs-config-label">{t("carbon.detail.imageYear")}</span>
              <span className="cs-config-value">{modelInfo.analysis_year ?? "-"}</span>
            </div>
            <div className="cs-config-item">
              <span className="cs-config-label">{t("carbon.detail.referenceDataset")}</span>
              <span className="cs-config-value">
                {reference?.name || reference?.full_name || "-"}
                {reference?.year != null ? ` (vintage ${reference.year})` : ""}
              </span>
            </div>
            <div className="cs-config-item">
              <span className="cs-config-label">{t("carbon.detail.processScale")}</span>
              <span className="cs-config-value">{modelInfo.scale ? `${modelInfo.scale}m` : "-"}</span>
            </div>
            <div className="cs-config-item">
              <span className="cs-config-label">{t("carbon.detail.displayMode")}</span>
              <span className="cs-config-value">{modelInfo.display_mode || (isClipped ? t("carbon.params.clipped") : t("carbon.params.fullTiles"))}</span>
            </div>
          </div>

          {modelInfo.model_name && (
            <div className="cs-model-used">
              <i className="bi bi-cpu me-1" />
              {t("carbon.detail.modelUsed")}: <code>{modelInfo.model_name}</code>
              {modelInfo.model_version ? <span className="text-muted"> (v{modelInfo.model_version})</span> : null}
            </div>
          )}

          {perf && (
            <div className="cs-perf-row">
              {perf.r2_score !== undefined && (
                <span className={`cs-perf-badge ${perf.r2_score >= 0.7 ? "cs-perf-good" : perf.r2_score >= 0.5 ? "cs-perf-mid" : "cs-perf-low"}`}>
                  R² {perf.r2_score.toFixed(3)}
                </span>
              )}
              {perf.rmse !== undefined && (
                <span className="cs-perf-badge cs-perf-neutral">
                  RMSE {perf.rmse.toFixed(2)} Mg/ha{perf.rmse_std ? ` ± ${perf.rmse_std.toFixed(2)}` : ""}
                </span>
              )}
              {perf.cv_folds !== undefined && (
                <span className="cs-perf-badge cs-perf-neutral">CV {perf.cv_folds}-fold</span>
              )}
            </div>
          )}
        </div>
      </div>

      {dataQuality && (
        <div className="cs-card mt-3">
          <div className="cs-card-header">
            <i className="bi bi-shield-check" /> {t("carbon.detail.dataQuality")}
          </div>
          <div className="cs-card-body">
            <div className="cs-config-grid">
              <div className="cs-config-item">
                <span className="cs-config-label">{t("carbon.detail.cloudFreePixels")}</span>
                <span className="cs-config-value">
                  {dataQuality.valid_pixel_pct != null ? `${dataQuality.valid_pixel_pct.toFixed(1)}%` : "-"}
                  {dataQuality.gap_filled ? (
                    <span className="text-warning" title={t("carbon.detail.gapFilledTitle")}>
                      {" "}
                      <i className="bi bi-exclamation-triangle" /> {t("carbon.detail.gapFilled")}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="cs-config-item">
                <span className="cs-config-label">{t("carbon.detail.imagesUsed")}</span>
                <span className="cs-config-value">{dataQuality.images_used ?? "-"} {t("carbon.detail.scene")}</span>
              </div>
              <div className="cs-config-item">
                <span className="cs-config-label">{t("carbon.detail.spatialVariability")}</span>
                <span className="cs-config-value">
                  {dataQuality.coefficient_of_variation_pct != null ? `${dataQuality.coefficient_of_variation_pct.toFixed(1)}%` : "-"}
                </span>
              </div>
            </div>
            <div className="cs-card-footer">
              <i className="bi bi-info-circle me-1" />
              {t("carbon.detail.cvFooter")}
              <br />
              <i className="bi bi-exclamation-triangle me-1 mt-2 d-inline-block" />
              <RichText
                text={interpolate(t("carbon.detail.generalizationWarning"), {
                  modelOrFallback: modelInfo.model_name || t("carbon.detail.regionNotListed"),
                })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
