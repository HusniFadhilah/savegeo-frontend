import { useEffect, useMemo, useState } from "react";
import { useConfigStore } from "@/hooks/useConfigStore";
import { useUiStore } from "@/hooks/useUiStore";
import { useAoiStore } from "@/hooks/useAoiStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import { ApiError } from "@/services/apiClient";
import AoiPanel from "./components/AoiPanel";
import AnalysisTypeSelector from "./components/AnalysisTypeSelector";
import CarbonParamsPanel from "./components/CarbonParamsPanel";
import ResultsMapPanel from "./components/ResultsMapPanel";
import StatsCards from "./components/StatsCards";
import CarbonStatsPanel from "./components/CarbonStatsPanel";
import ExportPanel from "./components/ExportPanel";
import VegetationParamsPanel from "@/features/vegetation/components/VegetationParamsPanel";
import VegStatsTable from "@/features/vegetation/components/VegStatsTable";
import LandCoverParamsPanel from "@/features/landcover/components/LandCoverParamsPanel";
import LandCoverResultTables from "@/features/landcover/components/LandCoverResultTables";
import { HIGH_DETAIL_MAX_ZOOM } from "@/config/mapZoom";
import { analyzeVegetation, analyzeVegetationTimeSeries, getVegetationSatellites } from "@/features/vegetation/api";
import VegetationTimeSeriesPanel from "@/features/vegetation/components/VegetationTimeSeriesPanel";
import { analyzeLandCover, fetchLandCoverDatasets } from "@/features/landcover/api";
import { analyzeCarbon, analyzeCarbonDelta, listCarbonDatasets, listCarbonModels, loadDirectCarbonReferenceLayer, loadDirectLandCoverReferenceLayer } from "@/features/carbon/api";
import CarbonTimeSeriesPanel from "./components/CarbonTimeSeriesPanel";
import { DEFAULT_VEGETATION_INDICES, VEGETATION_INDICES } from "@/features/vegetation/indices";
import {
  DEFAULT_CARBON_REFERENCE_DATASET,
  CARBON_DATASET_YEARS,
  carbonDatasetYearOptions,
} from "@/features/carbon/referenceDatasets";
import { boundsToPayload } from "@/features/carbon/lib/geo";
import type { AoiPayload } from "@/features/carbon/lib/geo";
import type {
  AnalysisType,
  CarbonParams,
  CarbonModelListItem,
  CarbonDeltaResponse,
  AnalysisProcessingTimes,
} from "@/features/carbon/types";
import type { VegetationParams, VegetationTimeSeriesResponse } from "@/features/vegetation/types";
import type { LandCoverParams } from "@/features/landcover/types";
import { parseCarbonQuery, serializeCarbonQuery } from "./lib/carbonQueryState";
import { registerUiCommands } from "@/features/chatbot/uiCommandBus";
import type { AnalysisResultsBundle, ReportContext } from "@/features/reports/export";

type CarbonPartial = Omit<CarbonParams, "year">;

/**
 * Full port of module-carbon.html + main.js's carbon/vegetation/landcover
 * analysisType logic: one module, one AOI, one Analysis Type selector
 * (Land Cover / Vegetation Indices / Carbon Stock / Combined) - matching
 * the legacy app's structure exactly (there was never a separate
 * vegetation/land-cover tab in the sidebar).
 */
export default function CarbonModule() {
  const t = useI18nStore((s) => s.t);
  const configReady = useConfigStore((s) => s.ready);
  const configLoad = useConfigStore((s) => s.load);
  const getInt = useConfigStore((s) => s.getInt);
  const getArray = useConfigStore((s) => s.getArray);
  const showLoading = useUiStore((s) => s.showLoading);
  const setLoadingProgress = useUiStore((s) => s.setLoadingProgress);
  const hideLoading = useUiStore((s) => s.hideLoading);

  useEffect(() => {
    if (!configReady) void configLoad();
  }, [configReady, configLoad]);

  const yearMin = getInt("year.min", 2015);
  const yearMax = getInt("year.max", new Date().getFullYear());
  const visMin = getInt("carbon.vis_min", 0);
  const visMax = getInt("carbon.vis_max", 200);
  const visPalette = getArray("carbon.vis_palette");
  const carbonLegendBins = getInt("carbon.legend_bins", 6);

  const initialQuery = useMemo(() => typeof window !== "undefined" ? parseCarbonQuery(window.location.search) : { mode: "carbon" as const }, []);
  const [year, setYear] = useState(initialQuery.year ?? yearMax);
  const [zoom, setZoom] = useState(10);
  const aoi = useAoiStore((s) => s.aoi);
  const setAoi = useAoiStore((s) => s.setAoi);
  const [analysisType, setAnalysisType] = useState<AnalysisType>(initialQuery.mode === "landcover_change" ? "landcover" : initialQuery.mode);

  const [carbonPartial, setCarbonPartial] = useState<CarbonPartial>({
    startMonth: 1,
    endMonth: 12,
    cloudThreshold: 10,
    clipMode: "clipped",
    referenceDataset: DEFAULT_CARBON_REFERENCE_DATASET,
    datasetYear: CARBON_DATASET_YEARS[0],
    modelName: null,
    referenceOnly: false,
    showReference: true,
    cloudMaskTechnique: "scl",
  });
  useEffect(() => {
    const q = serializeCarbonQuery({ mode: (analysisType === "combined" ? "carbon" : analysisType), year, monthFrom: carbonPartial.startMonth, monthTo: carbonPartial.endMonth, cloudThreshold: carbonPartial.cloudThreshold, clipMode: carbonPartial.clipMode, showReference: carbonPartial.showReference, view: initialQuery.view, orientation: initialQuery.orientation, opacity: initialQuery.opacity });
    if (typeof window !== "undefined" && window.location.pathname === "/carbon-estimation") window.history.replaceState(null, "", `/carbon-estimation?${q.toString()}`);
  }, [analysisType, year, carbonPartial.startMonth, carbonPartial.endMonth, carbonPartial.cloudThreshold, carbonPartial.clipMode, carbonPartial.showReference, initialQuery.view, initialQuery.orientation, initialQuery.opacity]);
  const [selectedModel, setSelectedModel] = useState<CarbonModelListItem | null>(null);

  // P0 "time-series & timelapse" - carbon-only, mutually exclusive with the
  // single-year combined analysis below (only shown/usable when
  // analysisType === "carbon"). IDs on the checkbox/inputs match what
  // features/chatbot/actionExecutor.ts's carbon_delta_* cases already expect
  // (those were dead until this UI existed).
  const [deltaEnabled, setDeltaEnabled] = useState(false);
  const [deltaStartYear, setDeltaStartYear] = useState(yearMax - 4);
  const [deltaEndYear, setDeltaEndYear] = useState(yearMax);
  const [deltaInterval, setDeltaInterval] = useState(1);
  const [deltaIncludeTiles, setDeltaIncludeTiles] = useState(true);
  const [deltaResult, setDeltaResult] = useState<CarbonDeltaResponse | null>(null);
  const [deltaRunning, setDeltaRunning] = useState(false);
  const [deltaError, setDeltaError] = useState<string | null>(null);

  const [vegParams, setVegParams] = useState<VegetationParams>({
    startMonth: 6,
    endMonth: 9,
    cloudThreshold: 40,
    indices: DEFAULT_VEGETATION_INDICES,
    satellite: "sentinel2",
    cloudMaskTechnique: "scl",
  });

  // P0 "time-series & timelapse" for vegetation - carbon-only-style toggle,
  // mutually exclusive with the single-year combined analysis (only usable
  // when analysisType === "vegetation", monthly series for one index/year).
  const [vegTsEnabled, setVegTsEnabled] = useState(false);
  const [vegTsIndex, setVegTsIndex] = useState("NDVI");
  const [vegTsResult, setVegTsResult] = useState<VegetationTimeSeriesResponse | null>(null);
  const [vegTsRunning, setVegTsRunning] = useState(false);
  const [vegTsError, setVegTsError] = useState<string | null>(null);

  const [lcParams, setLcParams] = useState<LandCoverParams>({
    datasets: ["Dynamic_World"],
    dwMode: "mode",
    includeImprobableClasses: false,
    dateMode: "year",
    startMonth: 1,
    endMonth: 6,
    selectedMonth: 7,
    startDate: `${yearMax}-01-01`,
    endDate: `${yearMax}-12-31`,
  });

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [results, setResults] = useState<AnalysisResultsBundle>({});
  const [processingTimes, setProcessingTimes] = useState<AnalysisProcessingTimes>({});
  const [mapKey, setMapKey] = useState(0);
  const [directLoadEnabled, setDirectLoadEnabled] = useState(false);

  const carbonParams: CarbonParams = useMemo(() => ({ ...carbonPartial, year }), [carbonPartial, year]);

  useEffect(() => {
    if (carbonParams.referenceOnly || directLoadEnabled) setDeltaEnabled(false);
  }, [carbonParams.referenceOnly, directLoadEnabled]);

  useEffect(() => {
    window.currentAOI = aoi ? { geojson: aoi.feature, name: aoi.name, areaKm2: aoi.areaKm2 } : null;
    return () => {
      window.currentAOI = null;
    };
  }, [aoi]);

  function patchCarbon(patch: Partial<CarbonPartial>) {
    setCarbonPartial((p) => ({ ...p, ...patch }));
  }

  const hasResults = Object.keys(results).length > 0;
  const hasDirectResults = Boolean(results.direct?.length);

  useEffect(() => {
    window.analysisResults = results as Record<string, unknown>;
    return () => {
      window.analysisResults = {};
    };
  }, [results]);

  async function handleRunDelta() {
    if (!aoi) {
      setRunError(t("carbon.err.selectAoi"));
      return;
    }
    const aoiPayload: AoiPayload = aoi.feature
      ? { geojson: aoi.feature }
      : aoi.bounds
        ? boundsToPayload(aoi.bounds)
        : null!;
    if (!aoiPayload) {
      setRunError(t("carbon.err.invalidAoi"));
      return;
    }
    if (deltaStartYear >= deltaEndYear) {
      setDeltaError(t("carbon.err.startBeforeEnd"));
      return;
    }

    setDeltaRunning(true);
    setDeltaError(null);
    setRunError(null);
    setResults({});
    showLoading(t("carbon.loading.deltaTitle"), `${deltaStartYear} - ${deltaEndYear}`);
    try {
      const res = await analyzeCarbonDelta({
        aoi: aoiPayload,
        startYear: deltaStartYear,
        endYear: deltaEndYear,
        interval: deltaInterval,
        startMonth: carbonParams.startMonth,
        endMonth: carbonParams.endMonth,
        cloudThreshold: carbonParams.cloudThreshold,
        modelName: carbonParams.modelName,
        cloudMaskTechnique: carbonParams.cloudMaskTechnique,
        includeTiles: deltaIncludeTiles,
        visMin,
        visMax,
        visPalette,
      });
      setDeltaResult(res);
      setMapKey((k) => k + 1);
    } catch (err) {
      setDeltaError(err instanceof ApiError ? err.message : t("carbon.err.deltaFailed"));
      setDeltaResult(null);
    } finally {
      hideLoading();
      setDeltaRunning(false);
    }
    window._onSaveGeoAnalysisDone?.();
  }

  async function handleRunVegTs() {
    if (!aoi) {
      setRunError(t("carbon.err.selectAoi"));
      return;
    }
    const aoiPayload: AoiPayload = aoi.feature
      ? { geojson: aoi.feature }
      : aoi.bounds
        ? boundsToPayload(aoi.bounds)
        : null!;
    if (!aoiPayload) {
      setRunError(t("carbon.err.invalidAoi"));
      return;
    }

    setVegTsRunning(true);
    setVegTsError(null);
    setRunError(null);
    setResults({});
    showLoading(t("carbon.loading.vegTsTitle"), `${vegTsIndex} - ${year}`);
    try {
      const res = await analyzeVegetationTimeSeries({
        aoi: aoiPayload,
        year,
        index: vegTsIndex,
        cloudThreshold: vegParams.cloudThreshold,
        satellite: vegParams.satellite,
        cloudMaskTechnique: vegParams.cloudMaskTechnique,
      });
      setVegTsResult(res);
    } catch (err) {
      setVegTsError(err instanceof ApiError ? err.message : t("carbon.err.vegTsFailed"));
      setVegTsResult(null);
    } finally {
      hideLoading();
      setVegTsRunning(false);
    }
    window._onSaveGeoAnalysisDone?.();
  }

  async function handleRunAnalysis() {
    if (deltaEnabled && analysisType === "carbon") {
      await handleRunDelta();
      return;
    }
    if (vegTsEnabled && analysisType === "vegetation") {
      await handleRunVegTs();
      return;
    }
    setDeltaResult(null);
    setVegTsResult(null);

    if (directLoadEnabled) {
      if (analysisType === "vegetation") {
        setRunError("Mode pemuatan langsung tersedia untuk LULC dan stok karbon, bukan indeks vegetasi.");
        return;
      }
      setRunning(true);
      setRunError(null);
      showLoading("Memuat dataset langsung", "Tanpa AOI dan tanpa model");
      try {
        const directLayers = [];
        if (analysisType === "carbon" || analysisType === "combined") {
          directLayers.push(await loadDirectCarbonReferenceLayer(carbonParams.referenceDataset, carbonParams.datasetYear, visMin, visMax));
        }
        if (analysisType === "landcover" || analysisType === "combined") {
          const selectedDatasets = lcParams.datasets.length ? lcParams.datasets : ["Dynamic_World"];
          const loaded = await Promise.all(selectedDatasets.map((dataset) => loadDirectLandCoverReferenceLayer(dataset, year, {
            startMonth: lcParams.startMonth,
            endMonth: lcParams.endMonth,
            startDate: lcParams.dateMode === "date" ? lcParams.startDate : undefined,
            endDate: lcParams.dateMode === "date" ? lcParams.endDate : undefined,
          })));
          directLayers.push(...loaded);
        }
        setResults({ direct: directLayers });
        setProcessingTimes({ total: "direct" });
        setMapKey((k) => k + 1);
      } catch (err) {
        setResults({});
        setRunError(err instanceof ApiError ? err.message : "Dataset langsung tidak dapat dimuat.");
      } finally {
        hideLoading();
        setRunning(false);
      }
      return;
    }

    if (!aoi) {
      setRunError(t("carbon.err.selectAoi"));
      return;
    }
    const aoiPayload: AoiPayload = aoi.feature
      ? { geojson: aoi.feature }
      : aoi.bounds
        ? boundsToPayload(aoi.bounds)
        : null!;
    if (!aoiPayload) {
      setRunError(t("carbon.err.invalidAoi"));
      return;
    }

    setRunning(true);
    setRunError(null);
    const newResults: AnalysisResultsBundle = {};
    const times: AnalysisProcessingTimes = {};
    const errors: string[] = [];
    const totalStart = Date.now();

    const runVeg = analysisType === "vegetation" || analysisType === "combined";
    const runLc = analysisType === "landcover" || analysisType === "combined";
    const runCarbon = analysisType === "carbon" || analysisType === "combined";

    showLoading(t("carbon.loading.runningTitle"), t("carbon.loading.preparing"));

    if (runVeg) {
      setLoadingProgress(15, t("carbon.loading.vegProgress"));
      const t0 = Date.now();
      try {
        newResults.vegetation = await analyzeVegetation(aoiPayload, year, vegParams);
      } catch (err) {
        errors.push(`${t("carbon.err.vegFailed")}: ${err instanceof ApiError ? err.message : t("carbon.err.networkError")}`);
      }
      times.vegetation = ((Date.now() - t0) / 1000).toFixed(2);
    }

    if (runLc) {
      setLoadingProgress(45, t("carbon.loading.lcProgress"));
      const t0 = Date.now();
      try {
        newResults.landcover = await analyzeLandCover(aoiPayload, year, lcParams);
      } catch (err) {
        errors.push(`${t("carbon.err.lcFailed")}: ${err instanceof ApiError ? err.message : t("carbon.err.networkError")}`);
      }
      times.landcover = ((Date.now() - t0) / 1000).toFixed(2);
    }

    if (runCarbon) {
      setLoadingProgress(75, t("carbon.loading.carbonProgress"));
      const t0 = Date.now();
      try {
        newResults.carbon = await analyzeCarbon({
          aoi: aoiPayload,
          params: carbonParams,
          selectedModel,
          visMin,
          visMax,
          visPalette,
        });
      } catch (err) {
        errors.push(`${t("carbon.err.carbonFailed")}: ${err instanceof ApiError ? err.message : t("carbon.err.networkError")}`);
      }
      times.carbon = ((Date.now() - t0) / 1000).toFixed(2);
    }

    times.total = ((Date.now() - totalStart) / 1000).toFixed(2);
    hideLoading();
    setRunning(false);
    setResults(newResults);
    setProcessingTimes(times);
    setMapKey((k) => k + 1);

    if (Object.keys(newResults).length === 0) {
      setRunError(errors.join(" ") || t("carbon.err.noResults"));
    } else if (errors.length) {
      setRunError(errors.join(" "));
    }
    window._onSaveGeoAnalysisDone?.();
  }

  useEffect(() => registerUiCommands("carbon", {
    read: () => ({
      analysisType,
      analysisYear: year,
      referenceDataset: carbonPartial.referenceDataset,
      datasetYear: carbonPartial.datasetYear,
      referenceOnly: carbonPartial.referenceOnly,
      directGlobal: directLoadEnabled,
      modelName: selectedModel?.name ?? null,
      startMonth: carbonPartial.startMonth,
      endMonth: carbonPartial.endMonth,
      cloudThreshold: carbonPartial.cloudThreshold,
      clipMode: carbonPartial.clipMode,
      showReference: carbonPartial.showReference,
      vegetationIndices: vegParams.indices,
      vegetationSensor: vegParams.satellite,
      landcoverDatasets: lcParams.datasets,
      includeImprobableClasses: lcParams.includeImprobableClasses,
      aoiExists: Boolean(aoi),
      running,
      error: runError,
      hasResult: Object.keys(results).length > 0,
    }),
    execute: async ({ action, target, parameters }) => {
      const value = parameters?.value;
      if (action === "set_analysis_type" && target === "carbon.analysisType") {
        if (!["carbon", "vegetation", "landcover", "combined"].includes(String(value))) throw new Error("Jenis analisis tidak tersedia.");
        setAnalysisType(value as AnalysisType);
        return;
      }
      if (action === "run_analysis" && target === "carbon.analysis") {
        if (!aoi && !directLoadEnabled) throw new Error("AOI diperlukan sebelum menjalankan analisis.");
        if (running) throw new Error("Analisis masih berjalan.");
        await handleRunAnalysis();
        return;
      }
      if (action !== "set_parameter") throw new Error(`Perintah ${action} tidak didukung oleh modul karbon.`);
      if (target === "carbon.analysisYear") {
        if (!Number.isInteger(value) || (value as number) < yearMin || (value as number) > yearMax) throw new Error("Tahun analisis di luar rentang yang tersedia.");
        setYear(value as number);
      } else if (target === "carbon.referenceDataset") {
        if (typeof value !== "string" || !value.trim()) throw new Error("Dataset karbon wajib dipilih dari katalog.");
        const available = await listCarbonDatasets();
        if (!available.some((item) => item.value === value && item.isConfigured !== false)) throw new Error("Dataset karbon tidak tersedia atau belum dikonfigurasi.");
        patchCarbon({ referenceDataset: value });
        setSelectedModel(null);
      } else if (target === "carbon.modelName") {
        if (value === null) {
          setSelectedModel(null);
          patchCarbon({ modelName: null });
          return;
        }
        if (typeof value !== "string") throw new Error("Nama model karbon tidak valid.");
        const models = await listCarbonModels(carbonPartial.referenceDataset);
        const model = models.find((item) => item.name === value);
        if (!model) throw new Error("Model tidak tersedia atau tidak kompatibel dengan dataset karbon.");
        setSelectedModel(model);
        patchCarbon({ modelName: model.name });
      } else if (target === "carbon.datasetYear") {
        if (!Number.isInteger(value)) throw new Error("Tahun dataset harus berupa bilangan bulat.");
        const available = await listCarbonDatasets();
        const selected = available.find((item) => item.value === carbonPartial.referenceDataset);
        if (!selected || !carbonDatasetYearOptions(selected).includes(value as number)) throw new Error("Tahun tidak tersedia pada dataset karbon yang dipilih.");
        patchCarbon({ datasetYear: value as number });
      } else if (target === "carbon.referenceOnly") {
        if (typeof value !== "boolean") throw new Error("Mode referensi harus true atau false.");
        patchCarbon({ referenceOnly: value });
        if (value) setDirectLoadEnabled(false);
      } else if (target === "carbon.directGlobal") {
        if (typeof value !== "boolean") throw new Error("Mode dataset langsung harus true atau false.");
        setDirectLoadEnabled(value);
        if (value) {
          patchCarbon({ referenceOnly: false });
          setDeltaEnabled(false);
          setVegTsEnabled(false);
        }
      } else if (target === "carbon.showReference") {
        if (typeof value !== "boolean") throw new Error("Visibilitas referensi harus true atau false.");
        patchCarbon({ showReference: value });
      } else if (target === "carbon.clipMode") {
        if (value !== "clipped" && value !== "full") throw new Error("Mode clip tidak valid.");
        patchCarbon({ clipMode: value });
      } else if (["carbon.startMonth", "carbon.endMonth", "carbon.cloudThreshold"].includes(target)) {
        if (!Number.isInteger(value)) throw new Error("Parameter harus berupa bilangan bulat.");
        const number = value as number;
        if (target === "carbon.cloudThreshold") {
          if (number < 0 || number > 100) throw new Error("Ambang awan harus 0 sampai 100 persen.");
          patchCarbon({ cloudThreshold: number });
        } else {
          if (number < 1 || number > 12) throw new Error("Bulan harus 1 sampai 12.");
          if (target === "carbon.startMonth" && number > carbonPartial.endMonth) throw new Error("Bulan awal harus sebelum bulan akhir.");
          if (target === "carbon.endMonth" && number < carbonPartial.startMonth) throw new Error("Bulan akhir harus setelah bulan awal.");
          patchCarbon(target === "carbon.startMonth" ? { startMonth: number } : { endMonth: number });
        }
      } else if (target === "carbon.vegetationIndices") {
        if (!Array.isArray(value) || !value.length || !value.every((item) => typeof item === "string" && VEGETATION_INDICES.some((idx) => idx.code === item))) throw new Error("Indeks vegetasi tidak tersedia.");
        setVegParams((prev) => ({ ...prev, indices: value as string[] }));
      } else if (target === "carbon.vegetationSensor") {
        if (typeof value !== "string") throw new Error("Sensor vegetasi tidak valid.");
        const catalog = await getVegetationSatellites();
        if (!catalog?.satellites?.[value]) throw new Error("Sensor vegetasi tidak tersedia.");
        setVegParams((prev) => ({ ...prev, satellite: value }));
      } else if (target === "carbon.landcoverDatasets") {
        if (!Array.isArray(value) || !value.length || !value.every((item) => typeof item === "string")) throw new Error("Pilih minimal satu dataset land cover.");
        const catalog = await fetchLandCoverDatasets();
        if (!catalog || !(value as string[]).every((item) => Boolean(catalog[item]))) throw new Error("Dataset land cover tidak tersedia pada katalog.");
        setLcParams((prev) => ({ ...prev, datasets: value as string[] }));
      } else if (target === "carbon.includeImprobableClasses") {
        if (typeof value !== "boolean") throw new Error("Filter kelas harus true atau false.");
        setLcParams((prev) => ({ ...prev, includeImprobableClasses: value }));
      } else {
        throw new Error(`Target ${target} tidak didukung oleh modul karbon.`);
      }
    },
  }), [analysisType, year, carbonPartial, selectedModel, vegParams, lcParams, aoi, running, runError, results, directLoadEnabled, yearMin, yearMax, handleRunAnalysis]);

  const reportContext: ReportContext | null = aoi
    ? {
        aoi,
        analysisType,
        year,
        startMonth: carbonParams.startMonth,
        endMonth: carbonParams.endMonth,
        cloudThreshold: carbonParams.cloudThreshold,
        selectedIndices: vegParams.indices,
        processingTimes,
        results,
      }
    : null;

  const aoiPayloadForExport: AoiPayload | null = aoi
    ? aoi.feature
      ? { geojson: aoi.feature }
      : aoi.bounds
        ? boundsToPayload(aoi.bounds)
        : null
    : null;
  const analysisTypeLabel = t(`carbon.statusChip.${analysisType}`);
  const carbonPeriodLabel = deltaEnabled && analysisType === "carbon"
    ? `${deltaStartYear}-${deltaEndYear}`
    : analysisType === "carbon" && (carbonParams.referenceOnly || directLoadEnabled)
      ? `dataset ${carbonParams.datasetYear}`
      : String(year);

  return (
    <div className="analysis-page analysis-page-carbon">
      <section className="analysis-hero analysis-hero-carbon" aria-labelledby="carbonHeroTitle">
        <div className="analysis-hero-main">
          <span className="analysis-eyebrow">{t("carbon.hero.eyebrow")}</span>
          <h1 id="carbonHeroTitle">{t("carbon.hero.title")}</h1>
          <p>{t("carbon.hero.subtitle")}</p>
        </div>
        <div className="analysis-hero-status">
          <div className="analysis-status-card">
            <i className="bi bi-bounding-box-circles" />
            <div>
              <span>{t("carbon.status.aoi")}</span>
              <strong>{aoi?.name ?? t("carbon.status.aoiEmpty")}</strong>
            </div>
          </div>
          <div className="analysis-status-card">
            <i className="bi bi-cpu" />
            <div>
              <span>{t("carbon.status.analysis")}</span>
              <strong>{analysisTypeLabel}</strong>
            </div>
          </div>
          <div className="analysis-status-card">
            <i className="bi bi-calendar3" />
            <div>
              <span>{t("carbon.status.period")}</span>
              <strong>{carbonPeriodLabel}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="row g-3 align-items-start">
        <div className="col-lg-3">
        <div className="sidebar">
          <h5 className="mb-3">
            <i className="bi bi-gear-fill me-1" /> {t("carbon.sidebar.settings")}
          </h5>

          <AnalysisTypeSelector value={analysisType} onChange={setAnalysisType} />

          {(analysisType === "carbon" || analysisType === "combined") && (
            <CarbonParamsPanel
              params={carbonParams}
              onParamsChange={patchCarbon}
              selectedModel={selectedModel}
              onModelSelect={setSelectedModel}
            />
          )}

          {analysisType === "carbon" && (
            <div className="form-check form-switch mb-2">
              <input
                id="enableCarbonDelta"
                className="form-check-input"
                type="checkbox"
                checked={deltaEnabled}
                disabled={carbonParams.referenceOnly || directLoadEnabled}
                onChange={(e) => setDeltaEnabled(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="enableCarbonDelta">
                <i className="bi bi-clock-history" /> {t("carbon.sidebar.deltaToggle")}
              </label>
            </div>
          )}

          {deltaEnabled && analysisType === "carbon" ? (
            <div className="mb-3">
              <label className="form-label">{t("carbon.sidebar.yearRange")}</label>
              <div className="d-flex gap-2 align-items-center mb-1">
                <input
                  id="carbonDeltaStartYear"
                  type="number"
                  className="form-control form-control-sm"
                  min={yearMin}
                  max={yearMax}
                  value={deltaStartYear}
                  onChange={(e) => setDeltaStartYear(Number(e.target.value))}
                />
                <span className="text-muted">–</span>
                <input
                  id="carbonDeltaEndYear"
                  type="number"
                  className="form-control form-control-sm"
                  min={yearMin}
                  max={yearMax}
                  value={deltaEndYear}
                  onChange={(e) => setDeltaEndYear(Number(e.target.value))}
                />
              </div>
              <div className="d-flex gap-2 align-items-center">
                <label className="form-label mb-0 small text-muted" htmlFor="carbonDeltaInterval">
                  {t("carbon.sidebar.interval")}
                </label>
                <input
                  id="carbonDeltaInterval"
                  type="number"
                  className="form-control form-control-sm"
                  style={{ width: 70 }}
                  min={1}
                  max={10}
                  value={deltaInterval}
                  onChange={(e) => setDeltaInterval(Math.max(1, Number(e.target.value)))}
                />
              </div>
              <div className="form-check mt-2">
                <input
                  id="carbonDeltaIncludeTiles"
                  className="form-check-input"
                  type="checkbox"
                  checked={deltaIncludeTiles}
                  onChange={(e) => setDeltaIncludeTiles(e.target.checked)}
                />
                <label className="form-check-label small" htmlFor="carbonDeltaIncludeTiles">
                  {t("carbon.sidebar.includeTiles")}
                </label>
              </div>
              {deltaError && <div className="alert alert-danger py-1 px-2 mt-2 small">{deltaError}</div>}
            </div>
          ) : !(analysisType === "carbon" && (carbonParams.referenceOnly || directLoadEnabled)) ? (
            <div className="mb-3">
              <label className="form-label">{t("carbon.sidebar.year")}</label>
              <input
                id="yearSlider"
                type="range"
                className="form-range"
                min={yearMin}
                max={yearMax}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
              <div className="text-center">
                <strong>{year}</strong>
                <span id="yearValue" className="visually-hidden">
                  {year}
                </span>
              </div>
            </div>
          ) : null}

          <div className="mb-3">
            <label className="form-label">{t("carbon.sidebar.zoom")}</label>
            <input
              type="range"
              className="form-range"
              min={5}
              max={HIGH_DETAIL_MAX_ZOOM}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
            <div className="text-center">
              <strong>{zoom}</strong>
            </div>
          </div>

          <hr />

          {(analysisType === "vegetation" || analysisType === "combined") && (
            <VegetationParamsPanel
              params={vegParams}
              onParamsChange={(patch) => setVegParams((p) => ({ ...p, ...patch }))}
            />
          )}

          {analysisType === "vegetation" && (
            <div className="form-check form-switch mb-2">
              <input
                id="enableVegTimeSeries"
                className="form-check-input"
                type="checkbox"
                checked={vegTsEnabled}
                onChange={(e) => setVegTsEnabled(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="enableVegTimeSeries">
                <i className="bi bi-graph-up" /> {t("carbon.sidebar.vegTsToggle")}
              </label>
            </div>
          )}

          {vegTsEnabled && analysisType === "vegetation" && (
            <div className="mb-3">
              <label className="form-label">{t("carbon.sidebar.indexSingle")}</label>
              <select
                id="vegTsIndex"
                className="form-select form-select-sm"
                value={vegTsIndex}
                onChange={(e) => setVegTsIndex(e.target.value)}
              >
                {VEGETATION_INDICES.map((idx) => (
                  <option key={idx.code} value={idx.code}>
                    {idx.label}
                  </option>
                ))}
              </select>
              <small className="text-muted d-block mt-1">{t("carbon.sidebar.vegTsHint")}</small>
              {vegTsError && <div className="alert alert-danger py-1 px-2 mt-2 small">{vegTsError}</div>}
            </div>
          )}

          {(analysisType === "landcover" || analysisType === "combined") && (
            <LandCoverParamsPanel
              params={lcParams}
              year={year}
              onParamsChange={(patch) => setLcParams((p) => ({ ...p, ...patch }))}
            />
          )}

          {(analysisType === "carbon" || analysisType === "landcover" || analysisType === "combined") && (
            <div className="form-check form-switch mb-2">
              <input
                id="directDatasetLoad"
                className="form-check-input"
                type="checkbox"
                checked={directLoadEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setDirectLoadEnabled(enabled);
                  if (enabled) {
                    setDeltaEnabled(false);
                    setVegTsEnabled(false);
                    // Global loading is independent of AOI reference-only
                    // analysis; keeping both toggles on would be ambiguous.
                    patchCarbon({ referenceOnly: false });
                  }
                }}
              />
              <label className="form-check-label small" htmlFor="directDatasetLoad">
                <i className="bi bi-globe2 me-1" /> Tampilkan dataset global tanpa AOI/model
              </label>
              <small className="text-muted d-block">Tahun mengikuti dataset yang dipilih; statistik baru dihitung setelah AOI dipilih.</small>
            </div>
          )}

          <button
            id="runAnalysis"
            className="btn btn-primary w-100 mt-3"
            onClick={handleRunAnalysis}
            disabled={running || deltaRunning || vegTsRunning || (!aoi && !directLoadEnabled)}
          >
            {running || deltaRunning || vegTsRunning ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" /> {t("carbon.sidebar.analyzing")}
              </>
            ) : (
              <>
                <i className="bi bi-play-fill me-1" /> {t("carbon.sidebar.runAnalysis")}
              </>
            )}
          </button>
          {!aoi && !directLoadEnabled && (
            <small className="text-muted d-block mt-2">{t("carbon.sidebar.selectAoiHint")}</small>
          )}
        </div>
      </div>

      <div className="col-lg-9">
        <AoiPanel aoi={aoi} onAoiChange={setAoi} />

        {runError && (
          <div className="alert alert-warning py-2">
            <i className="bi bi-exclamation-triangle me-1" /> {runError}
          </div>
        )}

        {deltaResult && aoi && (
          <CarbonTimeSeriesPanel
            result={deltaResult}
            zoom={zoom}
            center={aoi.bounds ? [aoi.bounds.getCenter().lat, aoi.bounds.getCenter().lng] : [-2.5, 118]}
            visMin={visMin}
            visMax={visMax}
            visPalette={visPalette}
            legendBins={carbonLegendBins}
          />
        )}

        {vegTsResult && <VegetationTimeSeriesPanel result={vegTsResult} />}

        {hasResults && (aoi || results.direct?.length) && !deltaResult && !vegTsResult && (
          <>
            {hasDirectResults && <div className="alert alert-info small" role="status">
              {(results.direct ?? []).map((layer) => <div key={layer.dataset}>
                {layer.dataset_name}: tahun dataset referensi <strong>{layer.effective_year ?? layer.year ?? "tidak diketahui"}</strong>
                {layer.requested_year != null && layer.requested_year !== (layer.effective_year ?? layer.year)
                  ? ` (tahun yang diminta ${layer.requested_year})` : ""}.
                {layer.target_pool === "aboveground_belowground_biomass_carbon" && " Pool: karbon biomassa atas dan bawah tanah."}
                {layer.target_pool === "soil_organic_carbon" && " Pool: karbon organik tanah."}
              </div>)}
              Statistik dan total karbon memerlukan AOI.
            </div>}
            <ResultsMapPanel
              aoi={aoi}
              zoom={zoom}
              results={results}
          visMin={visMin}
          visMax={visMax}
          visPalette={visPalette}
          legendBins={carbonLegendBins}
          showReference={carbonParams.showReference}
          mapKey={mapKey}
          analysisDate={`${year}-12-31`}
        />

            {!hasDirectResults && <div className="card">
              <div className="card-header">
                <i className="bi bi-bar-chart-fill me-1" /> {t("carbon.results.statsHeader")}
              </div>
              <div className="card-body">
                <StatsCards results={results} processingTimes={processingTimes} />
                {results.vegetation && <VegStatsTable result={results.vegetation} />}
                {results.landcover && <LandCoverResultTables result={results.landcover} />}
                {results.carbon && <CarbonStatsPanel result={results.carbon} />}
              </div>
            </div>}

            {reportContext && aoiPayloadForExport && (
              <ExportPanel
                reportContext={reportContext}
                aoiPayload={aoiPayloadForExport}
                modelName={carbonParams.modelName}
              />
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}

