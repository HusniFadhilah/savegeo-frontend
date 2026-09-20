import { useCallback, useEffect, useMemo, useState } from "react";
import type { AoiFeature } from "@/types/map";
import { useConfigStore } from "@/hooks/useConfigStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import { useUiStore } from "@/hooks/useUiStore";
import { useAoiStore } from "@/hooks/useAoiStore";
import { boundsFromGeoJSON, areaKm2 } from "@/features/carbon/lib/geo";
import { ApiError } from "@/services/apiClient";
import SearchableSelect from "@/components/ui/SearchableSelect";
import AoiPickerModal from "@/components/map/AoiPickerModal";
import { analyzeLandCoverChangeMap, analyzeLandCoverYear } from "./api";
import { fetchLandCoverDatasets } from "@/features/landcover/api";
import { computeTransitions, DATASET_NOTES, DATASET_OPTIONS } from "./utils";
import type { ChangeMapMode, LcChangeMapResponse, LcDataset, LcYearResult } from "./types";
import YearSelector from "./components/YearSelector";
import TransitionMatrixTable from "./components/TransitionMatrixTable";
import NetChangeChart from "./components/NetChangeChart";
import TimeSeriesChart from "./components/TimeSeriesChart";
import SummaryPanel from "./components/SummaryPanel";
import BeforeAfterMaps from "./components/BeforeAfterMaps";
import HotspotPanel from "./components/HotspotPanel";
import { parseQuery, updateUrlFromState } from "./lib/lcChangeQueryState";
import { registerUiCommands } from "@/features/chatbot/uiCommandBus";

type Tab = "matrix" | "netchange" | "timeseries" | "maps" | "hotspot";

/** Soft warning threshold - see same constant in carbon/components/AoiPanel.tsx for rationale. */
const AOI_TIMEOUT_RISK_KM2 = 500;

/**
 * "Mode Tanggal Analisis" (Tahun/Bulan/Tanggal) - 3 mockups the user provided.
 * Only Dynamic World actually honors month/day-level windows on the backend
 * (analyze_landcover: every other dataset ignores start_month/end_month and
 * start_date/end_date, always using the full calendar year - see the "Berlaku
 * untuk Dynamic World" note already on the month range control). "Tahun" =
 * full Jan-Dec (no extra params beyond `year`); "Bulan" = existing month-range
 * selects; "Tanggal" = explicit day-level start/end, re-yeared per year by the
 * backend (`_reyear_date`)/derived from the date itself (`analyze_landcover`).
 */
type DateMode = "year" | "month" | "date";

/** MM-DD (no year - re-yeared per analyzed year, both by this component and the backend). */
const DEFAULT_TANGGAL_START = "01-01";
const DEFAULT_TANGGAL_END = "12-31";
const DYNAMIC_WORLD_COMPATIBLE_DATASETS = new Set([
  "Dynamic_World",
  "GeoSave_Copernicus_DynamicWorld",
]);

/** Builds a real YYYY-MM-DD for a given calendar year from a "MM-DD" fragment, for sending to the backend or a native date input. */
function tanggalToIso(year: number, monthDay: string): string {
  return `${year}-${monthDay}`;
}

/** Native <input type="date"> needs a full date; year is cosmetic here (backend/this component only look at month/day). */
const TANGGAL_INPUT_YEAR = 2000;

/**
 * Land Cover Change module - before/after year comparison with a transition
 * matrix. Full port of `frontend-nextjs2` LCChange (main.js) +
 * module-lc-change.html, adapted to this app's foundation:
 *  - AOI: legacy reused the Carbon module's global `currentAOI`. This app
 *    now shares AOI across modules via `useAoiStore` (see @/hooks/useAoiStore) -
 *    an AOI set in the Carbon module's AoiPanel (admin/coordinate/draw/upload/
 *    company tabs) shows up here too. LC-Change can still (re)draw/clear the
 *    AOI via its AOI modal, which writes back to the same shared store.
 *  - Charts: legacy used Plotly (Sankey/heatmap/bar/stacked-area), which
 *    isn't installed here (only chart.js/react-chartjs-2). The transition
 *    matrix is a color-scaled HTML table instead of a Plotly heatmap; net
 *    change and time series use chart.js. The Sankey diagram has no
 *    equivalent without adding a new dependency (chartjs-chart-sankey isn't
 *    installed) and is deferred - the matrix table + net-change chart cover
 *    the same information.
 *  - Change map: legacy had one shared Leaflet map with a 4-way mode toggle
 *    (changed/destination/before/after) plus a *separate* "Peta Tahunan"
 *    tab. This port uses the two always-visible before/after MapView
 *    instances mandated by the module foundation: the before/after split is
 *    already the before/after toggle, so the mode toggle only adds an
 *    overlay to the after panel (normal/changed/destination). This also
 *    subsumes the legacy "Peta Tahunan" tab (each panel already shows a
 *    single year's raw classification).
 */
export default function LcChangeModule() {
  const t = useI18nStore((state) => state.t);
  const query = parseQuery(typeof window !== "undefined" ? window.location.search : "");
  const { getInt } = useConfigStore();
  const { showLoading, setLoadingProgress, hideLoading } = useUiStore();

  const maxYear = getInt("year.max", new Date().getFullYear());
  const minYear = getInt("year.min", 2015);

  const aoiState = useAoiStore((s) => s.aoi);
  const setAoiState = useAoiStore((s) => s.setAoi);
  const aoi: AoiFeature | null = aoiState?.feature ?? null;
  // Memoized: AoiDrawingTools' effect depends on this `onChange` identity to
  // decide whether to tear down/recreate its Leaflet FeatureGroup - an inline
  // function here would get a new identity every render (tab switch, dataset
  // fetch, etc.), churning that effect and wiping the just-synced AOI layer
  // (SyncAoiToGroup won't redraw it since none of *its* deps changed).
  const handleAoiChange = useCallback(
    (feature: AoiFeature | null) => {
      if (!feature) {
        setAoiState(null);
        return;
      }
      const bounds = boundsFromGeoJSON(feature);
      setAoiState({
        source: "drawn",
        name: "Poligon Kustom",
        areaKm2: areaKm2(feature, bounds),
        feature,
        bounds,
      });
    },
    [setAoiState],
  );
  const [dataset, setDataset] = useState<LcDataset>((query.dataset as LcDataset) || "Dynamic_World");
  const [years, setYears] = useState<number[]>([query.yearFrom ?? maxYear - 1, query.yearTo ?? maxYear]);
  // A two-year comparison should default to the complete annual Dynamic
  // World composite. A one-month window is opt-in and can legitimately have
  // no scenes for an AOI/year pair.
  const [startMonth, setStartMonth] = useState(query.monthFrom ?? 1);
  const [endMonth, setEndMonth] = useState(query.monthTo ?? 12);
  const [dateMode, setDateMode] = useState<DateMode>("year");
  const [tanggalStart, setTanggalStart] = useState(DEFAULT_TANGGAL_START);
  const [tanggalEnd, setTanggalEnd] = useState(DEFAULT_TANGGAL_END);
  // Dynamic World per-pixel confidence threshold (audit #8) - undefined = no
  // threshold (backend still returns confidence stats using its own 0.5
  // diagnostic default; this only controls whether low-confidence pixels get
  // masked out of the classification itself).
  const [dwThresholdEnabled, setDwThresholdEnabled] = useState(false);
  const [dwProbabilityThreshold, setDwProbabilityThreshold] = useState(query.dwProbabilityThreshold ?? 0.5);
  const [aoiModalOpen, setAoiModalOpen] = useState(false);

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [yearData, setYearData] = useState<Record<number, LcYearResult>>({});
  const [activeYears, setActiveYears] = useState<number[]>([]);
  const [periodFromYear, setPeriodFromYear] = useState<number | null>(null);
  const [periodToYear, setPeriodToYear] = useState<number | null>(null);

  const [mode, setMode] = useState<ChangeMapMode>((query.changeMode as ChangeMapMode) || "normal");
  const [changeMapCache, setChangeMapCache] = useState<Record<string, LcChangeMapResponse>>({});
  const [changeMapLoading, setChangeMapLoading] = useState(false);
  const [changeMapError, setChangeMapError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("matrix");

  useEffect(() => {
    if (typeof window === "undefined" || !["/land-cover-change", "/lc-change"].includes(window.location.pathname)) return;
    updateUrlFromState({ ...query, dataset, yearFrom: years[0], yearTo: years[1], monthFrom: startMonth, monthTo: endMonth, dwProbabilityThreshold, changeMode: mode });
  }, [dataset, years, startMonth, endMonth, dwProbabilityThreshold, mode]);

  // Dataset options fetched from GET /landcover/datasets (same catalog the
  // Landcover feature calls) instead of the 6-item static DATASET_OPTIONS -
  // falls back to that static list if the request fails/is empty.
  const [datasetOptions, setDatasetOptions] = useState(DATASET_OPTIONS);
  const [datasetDocs, setDatasetDocs] = useState<
    Record<string, { year_min?: number; year_max?: number; description?: string }>
  >({});
  useEffect(() => {
    let cancelled = false;
    fetchLandCoverDatasets()
      .then((catalog) => {
        if (cancelled || !catalog) return;
        const entries = Object.values(catalog);
        if (!entries.length) return;
        setDatasetOptions(
          entries.map((ds) => ({ value: ds.key, label: `${ds.name} (${ds.resolution})` })),
        );
        setDatasetDocs(
          catalog as unknown as Record<
            string,
            { year_min?: number; year_max?: number; description?: string }
          >,
        );
      })
      .catch(() => {
        /* keep static fallback options */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const datasetNote = (() => {
    const doc = datasetDocs[dataset];
    if (doc) {
      const years =
        doc.year_min || doc.year_max
          ? `Tersedia: ${doc.year_min ?? "-"}-${doc.year_max ?? "-"}`
          : "";
      const combined = [years, doc.description].filter(Boolean).join(" · ");
      if (combined) return combined;
    }
    return DATASET_NOTES[dataset] || "";
  })();
  const isDynamicWorldCompatible = DYNAMIC_WORLD_COMPATIBLE_DATASETS.has(dataset);

  const periodYears = useMemo(() => {
    if (activeYears.length < 2) return { yearA: null, yearB: null };

    const firstYear = activeYears[0];
    const lastYear = activeYears[activeYears.length - 1];
    let fromYear =
      periodFromYear != null && activeYears.includes(periodFromYear) ? periodFromYear : firstYear;
    let toYear = periodToYear != null && activeYears.includes(periodToYear) ? periodToYear : lastYear;

    if (fromYear === toYear) {
      toYear = activeYears.find((year) => year > fromYear) ?? activeYears.find((year) => year < fromYear) ?? toYear;
    }
    if (fromYear > toYear) [fromYear, toYear] = [toYear, fromYear];

    return { yearA: fromYear, yearB: toYear };
  }, [activeYears, periodFromYear, periodToYear]);
  const { yearA, yearB } = periodYears;

  const trans = useMemo(() => {
    if (yearA == null || yearB == null) return null;
    return computeTransitions(yearData[yearA]?.classes || {}, yearData[yearB]?.classes || {});
  }, [yearA, yearB, yearData]);

  // Mirror AOI + transition summary for the SaveGeo Assistant's grounding context
  // (windowBridge.ts buildGeoAiContext()) - this module has its own AOI, separate
  // from CarbonModule's window.currentAOI, so it needs its own bridge global.
  useEffect(() => {
    window.lcChangeState = {
      aoi: aoi ? (aoi as unknown as GeoJSON.GeoJSON) : null,
      dataset,
      from_year: yearA,
      to_year: yearB,
      transition: trans
        ? {
            dataset,
            from_year: yearA,
            to_year: yearB,
            gains: trans.gains,
            losses: trans.losses,
            matrix: trans.matrix,
          }
        : null,
    };
    return () => {
      window.lcChangeState = null;
    };
  }, [aoi, dataset, yearA, yearB, trans]);

  const changeMapCacheKey =
    yearA != null && yearB != null
      ? `${dataset}:${yearA}:${yearB}:${dateMode}:${startMonth}:${endMonth}:${tanggalStart}:${tanggalEnd}`
      : null;
  const changeMapData = changeMapCacheKey ? (changeMapCache[changeMapCacheKey] ?? null) : null;

  // Fetch the changed-pixel map for the current pair whenever it's needed
  // (matrix/netchange/timeseries tabs don't need it - only fetch lazily when
  // the maps tab is active or already cached, mirroring legacy's on-demand load).
  useEffect(() => {
    if (
      !aoi ||
      !changeMapCacheKey ||
      tab !== "maps" ||
      changeMapCache[changeMapCacheKey] ||
      yearA == null ||
      yearB == null
    ) {
      return;
    }
    let cancelled = false;
    setChangeMapLoading(true);
    setChangeMapError(null);
    analyzeLandCoverChangeMap({
      aoi: { geojson: aoi },
      dataset,
      from_year: yearA,
      to_year: yearB,
      start_month: startMonth,
      end_month: endMonth,
      // Single day-level window, re-yeared by the backend per from_year/to_year
      // (_reyear_date) - not per-year like the main analyze_landcover call.
      ...(dateMode === "date"
        ? {
            start_date: tanggalToIso(yearA, tanggalStart),
            end_date: tanggalToIso(yearB, tanggalEnd),
          }
        : {}),
      ...(isDynamicWorldCompatible && dwThresholdEnabled
        ? { dw_probability_threshold: dwProbabilityThreshold }
        : {}),
    })
      .then((data) => {
        if (cancelled) return;
        setChangeMapCache((prev) => ({ ...prev, [changeMapCacheKey]: data }));
      })
      .catch((err) => {
        if (cancelled) return;
        setChangeMapError(err instanceof ApiError ? err.message : "Gagal memuat peta perubahan.");
      })
      .finally(() => {
        if (!cancelled) setChangeMapLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aoi, changeMapCacheKey, tab]);

  const onDatasetChange = (value: LcDataset) => {
    setDataset(value);
  };

  /** Per-year request params for the current dateMode (see DateMode above). */
  const dateParamsForYear = useCallback(
    (
      year: number,
    ): { start_month: number; end_month: number; start_date?: string; end_date?: string } => {
      if (dateMode === "year") return { start_month: 1, end_month: 12 };
      if (dateMode === "date") {
        const sd = tanggalToIso(year, tanggalStart);
        const ed = tanggalToIso(year, tanggalEnd);
        return {
          start_month: Number(tanggalStart.slice(0, 2)),
          end_month: Number(tanggalEnd.slice(0, 2)),
          start_date: sd,
          end_date: ed,
        };
      }
      return { start_month: startMonth, end_month: endMonth };
    },
    [dateMode, tanggalStart, tanggalEnd, startMonth, endMonth],
  );

  const runAnalysis = async () => {
    if (!aoi) {
      setRunError("Gambar AOI terlebih dahulu di peta.");
      return;
    }
    const uniqueYears = [...new Set(years)].sort((a, b) => a - b);
    if (uniqueYears.length < 2) {
      setRunError("Pilih minimal 2 tahun yang berbeda.");
      return;
    }

    setRunError(null);
    setRunning(true);
    setChangeMapCache({});
    setChangeMapError(null);
    const collected: Record<number, LcYearResult> = {};
    const failedYears: Array<{ year: number; message: string }> = [];

    showLoading("Menganalisis tutupan lahan…", `0 dari ${uniqueYears.length} tahun diproses`);
    for (let i = 0; i < uniqueYears.length; i++) {
      const year = uniqueYears[i];
      setLoadingProgress(
        Math.round((i / uniqueYears.length) * 85) + 5,
        `${i + 1} dari ${uniqueYears.length} tahun diproses (${year})`,
      );
      try {
        const res = await analyzeLandCoverYear({
          aoi: { geojson: aoi },
          year,
          datasets: [dataset],
          ...dateParamsForYear(year),
          ...(isDynamicWorldCompatible && dwThresholdEnabled
            ? { dw_probability_threshold: dwProbabilityThreshold }
            : {}),
        });
        const bucket = res[dataset];
        if (bucket?.classes) {
          collected[year] = bucket;
        } else {
          failedYears.push({ year, message: "Backend tidak mengembalikan kelas land cover." });
        }
      } catch (err) {
        console.error(`LC-change: gagal memuat tahun ${year}`, err);
        failedYears.push({
          year,
          message: err instanceof ApiError ? err.message : "Kesalahan saat memproses Dynamic World.",
        });
      }
    }
    hideLoading();
    setRunning(false);

    const successYears = Object.keys(collected)
      .map(Number)
      .sort((a, b) => a - b);
    if (successYears.length < 2) {
      const detail = failedYears.map(({ year, message }) => `${year}: ${message}`).join(" | ");
      setRunError(
        detail
          ? `Minimal 2 tahun harus berhasil. ${detail}`
          : "Data tidak cukup (minimal 2 tahun berhasil). Coba ubah parameter.",
      );
      return;
    }
    if (failedYears.length) {
      const detail = failedYears.map(({ year, message }) => `${year}: ${message}`).join(" | ");
      setRunError(`Sebagian tahun berhasil, tetapi ${detail}`);
    }
    setYearData(collected);
    setActiveYears(successYears);
    setPeriodFromYear(successYears[0]);
    setPeriodToYear(successYears[successYears.length - 1]);
    setTab("matrix");
  };

  useEffect(() => registerUiCommands("lc_change", {
    read: () => ({
      dataset,
      availableDatasets: datasetOptions.map((item) => item.value),
      fromYear: years[0] ?? null,
      toYear: years[years.length - 1] ?? null,
      startMonth,
      endMonth,
      aoiExists: Boolean(aoi),
      running,
      error: runError,
      hasResult: activeYears.length >= 2,
    }),
    execute: async ({ action, target, parameters }) => {
      const value = parameters?.value;
      if (action === "run_analysis" && target === "lc_change.analysis") {
        if (!aoi) throw new Error("AOI diperlukan sebelum analisis perubahan tutupan lahan.");
        if (running) throw new Error("Analisis masih berjalan.");
        if (years.length < 2 || years[0] >= years[years.length - 1]) throw new Error("Tahun awal harus lebih kecil dari tahun akhir.");
        await runAnalysis();
        return;
      }
      if (action !== "set_parameter") throw new Error(`Perintah ${action} tidak didukung oleh modul perubahan tutupan lahan.`);
      if (target === "lc_change.dataset") {
        if (typeof value !== "string" || !datasetOptions.some((item) => item.value === value)) throw new Error("Dataset perubahan tutupan lahan tidak tersedia.");
        setDataset(value);
      } else if (target === "lc_change.fromYear" || target === "lc_change.toYear") {
        if (!Number.isInteger(value) || (value as number) < minYear || (value as number) > maxYear) throw new Error("Tahun di luar rentang yang tersedia.");
        const from = target === "lc_change.fromYear" ? value as number : years[0];
        const to = target === "lc_change.toYear" ? value as number : years[years.length - 1];
        if (from >= to) throw new Error("Tahun awal harus lebih kecil dari tahun akhir.");
        const doc = datasetDocs[dataset];
        if (doc && ((doc.year_min && from < doc.year_min) || (doc.year_max && to > doc.year_max))) throw new Error("Tahun tidak tersedia pada dataset yang dipilih.");
        setYears([from, to]);
      } else if (target === "lc_change.startMonth" || target === "lc_change.endMonth") {
        if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 12) throw new Error("Bulan harus 1 sampai 12.");
        const from = target === "lc_change.startMonth" ? value as number : startMonth;
        const to = target === "lc_change.endMonth" ? value as number : endMonth;
        if (from > to) throw new Error("Bulan awal harus sebelum bulan akhir.");
        if (!isDynamicWorldCompatible) throw new Error("Rentang bulan hanya tersedia untuk Dynamic World.");
        setDateMode("month");
        if (target === "lc_change.startMonth") setStartMonth(from);
        else setEndMonth(to);
      } else {
        throw new Error(`Target ${target} tidak didukung oleh modul perubahan tutupan lahan.`);
      }
    },
  }), [dataset, years, startMonth, endMonth, aoi, running, runError, activeYears, datasetOptions, datasetDocs, minYear, maxYear, isDynamicWorldCompatible, runAnalysis]);

  const downloadData = () => {
    const payload = {
      export_date: new Date().toISOString(),
      dataset,
      aoi_name: aoi ? "AOI tergambar" : "unknown",
      years_analyzed: activeYears,
      year_data: yearData,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lc_change_${dataset}_${activeYears.join("-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasResults = activeYears.length >= 2 && trans != null && yearA != null && yearB != null;
  const selectedYearRange = [...new Set(years)].sort((a, b) => a - b);
  const yearRangeLabel = selectedYearRange.length
    ? `${selectedYearRange[0]}-${selectedYearRange[selectedYearRange.length - 1]}`
    : "-";
  const periodFromOptions = activeYears.slice(0, -1).map((year) => ({
    value: String(year),
    label: String(year),
  }));
  const periodToOptions = activeYears
    .filter((year) => yearA == null || year > yearA)
    .map((year) => ({ value: String(year), label: String(year) }));

  const handlePeriodFromChange = (value: string) => {
    const nextFromYear = Number(value);
    setPeriodFromYear(nextFromYear);
    if (yearB == null || nextFromYear >= yearB) {
      setPeriodToYear(activeYears.find((year) => year > nextFromYear) ?? null);
    }
  };

  const handlePeriodToChange = (value: string) => {
    setPeriodToYear(Number(value));
  };

  const monthOptions = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agt",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];

  return (
    <div className="analysis-page analysis-page-lc">
      <section className="analysis-hero analysis-hero-lc" aria-labelledby="lcChangeHeroTitle">
        <div className="analysis-hero-main">
          <span className="analysis-eyebrow">{t("lc.eyebrow")}</span>
          <h1 id="lcChangeHeroTitle">{t("lc.title")}</h1>
          <p>
            {t("lc.description")}
          </p>
        </div>
        <div className="analysis-hero-status">
          <div className="analysis-status-card">
            <i className="bi bi-vector-pen" />
            <div>
              <span>AOI</span>
              <strong>
                {aoiState?.areaKm2 != null
                  ? `${aoiState.areaKm2.toFixed(2)} km2`
                  : t("lc.notDrawn")}
              </strong>
            </div>
          </div>
          <div className="analysis-status-card">
            <i className="bi bi-layers" />
            <div>
              <span>{t("lc.dataset")}</span>
              <strong>{dataset.replace(/_/g, " ")}</strong>
            </div>
          </div>
          <div className="analysis-status-card">
            <i className="bi bi-calendar-range" />
            <div>
              <span>{t("lc.year")}</span>
              <strong>{yearRangeLabel}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="row g-3">
        {/* Control panel */}
        <div className="col-lg-3">
          <div className="sidebar">
            <h5 className="mb-3">
              <i className="fas fa-cog" /> {t("lc.settings")}
            </h5>

            <div className="mb-3">
              <label className="form-label fw-bold">
                <i className="fas fa-map-marker-alt" /> {t("lc.aoi")}
              </label>
              {aoi ? (
                <div className="alert alert-success py-2 mb-0" style={{ fontSize: ".8rem" }}>
                  <i className="fas fa-check-circle" /> {t("lc.aoiDrawn")} ({aoi.geometry.type})
                  {aoiState?.areaKm2 != null && <> &middot; {aoiState.areaKm2.toFixed(2)} km²</>}
                </div>
              ) : (
                <div className="alert alert-warning py-2 mb-0" style={{ fontSize: ".8rem" }}>
                  <i className="fas fa-exclamation-triangle" /> {t("lc.chooseAoi")}
                </div>
              )}
              <button
                type="button"
                className="btn btn-sm btn-outline-success w-100 mt-2"
                onClick={() => setAoiModalOpen(true)}
              >
                <i className="bi bi-bounding-box-circles" /> {t("lc.selectDrawAoi")}
              </button>
              {aoiState?.areaKm2 != null && aoiState.areaKm2 >= AOI_TIMEOUT_RISK_KM2 && (
                <div className="alert alert-warning py-2 mb-0 mt-2" style={{ fontSize: ".8rem" }}>
                  <i className="fas fa-triangle-exclamation" /> AOI besar (
                  {aoiState.areaKm2.toFixed(0)} km²) - analisis per tahun bisa lambat/timeout,
                  apalagi untuk banyak tahun sekaligus. Pertimbangkan area lebih kecil.
                </div>
              )}
              {aoi && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary w-100 mt-2"
                  onClick={() => setAoiState(null)}
                >
                  <i className="fas fa-eraser" /> {t("lc.removeAoi")}
                </button>
              )}
            </div>

            <hr />

            <div className="mb-3">
              <label className="form-label fw-bold" htmlFor="lcChangeDataset">
                <i className="fas fa-database" /> {t("lc.datasetLulc")}
              </label>
              <SearchableSelect
                id="lcChangeDataset"
                value={dataset}
                onChange={(v) => onDatasetChange(v as LcDataset)}
                options={datasetOptions.map((d) => ({ value: d.value, label: d.label }))}
              />
              <small className="text-muted d-block mt-1">{datasetNote}</small>
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold">
                <i className="fas fa-calendar-alt" /> {t("lc.analysisYears")}
              </label>
              <YearSelector years={years} minYear={minYear} maxYear={maxYear} onChange={setYears} />
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold">
                <i className="fas fa-calendar" /> {t("lc.dateMode")}
              </label>
              <div className="btn-group w-100" role="group">
                <button
                  type="button"
                  className={`btn btn-sm ${dateMode === "year" ? "btn-warning" : "btn-outline-secondary"}`}
                  onClick={() => setDateMode("year")}
                >
                  {t("lc.yearMode")}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${dateMode === "month" ? "btn-warning" : "btn-outline-secondary"}`}
                  onClick={() => setDateMode("month")}
                >
                  {t("lc.monthMode")}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${dateMode === "date" ? "btn-warning" : "btn-outline-secondary"}`}
                  onClick={() => setDateMode("date")}
                >
                  {t("lc.dateModeShort")}
                </button>
              </div>

              {dateMode === "year" && (
                <small className="text-muted d-block mt-2">
                  {t("lc.fullYearHint")}
                </small>
              )}

              {dateMode === "month" && (
                <div className="mt-2">
                  <div className="d-flex align-items-center gap-2">
                    <select
                      className="form-select form-select-sm"
                      value={startMonth}
                      onChange={(e) => setStartMonth(Number(e.target.value))}
                    >
                      {monthOptions.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <span className="text-muted">–</span>
                    <select
                      className="form-select form-select-sm"
                      value={endMonth}
                      onChange={(e) => setEndMonth(Number(e.target.value))}
                    >
                      {monthOptions.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {dateMode === "date" && (
                <div className="mt-2">
                  <div className="d-flex align-items-center gap-2">
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={tanggalToIso(TANGGAL_INPUT_YEAR, tanggalStart)}
                      onChange={(e) => setTanggalStart(e.target.value.slice(5))}
                    />
                    <span className="text-muted">–</span>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={tanggalToIso(TANGGAL_INPUT_YEAR, tanggalEnd)}
                      onChange={(e) => setTanggalEnd(e.target.value.slice(5))}
                    />
                  </div>
                  <small className="text-muted d-block mt-1">
                    {t("lc.partialDateHint")}
                  </small>
                </div>
              )}

              {!isDynamicWorldCompatible && dateMode !== "year" && (
                <small className="text-warning d-block mt-1">
                  <i className="fas fa-triangle-exclamation" /> Dataset ini selalu memakai satu
                  tahun penuh - jendela bulan/tanggal hanya berlaku untuk Dynamic World/GeoSave
                  Copernicus.
                </small>
              )}
            </div>

            {isDynamicWorldCompatible && (
              <div className="mb-3">
                <div className="form-check form-switch mb-1">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="lcDwThresholdSwitch"
                    checked={dwThresholdEnabled}
                    onChange={(e) => setDwThresholdEnabled(e.target.checked)}
                  />
                  <label className="form-check-label fw-bold" htmlFor="lcDwThresholdSwitch">
                    <i className="fas fa-shield-halved" /> {t("lc.confidenceThreshold")}
                  </label>
                </div>
                {dwThresholdEnabled && (
                  <>
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="range"
                        className="form-range"
                        min={0.1}
                        max={0.9}
                        step={0.05}
                        value={dwProbabilityThreshold}
                        onChange={(e) => setDwProbabilityThreshold(Number(e.target.value))}
                      />
                      <span className="badge bg-secondary" style={{ minWidth: 48 }}>
                        {Math.round(dwProbabilityThreshold * 100)}%
                      </span>
                    </div>
                    <small className="text-muted d-block">
                      {t("lc.confidenceMaskHint")}
                    </small>
                  </>
                )}
                {!dwThresholdEnabled && (
                  <small className="text-muted d-block">
                    {t("lc.confidenceDisabledHint")}
                  </small>
                )}
              </div>
            )}

            <hr />

            {runError && (
              <div className="alert alert-danger py-2 mb-2" style={{ fontSize: ".8rem" }}>
                {runError}
              </div>
            )}

            <button
              className="btn btn-warning w-100 fw-bold"
              disabled={running}
              onClick={runAnalysis}
            >
              {running ? (
                <>
                  <i className="fas fa-spinner fa-spin" /> Menganalisis...
                </>
              ) : (
                <>
                  <i className="fas fa-play" /> {t("lc.run")}
                </>
              )}
            </button>

            <div className="mt-3 text-muted" style={{ fontSize: ".8rem" }}>
              <i className="fas fa-clock" /> {t("lc.processingTime")}
              <br />
              <i className="fas fa-info-circle" /> {t("lc.requestPerYear")}
            </div>
          </div>
        </div>

        {/* Results panel */}
        <div className="col-lg-9">
          {!hasResults && (
            <div className="card text-center py-5 border-dashed">
              <div className="card-body">
                <i className="bi bi-arrow-left-right text-muted" style={{ fontSize: "3.5rem" }} />
                <h5 className="mt-3 text-muted">{t("lc.noResults")}</h5>
                <p className="text-muted mb-4">
                  {t("lc.noResultsHint")} <strong>{t("lc.run")}</strong>
                </p>
              </div>
            </div>
          )}

          <div className="alert alert-info d-flex align-items-start gap-2 mb-3">
            <i className="fas fa-info-circle mt-1 flex-shrink-0" />
            <div style={{ fontSize: ".875rem" }}>
              <strong>{t("lc.methodologyTitle")}</strong> {t("lc.methodologyText")}
            </div>
          </div>

          {hasResults && (
            <>
              <div className="card mb-3">
                <div className="card-body py-2 d-flex align-items-center gap-3 flex-wrap">
                  <span className="fw-bold text-muted flex-shrink-0">
                    <i className="fas fa-exchange-alt" /> {t("lc.period")}:
                  </span>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <div style={{ width: 96 }}>
                      <SearchableSelect
                        value={String(yearA)}
                        onChange={handlePeriodFromChange}
                        options={periodFromOptions}
                      />
                    </div>
                    <span className="text-muted fw-semibold">-&gt;</span>
                    <div style={{ width: 96 }}>
                      <SearchableSelect
                        value={String(yearB)}
                        onChange={handlePeriodToChange}
                        options={periodToOptions}
                      />
                    </div>
                    <span className="text-muted small">{t("lc.freeComparison")}</span>
                  </div>
                  <span className="badge bg-secondary">{activeYears.length} {t("lc.yearsAnalyzed")}</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary ms-auto"
                    onClick={downloadData}
                  >
                    <i className="fas fa-download" /> {t("lc.exportJson")}
                  </button>
                </div>
              </div>

              {(() => {
                const badges: JSX.Element[] = [];
                for (const [label, y] of [
                  ["A", yearA],
                  ["B", yearB],
                ] as const) {
                  const r = y != null ? yearData[y] : undefined;
                  if (!r) continue;
                  if (r.coverage_note) {
                    badges.push(
                      <div
                        key={`coverage-${label}`}
                        className="alert alert-info py-2 mb-2 d-flex align-items-start gap-2"
                      >
                        <i className="fas fa-circle-info mt-1 flex-shrink-0" />
                        <div style={{ fontSize: ".8rem" }}>
                          <strong>
                            Tahun {label} ({r.year}):
                          </strong>{" "}
                          {r.coverage_note}
                        </div>
                      </div>,
                    );
                  }
                  if (r.requested_year != null && r.requested_year !== r.year) {
                    badges.push(
                      <div
                        key={`fallback-${label}`}
                        className="alert alert-warning py-2 mb-2 d-flex align-items-start gap-2"
                      >
                        <i className="fas fa-triangle-exclamation mt-1 flex-shrink-0" />
                        <div style={{ fontSize: ".8rem" }}>
                          <strong>
                            Tahun {label} ({r.requested_year}):
                          </strong>{" "}
                          data tidak tersedia untuk tahun yang diminta - menampilkan{" "}
                          <strong>{r.year}</strong> sebagai gantinya
                          {r.fallback_reason ? ` (${r.fallback_reason})` : ""}.
                        </div>
                      </div>,
                    );
                  }
                  if (r.confidence) {
                    const c = r.confidence;
                    const low = c.low_confidence_pixel_pct ?? 0;
                    const warn = low >= 15;
                    badges.push(
                      <div
                        key={`conf-${label}`}
                        className={`alert ${warn ? "alert-warning" : "alert-secondary"} py-2 mb-2 d-flex align-items-start gap-2`}
                      >
                        <i
                          className={`fas ${warn ? "fa-triangle-exclamation" : "fa-shield-halved"} mt-1 flex-shrink-0`}
                        />
                        <div style={{ fontSize: ".8rem" }}>
                          <strong>
                            Keyakinan Dynamic World, tahun {label} ({r.year}):
                          </strong>{" "}
                          rata-rata{" "}
                          {c.mean_confidence != null
                            ? `${Math.round(c.mean_confidence * 100)}%`
                            : "-"}
                          , min{" "}
                          {c.min_confidence != null
                            ? `${Math.round(c.min_confidence * 100)}%`
                            : "-"}{" "}
                          -{" "}
                          {c.low_confidence_pixel_pct != null
                            ? `${c.low_confidence_pixel_pct}%`
                            : "-"}{" "}
                          piksel di bawah ambang {Math.round(c.low_confidence_threshold * 100)}%
                          {r.dw_probability_threshold
                            ? " (piksel ini sudah disamarkan dari hasil)"
                            : ""}
                          .
                        </div>
                      </div>,
                    );
                  }
                }
                return badges.length ? <div className="mb-3">{badges}</div> : null;
              })()}

              <div className="card mb-3">
                <div className="card-header">
                  <ul className="nav nav-tabs card-header-tabs">
                    <li className="nav-item">
                      <button
                        className={`nav-link ${tab === "matrix" ? "active" : "text-white"}`}
                        onClick={() => setTab("matrix")}
                      >
                        <i className="fas fa-th" /> {t("lc.tab.matrix")}
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        className={`nav-link ${tab === "netchange" ? "active" : "text-white"}`}
                        onClick={() => setTab("netchange")}
                      >
                        <i className="fas fa-balance-scale" /> {t("lc.tab.netChange")}
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        className={`nav-link ${tab === "timeseries" ? "active" : "text-white"}`}
                        onClick={() => setTab("timeseries")}
                      >
                        <i className="fas fa-chart-area" /> {t("lc.tab.timeSeries")}
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        className={`nav-link ${tab === "maps" ? "active" : "text-white"}`}
                        onClick={() => setTab("maps")}
                      >
                        <i className="fas fa-map-location-dot" /> {t("lc.tab.changeMap")}
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        className={`nav-link ${tab === "hotspot" ? "active" : "text-white"}`}
                        onClick={() => setTab("hotspot")}
                      >
                        <i className="fas fa-map-pin" /> {t("lc.tab.hotspot")}
                      </button>
                    </li>
                  </ul>
                </div>
                <div className="card-body pt-3">
                  {tab === "matrix" && trans && (
                    <TransitionMatrixTable trans={trans} yearA={yearA!} yearB={yearB!} />
                  )}
                  {tab === "netchange" && (
                    <NetChangeChart
                      clsA={yearData[yearA!]?.classes || {}}
                      clsB={yearData[yearB!]?.classes || {}}
                    />
                  )}
                  {tab === "timeseries" && (
                    <TimeSeriesChart years={activeYears} yearData={yearData} dataset={dataset} />
                  )}
                  {tab === "maps" && (
                    <BeforeAfterMaps
                      aoi={aoi}
                      onAoiChange={handleAoiChange}
                      dataset={dataset}
                      yearA={yearA}
                      yearB={yearB}
                      yearData={yearData}
                      mode={mode}
                      onModeChange={setMode}
                      changeMapData={changeMapData}
                      changeMapLoading={changeMapLoading}
                      changeMapError={changeMapError}
                      startMonth={startMonth}
                      endMonth={endMonth}
                      startDate={dateMode === "date" && yearA != null ? tanggalToIso(yearA, tanggalStart) : undefined}
                      endDate={dateMode === "date" && yearB != null ? tanggalToIso(yearB, tanggalEnd) : undefined}
                      dwProbabilityThreshold={isDynamicWorldCompatible && dwThresholdEnabled ? dwProbabilityThreshold : undefined}
                    />
                  )}
                  {tab === "hotspot" && (
                    <HotspotPanel
                      aoi={aoi}
                      dataset={dataset}
                      yearA={yearA}
                      yearB={yearB}
                      startMonth={startMonth}
                      endMonth={endMonth}
                      startDate={
                        dateMode === "date" && yearA != null
                          ? tanggalToIso(yearA, tanggalStart)
                          : undefined
                      }
                      endDate={
                        dateMode === "date" && yearB != null
                          ? tanggalToIso(yearB, tanggalEnd)
                          : undefined
                      }
                    />
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <span>
                    <i className="fas fa-table" /> Ringkasan Perubahan (Periode Terpilih)
                  </span>
                  <span className="badge bg-secondary">
                    {yearA} → {yearB}
                  </span>
                </div>
                <div className="card-body">
                  {trans && (
                    <SummaryPanel
                      trans={trans}
                      clsA={yearData[yearA!]?.classes || {}}
                      dataset={dataset}
                      yearData={yearData}
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {!hasResults && (
            <BeforeAfterMaps
              aoi={aoi}
              onAoiChange={handleAoiChange}
              dataset={dataset}
              yearA={null}
              yearB={null}
              yearData={yearData}
              mode={mode}
              onModeChange={setMode}
              changeMapData={null}
              changeMapLoading={false}
              changeMapError={null}
              startMonth={startMonth}
              endMonth={endMonth}
            />
          )}
        </div>
      </div>
      <AoiPickerModal
        open={aoiModalOpen}
        id="lcChangeAoiModalMap"
        title={t("lc.aoiModalTitle")}
        description="Pilih wilayah administrasi, koordinat, gambar polygon/rectangle, unggah file, atau pilih batas perusahaan."
        aoi={aoiState}
        onAoiChange={setAoiState}
        onClose={() => setAoiModalOpen(false)}
      />
    </div>
  );
}
