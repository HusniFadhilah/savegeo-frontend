import { useEffect, useState } from "react";
import { useAoiStore } from "@/hooks/useAoiStore";
import { useFieldStore } from "@/hooks/useFieldStore";
import { useUiStore } from "@/hooks/useUiStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import { ApiError } from "@/services/apiClient";
import { getCropMonitoringCommodities, getWeatherProviders, runCropMonitoring } from "./api";
import { DEFAULT_SUB_ANALYSES, type Commodity, type CropMonitoringPeriodInput, type CropMonitoringPeriodMode, type CropMonitoringResult, type FloodResult, type SubAnalysisKey, type TimeseriesResult, type WeatherProvider } from "./types";
import { fmtNum, fmtPct, styleFor, HEALTH_LABEL_STYLE, RISK_LEVEL_STYLE, WATER_STRESS_STYLE } from "./utils";
import { parseQuery, updateUrlFromState } from "./lib/cropMonitoringQueryState";
import { registerUiCommands } from "@/features/chatbot/uiCommandBus";

import FieldPanel from "./components/FieldPanel";
import CropInfoPanel from "./components/CropInfoPanel";
import MonitoringPeriodPanel from "./components/MonitoringPeriodPanel";
import DataSourceTogglesPanel from "./components/DataSourceTogglesPanel";
import CropHealthCard from "./components/CropHealthCard";
import VegetationTimeSeriesChart from "./components/VegetationTimeSeriesChart";
import CropAnomalyMap from "./components/CropAnomalyMap";
import GrowthStagePanel from "./components/GrowthStagePanel";
import WaterMoisturePanel from "./components/WaterMoisturePanel";
import WeatherPanel from "./components/WeatherPanel";
import FloodImpactPanel from "./components/FloodImpactPanel";
import ProductivityZonesPanel from "./components/ProductivityZonesPanel";
import HistoricalComparisonPanel from "./components/HistoricalComparisonPanel";
import CropRiskScoreCard from "./components/CropRiskScoreCard";
import CropMonitoringResultsMapPanel from "./components/CropMonitoringResultsMapPanel";

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Top-level Crop Monitoring module: a left workflow panel (Field ->
 * Crop Info -> Monitoring Period -> Data Sources -> Run) and a right results
 * panel (summary stat cards, then one card per sub-analysis, then a shared
 * tile-layer map). Shares `useAoiStore` for AOI draw/upload the same way
 * Carbon/LC-Change do, and its own `useFieldStore` for the Field registry
 * layered on top.
 */
export default function CropMonitoringModule() {
  const t = useI18nStore((state) => state.t);
  const query = parseQuery(typeof window !== "undefined" ? window.location.search : "");
  const aoi = useAoiStore((s) => s.aoi);
  const selectedField = useFieldStore((s) => s.selectedField);
  const showLoading = useUiStore((s) => s.showLoading);
  const setLoadingProgress = useUiStore((s) => s.setLoadingProgress);
  const hideLoading = useUiStore((s) => s.hideLoading);

  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [weatherProviders, setWeatherProviders] = useState<Record<string, WeatherProvider>>({});

  useEffect(() => {
    void getCropMonitoringCommodities()
      .then((res) => setCommodities(res.commodities))
      .catch(() => setCommodities([]));
    void getWeatherProviders()
      .then((res) => {
        setWeatherProviders(res.providers);
        setWeatherSource(res.default);
      })
      .catch(() => setWeatherProviders({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Monitoring period
  const [periodMode, setPeriodMode] = useState<CropMonitoringPeriodMode>("current_season");
  const [customStart, setCustomStart] = useState(query.startDate ?? "");
  const [customEnd, setCustomEnd] = useState(query.endDate ?? "");
  const [compareSeasonEnabled, setCompareSeasonEnabled] = useState(false);
  const [compareYears, setCompareYears] = useState<number[]>([CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]);

  // Data sources / sub-analyses
  const [sentinel1Enabled, setSentinel1Enabled] = useState(true);
  const [sentinel2Enabled, setSentinel2Enabled] = useState(true);
  const [weatherSource, setWeatherSource] = useState("gee");
  const [subAnalyses, setSubAnalyses] = useState<SubAnalysisKey[]>(DEFAULT_SUB_ANALYSES);

  // Timeseries index (sub-analysis B), kept here so its value survives a
  // scoped re-run from VegetationTimeSeriesChart's own index selector.
  const [timeseriesIndex, setTimeseriesIndex] = useState((query.index ?? "ndvi").toUpperCase());

  useEffect(() => {
    if (typeof window === "undefined" || window.location.pathname !== "/crop-monitoring") return;
    updateUrlFromState({ ...query, analysis: query.analysis ?? "health", index: timeseriesIndex.toLowerCase(), startDate: customStart || query.startDate, endDate: customEnd || query.endDate });
  }, [timeseriesIndex, customStart, customEnd]);

  // Run state
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<CropMonitoringResult | null>(null);
  const [lastPeriod, setLastPeriod] = useState<CropMonitoringPeriodInput | undefined>(undefined);

  function buildPeriod(): CropMonitoringPeriodInput | null {
    if (periodMode !== "custom") return { mode: periodMode };
    if (!customStart || !customEnd) return null;
    return { mode: "custom", start_date: customStart, end_date: customEnd };
  }

  async function handleRun() {
    if (!selectedField) {
      setRunError(t("crop.selectField"));
      return;
    }
    const period = buildPeriod();
    if (!period) {
      setRunError(t("crop.customDatesRequired"));
      return;
    }

    const subs = [...subAnalyses];
    if (compareSeasonEnabled && !subs.includes("historical_comparison")) subs.push("historical_comparison");

    setRunning(true);
    setRunError(null);
    showLoading(t("crop.runningTitle"), t("crop.runningSubtitle"));
    try {
      setLoadingProgress(25, t("crop.runningProgress"));
      const res = await runCropMonitoring({
        field_id: selectedField.id,
        period,
        sub_analyses: subs,
        weather_source: weatherSource as "gee" | "openmeteo",
        timeseries_index: timeseriesIndex,
        scale: 10,
        data_sources: { sentinel1: sentinel1Enabled },
        ...(compareSeasonEnabled ? { compare_years: compareYears } : {}),
      });
      setResult(res);
      setLastPeriod(period);
    } catch (err) {
      setRunError(
        err instanceof ApiError
          ? ((err.payload as { detail?: string } | undefined)?.detail ?? err.message)
          : t("crop.runFailed"),
      );
      setResult(null);
    } finally {
      hideLoading();
      setRunning(false);
    }
  }

  useEffect(() => registerUiCommands("crop", {
    read: () => ({
      fieldId: selectedField?.id ?? null,
      commodity: selectedField?.commodity ?? null,
      periodMode,
      startDate: customStart || null,
      endDate: customEnd || null,
      index: timeseriesIndex,
      availableIndices: ["NDVI", "EVI", "SAVI", "NDMI", "NDRE", "GNDVI"],
      running,
      hasResult: Boolean(result),
      result,
      error: runError,
    }),
    execute: async ({ action, target, parameters }) => {
      const value = parameters?.value;
      if (action === "set_parameter" && target === "crop.index") {
        if (typeof value !== "string" || !["NDVI", "EVI", "SAVI", "NDMI", "NDRE", "GNDVI"].includes(value)) throw new Error("Indeks tanaman tidak tersedia.");
        setTimeseriesIndex(value);
      } else if (action === "set_parameter" && target === "crop.periodMode") {
        if (!["current_season", "30d", "90d", "custom"].includes(String(value))) throw new Error("Mode periode tanaman tidak valid.");
        setPeriodMode(value as CropMonitoringPeriodMode);
      } else if (action === "set_date_range" && target === "crop.dateRange") {
        const start = parameters?.start;
        const end = parameters?.end;
        const validDate = (date: unknown) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date));
        if (!validDate(start) || !validDate(end) || (start as string) > (end as string)) throw new Error("Rentang tanggal tanaman tidak valid.");
        setCustomStart(start as string);
        setCustomEnd(end as string);
        setPeriodMode("custom");
      } else if (action === "run_analysis" && target === "crop.analysis") {
        if (!selectedField) throw new Error("Pilih field tanaman sebelum menjalankan analisis.");
        if (running) throw new Error("Analisis tanaman masih berjalan.");
        await handleRun();
      } else {
        throw new Error(`Perintah ${action} untuk ${target} tidak didukung.`);
      }
    },
  }));

  function handleTimeseriesResult(index: string, timeseries: TimeseriesResult) {
    setTimeseriesIndex(index);
    setResult((prev) => (prev ? { ...prev, sub_analyses: { ...prev.sub_analyses, timeseries } } : prev));
  }

  function handleFloodResult(flood: FloodResult) {
    setResult((prev) => (prev ? { ...prev, sub_analyses: { ...prev.sub_analyses, flood } } : prev));
  }

  const sub = result?.sub_analyses;
  const activeCommodity = commodities.find((c) => c.key === selectedField?.commodity);
  const fieldFeature = aoi?.feature ?? null;
  const activePeriodLabel =
    periodMode === "current_season"
      ? t("crop.period.currentSeason")
      : periodMode === "30d"
        ? t("crop.period.last30")
      : periodMode === "90d"
        ? t("crop.period.last90")
      : customStart && customEnd
            ? `${customStart} - ${customEnd}`
            : t("crop.period.custom");

  return (
    <div className="cm-page">
      <div className="cm-hero">
        <div className="cm-hero-main">
          <span className="cm-eyebrow">{t("crop.eyebrow")}</span>
          <h1>{t("crop.title")}</h1>
          <p>
            {t("crop.description")}
          </p>
        </div>
        <div className="cm-hero-status">
          <div className="cm-status-card">
            <i className="bi bi-bounding-box-circles" />
            <div>
              <span>{t("crop.activeField")}</span>
              <strong>{selectedField?.name ?? t("crop.notSelected")}</strong>
            </div>
          </div>
          <div className="cm-status-card">
            <i className="bi bi-flower2" />
            <div>
              <span>{t("crop.commodity")}</span>
              <strong>{activeCommodity?.label ?? selectedField?.commodity ?? "-"}</strong>
            </div>
          </div>
          <div className="cm-status-card">
            <i className="bi bi-calendar2-week" />
            <div>
              <span>{t("crop.period.label")}</span>
              <strong>{activePeriodLabel}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
      <div className="col-lg-3">
        <div className="sidebar cm-workflow">
          <div className="cm-workflow-title">
            <span>
              <i className="bi bi-sliders2-vertical" />
            </span>
            <div>
              <h5>{t("crop.panel.title")}</h5>
              <p>{t("crop.panel.description")}</p>
            </div>
          </div>

          <FieldPanel commodities={commodities} />
          <CropInfoPanel commodities={commodities} field={selectedField} />
          <MonitoringPeriodPanel
            mode={periodMode}
            onModeChange={setPeriodMode}
            customStart={customStart}
            customEnd={customEnd}
            onCustomStartChange={setCustomStart}
            onCustomEndChange={setCustomEnd}
            compareSeasonEnabled={compareSeasonEnabled}
            onCompareSeasonChange={setCompareSeasonEnabled}
            compareYears={compareYears}
            onCompareYearsChange={setCompareYears}
          />
          <DataSourceTogglesPanel
            sentinel1Enabled={sentinel1Enabled}
            onSentinel1Change={setSentinel1Enabled}
            sentinel2Enabled={sentinel2Enabled}
            onSentinel2Change={setSentinel2Enabled}
            weatherProviders={weatherProviders}
            weatherSource={weatherSource}
            onWeatherSourceChange={setWeatherSource}
            subAnalyses={subAnalyses}
            onSubAnalysesChange={setSubAnalyses}
          />

          <button className="btn btn-primary w-100 mt-1" onClick={handleRun} disabled={running || !selectedField}>
            {running ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" /> {t("crop.analyzing")}
              </>
            ) : (
              <>
                <i className="bi bi-play-fill me-1" /> {t("crop.run")}
              </>
            )}
          </button>
          {!selectedField && (
            <small className="text-muted d-block mt-2">{t("crop.selectFieldHint")}</small>
          )}
          {runError && <div className="alert alert-warning py-2 mt-2 small mb-0">{runError}</div>}
        </div>
      </div>

      <div className="col-lg-9">
        {/* Flood needs its own pre/post-date trigger (never auto-included
            server-side), so it's available as soon as a Field is selected,
            independent of whether the main "Run" has completed yet. */}
        {selectedField && subAnalyses.includes("flood") && (
          <FloodImpactPanel fieldId={selectedField.id} flood={sub?.flood} onResult={handleFloodResult} />
        )}

        {result && sub && (
          <>
            <div className="card mb-3 cm-summary-card">
              <div className="card-header">
                <i className="bi bi-speedometer2 me-1" /> {t("crop.summary")}
              </div>
              <div className="card-body">
                <div className="cm-summary-grid">
                  <div className="cm-summary-tile">
                    <i className="bi bi-heart-pulse" />
                    <div>
                      <span>{t("crop.health")}</span>
                      <strong className={sub.health?.available ? styleFor(HEALTH_LABEL_STYLE, sub.health.health_label).className : "text-muted"}>
                        {sub.health?.available ? styleFor(HEALTH_LABEL_STYLE, sub.health.health_label).label : "-"}
                      </strong>
                    </div>
                  </div>
                  <div className="cm-summary-tile">
                    <i className="bi bi-activity" />
                    <div>
                      <span>NDVI</span>
                      <strong>{sub.health?.available ? fmtNum(sub.health.ndvi_mean, 3) : "-"}</strong>
                    </div>
                  </div>
                  <div className="cm-summary-tile">
                    <i className="bi bi-graph-up-arrow" />
                    <div>
                        <span>{t("crop.change")}</span>
                      <strong>
                        {sub.health?.available && sub.health.change_vs_previous_month_pct != null
                          ? `${sub.health.change_vs_previous_month_pct > 0 ? "+" : ""}${fmtPct(sub.health.change_vs_previous_month_pct)}`
                          : "-"}
                      </strong>
                    </div>
                  </div>
                  <div className="cm-summary-tile">
                    <i className="bi bi-droplet-half" />
                    <div>
                      <span>{t("crop.moisture")}</span>
                      <strong className={sub.water_moisture?.available ? styleFor(WATER_STRESS_STYLE, sub.water_moisture.water_stress_label).className : "text-muted"}>
                        {sub.water_moisture?.available ? styleFor(WATER_STRESS_STYLE, sub.water_moisture.water_stress_label).label : "-"}
                      </strong>
                    </div>
                  </div>
                  <div className="cm-summary-tile">
                    <i className="bi bi-flower2" />
                    <div>
                      <span>{t("crop.growthStage")}</span>
                      <strong>{sub.growth_stage?.available ? sub.growth_stage.stage : "-"}</strong>
                    </div>
                  </div>
                  <div className="cm-summary-tile">
                    <i className="bi bi-shield-exclamation" />
                    <div>
                      <span>{t("crop.risk")}</span>
                      <strong className={sub.risk_score?.available ? styleFor(RISK_LEVEL_STYLE, sub.risk_score.level).className : "text-muted"}>
                        {sub.risk_score?.available ? `${sub.risk_score.score} (${styleFor(RISK_LEVEL_STYLE, sub.risk_score.level).label})` : "-"}
                      </strong>
                    </div>
                  </div>
                </div>
                {result.skipped.length > 0 && (
                  <small className="text-muted d-block mt-2">
                    {t("crop.skipped")}: {result.skipped.map((s) => `${s.sub_analysis} (${s.reason})`).join("; ")}
                  </small>
                )}
              </div>
            </div>

            {sub.health && <CropHealthCard health={sub.health} />}
            <VegetationTimeSeriesChart
              fieldId={result.field.id}
              period={lastPeriod}
              timeseries={sub.timeseries}
              index={timeseriesIndex}
              onResult={handleTimeseriesResult}
            />
            {sub.anomaly && <CropAnomalyMap anomaly={sub.anomaly} />}
            {sub.growth_stage && <GrowthStagePanel growthStage={sub.growth_stage} commodity={activeCommodity} />}
            {sub.water_moisture && <WaterMoisturePanel waterMoisture={sub.water_moisture} />}
            {sub.weather && <WeatherPanel weather={sub.weather} />}
            {sub.productivity_zones && <ProductivityZonesPanel productivityZones={sub.productivity_zones} />}
            {sub.historical_comparison && <HistoricalComparisonPanel historicalComparison={sub.historical_comparison} />}
            {sub.risk_score && <CropRiskScoreCard riskScore={sub.risk_score} />}

            <CropMonitoringResultsMapPanel
              fieldFeature={fieldFeature}
              subAnalyses={sub}
              analysisDate={result.period.end || customEnd || customStart || undefined}
            />
          </>
        )}

        {!result && (
          <div className="cm-empty-state">
            <div className="cm-empty-icon">
              <i className="bi bi-radar" />
            </div>
            <div>
              <span className="cm-eyebrow">{t("crop.ready")}</span>
              <h2>{t("crop.emptyTitle")}</h2>
              <p>
                {t("crop.emptyDescription")}
              </p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
