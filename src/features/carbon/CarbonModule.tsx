import { useEffect, useMemo, useState } from "react";
import { useConfigStore } from "@/hooks/useConfigStore";
import { useUiStore } from "@/hooks/useUiStore";
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
import { analyzeVegetation } from "@/features/vegetation/api";
import { analyzeLandCover } from "@/features/landcover/api";
import { analyzeCarbon } from "@/features/carbon/api";
import { DEFAULT_VEGETATION_INDICES } from "@/features/vegetation/indices";
import {
  DEFAULT_CARBON_REFERENCE_DATASET,
  CARBON_DATASET_YEARS,
} from "@/features/carbon/referenceDatasets";
import { boundsToPayload } from "@/features/carbon/lib/geo";
import type { AoiPayload } from "@/features/carbon/lib/geo";
import type {
  AoiState,
  AnalysisType,
  CarbonParams,
  CarbonModelListItem,
  AnalysisProcessingTimes,
} from "@/features/carbon/types";
import type { VegetationParams } from "@/features/vegetation/types";
import type { LandCoverParams } from "@/features/landcover/types";
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

  const [year, setYear] = useState(yearMax);
  const [zoom, setZoom] = useState(10);
  const [aoi, setAoi] = useState<AoiState | null>(null);
  const [analysisType, setAnalysisType] = useState<AnalysisType>("carbon");

  const [carbonPartial, setCarbonPartial] = useState<CarbonPartial>({
    startMonth: 1,
    endMonth: 12,
    cloudThreshold: 10,
    clipMode: "clipped",
    referenceDataset: DEFAULT_CARBON_REFERENCE_DATASET,
    datasetYear: CARBON_DATASET_YEARS[0],
    modelName: null,
    showReference: true,
  });
  const [selectedModel, setSelectedModel] = useState<CarbonModelListItem | null>(null);

  const [vegParams, setVegParams] = useState<VegetationParams>({
    startMonth: 6,
    endMonth: 9,
    cloudThreshold: 40,
    indices: DEFAULT_VEGETATION_INDICES,
  });

  const [lcParams, setLcParams] = useState<LandCoverParams>({
    datasets: ["Dynamic_World"],
    dwMode: "mode",
    includeImprobableClasses: false,
    startMonth: 1,
    endMonth: 6,
  });

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [results, setResults] = useState<AnalysisResultsBundle>({});
  const [processingTimes, setProcessingTimes] = useState<AnalysisProcessingTimes>({});
  const [mapKey, setMapKey] = useState(0);

  const carbonParams: CarbonParams = useMemo(() => ({ ...carbonPartial, year }), [carbonPartial, year]);

  useEffect(() => {
    window.currentAOI = aoi ? { geojson: aoi.feature, name: aoi.name } : null;
    return () => {
      window.currentAOI = null;
    };
  }, [aoi]);

  function patchCarbon(patch: Partial<CarbonPartial>) {
    setCarbonPartial((p) => ({ ...p, ...patch }));
  }

  const hasResults = Object.keys(results).length > 0;

  useEffect(() => {
    window.analysisResults = results as Record<string, unknown>;
    return () => {
      window.analysisResults = {};
    };
  }, [results]);

  async function handleRunAnalysis() {
    if (!aoi) {
      setRunError("Pilih AOI terlebih dahulu.");
      return;
    }
    const aoiPayload: AoiPayload = aoi.feature
      ? { geojson: aoi.feature }
      : aoi.bounds
        ? boundsToPayload(aoi.bounds)
        : null!;
    if (!aoiPayload) {
      setRunError("AOI tidak valid.");
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

    showLoading("Menjalankan analisis...", "Mempersiapkan permintaan...");

    if (runVeg) {
      setLoadingProgress(15, "Memproses indeks vegetasi (citra Sentinel-2)...");
      const t0 = Date.now();
      try {
        newResults.vegetation = await analyzeVegetation(aoiPayload, year, vegParams);
      } catch (err) {
        errors.push(`Vegetasi gagal: ${err instanceof ApiError ? err.message : "network error"}`);
      }
      times.vegetation = ((Date.now() - t0) / 1000).toFixed(2);
    }

    if (runLc) {
      setLoadingProgress(45, "Memproses dataset tutupan lahan...");
      const t0 = Date.now();
      try {
        newResults.landcover = await analyzeLandCover(aoiPayload, year, lcParams);
      } catch (err) {
        errors.push(`Land cover gagal: ${err instanceof ApiError ? err.message : "network error"}`);
      }
      times.landcover = ((Date.now() - t0) / 1000).toFixed(2);
    }

    if (runCarbon) {
      setLoadingProgress(75, "Menerapkan model terlatih pada citra satelit...");
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
        errors.push(`Karbon gagal: ${err instanceof ApiError ? err.message : "network error"}`);
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
      setRunError(errors.join(" ") || "Tidak ada hasil analisis.");
    } else if (errors.length) {
      setRunError(errors.join(" "));
    }
    window._onSaveGeoAnalysisDone?.();
  }

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

  return (
    <div className="row g-3">
      <div className="col-lg-3">
        <div className="sidebar">
          <h5 className="mb-3">
            <i className="bi bi-gear-fill me-1" /> Pengaturan
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

          <div className="mb-3">
            <label className="form-label">Tahun</label>
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

          <div className="mb-3">
            <label className="form-label">Zoom Peta</label>
            <input
              type="range"
              className="form-range"
              min={5}
              max={15}
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

          {(analysisType === "landcover" || analysisType === "combined") && (
            <LandCoverParamsPanel
              params={lcParams}
              onParamsChange={(patch) => setLcParams((p) => ({ ...p, ...patch }))}
            />
          )}

          <button
            id="runAnalysis"
            className="btn btn-primary w-100 mt-3"
            onClick={handleRunAnalysis}
            disabled={running || !aoi}
          >
            {running ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" /> Menganalisis...
              </>
            ) : (
              <>
                <i className="bi bi-play-fill me-1" /> Jalankan Analisis
              </>
            )}
          </button>
          {!aoi && (
            <small className="text-muted d-block mt-2">Pilih AOI terlebih dahulu untuk mengaktifkan tombol.</small>
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

        {hasResults && aoi && (
          <>
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
        />

            <div className="card">
              <div className="card-header">
                <i className="bi bi-bar-chart-fill me-1" /> Statistik
              </div>
              <div className="card-body">
                <StatsCards results={results} processingTimes={processingTimes} />
                {results.vegetation && <VegStatsTable result={results.vegetation} />}
                {results.landcover && <LandCoverResultTables result={results.landcover} />}
                {results.carbon && <CarbonStatsPanel result={results.carbon} />}
              </div>
            </div>

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
  );
}
