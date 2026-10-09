import { Bar, Line } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip, type Plugin } from "chart.js";
import { useI18nStore } from "@/hooks/useI18nStore";
import { interpolate } from "@/i18n/translations";
import RichText from "@/components/ui/RichText";
import InfoTip from "@/components/ui/InfoTip";
import type { CarbonResult } from "@/features/carbon/types";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

interface Props {
  result: CarbonResult;
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
  const unit = result.carbon_estimated.unit || reference?.unit || "Mg C/ha";
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
      <div className="cs-status-summary mt-3" role="status">
        <i className="bi bi-layers" />
        <strong>{modelInfo.load_only
          ? (language === "id" ? "Layer referensi dimuat" : "Reference layer loaded")
          : (language === "id" ? "Statistik AOI tidak tersedia" : "AOI statistics unavailable")}</strong>
        <InfoTip label={t("lc.moreInfo")} content={modelInfo.load_only
          ? (language === "id"
            ? "Mode muat peta melewati perhitungan statistik, luas AOI, dan total stok."
            : "Map-only mode skips statistics, AOI area, and total stock calculations.")
          : (language === "id"
            ? "Layer estimasi berhasil dimuat, tetapi Earth Engine membatasi agregasi statistik untuk AOI ini. Peta tetap dapat dilihat."
            : "The estimate layer loaded, but Earth Engine limited statistics aggregation for this AOI. The map remains available.")}
        />
      </div>
    );
  }

  const calculationAreaHa = areaInfo.calculation_area_ha ?? areaInfo.area_ha ?? 0;
  const isClipped = modelInfo.calculation_mode === "clipped_aoi";

  const fmt = (n: number, digits = 2) => n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const fmtInt = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 0 });
  const histogram = stats.histogram;
  const histogramBins = histogram?.bucket_means?.map((center, index) => ({
    center,
    count: histogram.counts[index] ?? 0,
  })).filter((bin) => Number.isFinite(bin.center) && Number.isFinite(bin.count)) ?? [];
  const histogramTotal = histogramBins.reduce((sum, bin) => sum + bin.count, 0);
  let cumulativeCount = 0;
  const cumulativePercent = histogramBins.map((bin) => {
    cumulativeCount += bin.count;
    return histogramTotal > 0 ? (cumulativeCount / histogramTotal) * 100 : 0;
  });
  const hasHistogram = histogramBins.length > 0 && histogramTotal > 0;
  const yearMismatch = reference?.year != null && modelInfo.analysis_year != null && reference.year !== modelInfo.analysis_year;
  const resolutionMismatch = reference?.resolution != null && modelInfo.scale != null && reference.resolution >= modelInfo.scale * 3;
  const distributionMarkers: Plugin<"bar"> = {
    id: "carbon-distribution-markers",
    beforeDatasetsDraw(chart) {
      if (stats.mean == null || stats.std_dev == null || histogramBins.length < 2) return;
      const xScale = chart.scales.x;
      const area = chart.chartArea;
      const nearestIndex = (value: number) => histogramBins.reduce((best, bin, index) =>
        Math.abs(bin.center - value) < Math.abs(histogramBins[best].center - value) ? index : best, 0);
      const left = xScale.getPixelForValue(nearestIndex(stats.mean - stats.std_dev));
      const right = xScale.getPixelForValue(nearestIndex(stats.mean + stats.std_dev));
      const context = chart.ctx;
      context.save();
      context.fillStyle = "rgba(245, 158, 11, 0.10)";
      context.fillRect(Math.min(left, right), area.top, Math.max(2, Math.abs(right - left)), area.bottom - area.top);
      context.restore();
    },
    afterDatasetsDraw(chart) {
      const xScale = chart.scales.x;
      const area = chart.chartArea;
      const context = chart.ctx;
      const nearestIndex = (value: number) => histogramBins.reduce((best, bin, index) =>
        Math.abs(bin.center - value) < Math.abs(histogramBins[best].center - value) ? index : best, 0);
      const drawMarker = (value: number | null | undefined, label: string, color: string) => {
        if (value == null || !Number.isFinite(value) || !histogramBins.length) return;
        const x = xScale.getPixelForValue(nearestIndex(value));
        context.save();
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = 2;
        context.setLineDash([4, 3]);
        context.beginPath();
        context.moveTo(x, area.top);
        context.lineTo(x, area.bottom);
        context.stroke();
        context.setLineDash([]);
        context.font = "600 10px sans-serif";
        context.fillText(label, Math.min(x + 4, area.right - 42), area.top + 12);
        context.restore();
      };
      drawMarker(stats.mean, language === "id" ? "Rata-rata" : "Mean", "#c2410c");
      drawMarker(stats.percentiles?.median, "Median", "#1d4ed8");
    },
  };

  return (
    <div className="mt-4 cs-panel">
      <div className="cs-panel-heading">
        <h5 className="mb-0"><i className="bi bi-tree me-1" /> {t("carbon.detail.title")}</h5>
        <div className="cs-panel-notes">
          {yearMismatch && (
            <span className="cs-note-indicator">
              <i className="bi bi-exclamation-triangle" />
              <InfoTip label={t("lc.moreInfo")} content={(
                <RichText text={interpolate(t("carbon.detail.yearMismatchWarning"), {
                  analysisYear: modelInfo.analysis_year ?? "-",
                  refName: reference?.name || reference?.full_name || "",
                  refYear: reference?.year ?? "-",
                })} />
              )} />
            </span>
          )}
          {resolutionMismatch && (
            <span className="cs-note-indicator">
              <i className="bi bi-grid-3x3-gap" />
              <InfoTip label={t("lc.moreInfo")} content={(
                <RichText text={interpolate(t("carbon.detail.resolutionMismatchWarning"), {
                  refName: reference?.name || reference?.full_name || "",
                  refRes: reference?.resolution ?? "-",
                  scale: modelInfo.scale ?? "-",
                })} />
              )} />
            </span>
          )}
        </div>
      </div>

      <div className={`cs-mode-bar ${isClipped ? "cs-mode-bar-clipped" : "cs-mode-bar-full"}`}>
        <div className="cs-mode-col">
          <div className="cs-mode-title">
            <i className={`bi ${isClipped ? "bi-scissors" : "bi-layers"}`} />
            {isClipped ? t("carbon.detail.modeClipped") : t("carbon.detail.modeBoundingBox")}
          </div>
          <div className="cs-mode-detail">
            {t("carbon.detail.area")}: <strong>{fmtInt(calculationAreaHa)} ha</strong>
            {areaInfo.description && <InfoTip label={t("lc.moreInfo")} content={areaInfo.description} />}
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
              {reference.resolution ? <span className="cs-mode-desc"> · {reference.resolution}m</span> : null}
              {reference.description && <InfoTip label={t("lc.moreInfo")} content={reference.description} />}
            </div>
          </div>
        )}
      </div>

      <div className="row g-3">
        <div className="col-12">
          <div className="cs-card">
            <div className="cs-card-header cs-card-header-spread">
              <span><i className="bi bi-bar-chart-line" /> {t(unit === "g/kg" ? "carbon.pool.concentrationStats" : "carbon.detail.densityStats")}</span>
              <InfoTip label={t("lc.moreInfo")} content={language === "id"
                ? "Histogram memperlihatkan sebaran prediksi piksel. Garis putus-putus menandai rata-rata dan median; area berwarna menunjukkan rentang ±1 simpangan baku. Grafik kumulatif menunjukkan proporsi piksel pada atau di bawah setiap nilai. Bila data memakai sampel, kuartil dihitung dari sampel tersebut."
                : "The histogram shows the distribution of pixel predictions. Dashed lines mark the mean and median; the shaded band shows ±1 standard deviation. The cumulative chart shows the share of pixels at or below each value. When sampled data is used, quartiles are calculated from that sample."} />
            </div>
            <div className="cs-card-body">
              {hasHistogram ? (
                <>
                  <div className="cs-chart-summary">
                    <span>{language === "id" ? "Rata-rata" : "Mean"}: <strong>{stats.mean == null ? "—" : `${fmt(stats.mean)} ${unit}`}</strong></span>
                    <span>{language === "id" ? "±1 simpangan baku" : "±1 SD"}: <strong>{stats.std_dev == null ? "—" : `${fmt(stats.std_dev)} ${unit}`}</strong></span>
                    <span>Median: <strong>{stats.percentiles?.median == null ? "—" : `${fmt(stats.percentiles.median)} ${unit}`}</strong></span>
                    <span>Q1–Q3: <strong>{stats.percentiles?.p25 == null || stats.percentiles.p75 == null ? "—" : `${fmt(stats.percentiles.p25)}–${fmt(stats.percentiles.p75)} ${unit}`}</strong></span>
                    <span>{language === "id" ? "Rentang" : "Range"}: <strong>{stats.min == null || stats.max == null ? "—" : `${fmt(stats.min)}–${fmt(stats.max)} ${unit}`}</strong></span>
                    <span>{histogram?.sampled ? (language === "id" ? "Sampel" : "Sample") : (language === "id" ? "Piksel" : "Pixels")}: <strong>{fmtInt(histogram?.pixel_count ?? histogramTotal)}</strong></span>
                  </div>
                  <div className="cs-chart-grid">
                  <div className="cs-chart-block">
                    <h6>{language === "id" ? "Distribusi densitas" : "Density distribution"}</h6>
                    <div className="cs-chart-legend">
                      <span><i className="cs-chart-legend__mean" /> {language === "id" ? "Rata-rata" : "Mean"}</span>
                      <span><i className="cs-chart-legend__spread" /> {language === "id" ? "±1 simpangan baku" : "±1 SD"}</span>
                      <span><i className="cs-chart-legend__median" /> Median</span>
                    </div>
                    <div className="cs-chart-frame">
                      <Bar
                        plugins={[distributionMarkers]}
                        data={{
                          labels: histogramBins.map((bin) => fmt(bin.center, 1)),
                          datasets: [{
                            label: language === "id" ? "Jumlah piksel" : "Pixel count",
                            data: histogramBins.map((bin) => bin.count),
                            backgroundColor: "rgba(46,125,50,0.72)",
                            borderColor: "#2e7d32",
                            borderWidth: 1,
                            borderRadius: 2,
                          }],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: {
                            x: { title: { display: true, text: unit }, ticks: { maxTicksLimit: 8, maxRotation: 0 } },
                            y: { beginAtZero: true, title: { display: true, text: language === "id" ? "Jumlah piksel" : "Pixel count" } },
                          },
                        }}
                      />
                    </div>
                  </div>
                  <div className="cs-chart-block">
                    <h6>{language === "id" ? "Distribusi kumulatif" : "Cumulative distribution"}</h6>
                    <div className="cs-chart-frame">
                      <Line
                        data={{
                          labels: histogramBins.map((bin) => fmt(bin.center, 1)),
                          datasets: [{
                            label: language === "id" ? "Piksel pada atau di bawah nilai (%)" : "Pixels at or below value (%)",
                            data: cumulativePercent,
                            borderColor: "#1976d2",
                            backgroundColor: "rgba(25,118,210,0.12)",
                            fill: true,
                            tension: 0.25,
                            pointRadius: 1.5,
                          }],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: {
                            x: { title: { display: true, text: unit }, ticks: { maxTicksLimit: 6, maxRotation: 0 } },
                            y: { min: 0, max: 100, title: { display: true, text: "%" }, ticks: { callback: (value) => `${value}%` } },
                          },
                        }}
                      />
                    </div>
                  </div>
                </div>
                </>
              ) : (
                <div className="cs-chart-empty">
                  {language === "id" ? "Grafik distribusi tidak tersedia untuk hasil ini." : "Distribution charts are unavailable for this result."}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="cs-card mt-3">
        <div className="cs-card-header cs-card-header-spread">
          <span><i className="bi bi-gear" /> {t("carbon.detail.modelConfig")}</span>
          <InfoTip label={t("lc.moreInfo")} content={(
            <div className="cs-popover-copy">
              {modelInfo.depth_cm && <div>{t("carbon.pool.depth")}: {modelInfo.depth_cm.join("–")} cm</div>}
              {modelInfo.source_period && <div>{t("carbon.pool.period")}: {modelInfo.source_period}</div>}
              {modelInfo.method_description && <p>{modelInfo.method_description}</p>}
              {modelInfo.validation_metrics && (
                <>
                  <strong>{t("carbon.pool.referenceAgreement")}</strong>
                  <div>R²: {modelInfo.validation_metrics.r2?.toFixed(3) ?? "—"} · RMSE: {modelInfo.validation_metrics.rmse?.toFixed(2) ?? "—"} {unit} · MAE: {modelInfo.validation_metrics.mae?.toFixed(2) ?? "—"} {unit}</div>
                  <div>{t("carbon.pool.samples")}: {modelInfo.n_samples ?? "—"} / {modelInfo.validation_samples ?? "—"}</div>
                  <p>{t("carbon.pool.referenceValidationNote")}</p>
                </>
              )}
              {modelInfo.validation_note && <p>{modelInfo.validation_note}</p>}
            </div>
          )} />
        </div>
        <div className="cs-card-body">
          <div className="cs-config-grid">
            <div className="cs-config-item">
              <span className="cs-config-label">{t(modelInfo.source_period ? "carbon.pool.period" : "carbon.detail.imageYear")}</span>
              <span className="cs-config-value">{modelInfo.source_period || modelInfo.analysis_year || "-"}</span>
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
                  RMSE {perf.rmse.toFixed(2)} {unit}{perf.rmse_std ? ` ± ${perf.rmse_std.toFixed(2)}` : ""}
                </span>
              )}
              {perf.cv_folds !== undefined && (
                <span className="cs-perf-badge cs-perf-neutral">CV {perf.cv_folds}-fold</span>
              )}
            </div>
          )}
          {modelInfo.validation_metrics && (
            <div className="cs-perf-row">
              <span className="cs-perf-badge cs-perf-neutral">{t("carbon.pool.referenceAgreement")}: R² {modelInfo.validation_metrics.r2?.toFixed(2) ?? "—"}</span>
              {modelInfo.validation_metrics.rmse != null && <span className="cs-perf-badge cs-perf-neutral">RMSE {modelInfo.validation_metrics.rmse.toFixed(1)} {unit}</span>}
            </div>
          )}
        </div>
      </div>

      {dataQuality && (
        <div className="cs-card mt-3">
          <div className="cs-card-header cs-card-header-spread">
            <span><i className="bi bi-shield-check" /> {t("carbon.detail.dataQuality")}</span>
            <InfoTip label={t("lc.moreInfo")} content={(
              <div className="cs-popover-copy">
                <p>{t("carbon.detail.cvFooter")}</p>
                <RichText text={interpolate(t("carbon.detail.generalizationWarning"), {
                  modelOrFallback: modelInfo.model_name || t("carbon.detail.regionNotListed"),
                })} />
              </div>
            )} />
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
          </div>
        </div>
      )}
    </div>
  );
}
