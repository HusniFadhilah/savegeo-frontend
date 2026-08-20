import { useCallback, useEffect, useMemo, useState } from "react";
import type { AoiFeature } from "@/types/map";
import { useConfigStore } from "@/hooks/useConfigStore";
import { useUiStore } from "@/hooks/useUiStore";
import { useAoiStore } from "@/hooks/useAoiStore";
import { boundsFromGeoJSON, areaKm2 } from "@/features/carbon/lib/geo";
import { ApiError } from "@/services/apiClient";
import SearchableSelect from "@/components/ui/SearchableSelect";
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

type Tab = "matrix" | "netchange" | "timeseries" | "maps" | "hotspot";

/**
 * Land Cover Change module - before/after year comparison with a transition
 * matrix. Full port of `frontend-nextjs2` LCChange (main.js) +
 * module-lc-change.html, adapted to this app's foundation:
 *  - AOI: legacy reused the Carbon module's global `currentAOI`. This app
 *    now shares AOI across modules via `useAoiStore` (see @/hooks/useAoiStore) -
 *    an AOI set in the Carbon module's AoiPanel (admin/coordinate/draw/upload/
 *    company tabs) shows up here too. LC-Change can still (re)draw/clear the
 *    AOI directly via `AoiDrawingTools` on the "before" map, which writes
 *    back to the same shared store.
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
      setAoiState({ source: "drawn", name: "Poligon Kustom", areaKm2: areaKm2(feature, bounds), feature, bounds });
    },
    [setAoiState],
  );
  const [dataset, setDataset] = useState<LcDataset>("Dynamic_World");
  const [years, setYears] = useState<number[]>([maxYear - 1, maxYear]);
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(1);

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [yearData, setYearData] = useState<Record<number, LcYearResult>>({});
  const [activeYears, setActiveYears] = useState<number[]>([]);
  const [pairIndex, setPairIndex] = useState(0);

  const [mode, setMode] = useState<ChangeMapMode>("normal");
  const [changeMapCache, setChangeMapCache] = useState<Record<string, LcChangeMapResponse>>({});
  const [changeMapLoading, setChangeMapLoading] = useState(false);
  const [changeMapError, setChangeMapError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("matrix");

  // Dataset options fetched from GET /landcover/datasets (same catalog the
  // Landcover feature calls) instead of the 6-item static DATASET_OPTIONS -
  // falls back to that static list if the request fails/is empty.
  const [datasetOptions, setDatasetOptions] = useState(DATASET_OPTIONS);
  const [datasetDocs, setDatasetDocs] = useState<Record<string, { year_min?: number; year_max?: number; description?: string }>>({});
  useEffect(() => {
    let cancelled = false;
    fetchLandCoverDatasets()
      .then((catalog) => {
        if (cancelled || !catalog) return;
        const entries = Object.values(catalog);
        if (!entries.length) return;
        setDatasetOptions(entries.map((ds) => ({ value: ds.key, label: `${ds.name} (${ds.resolution})` })));
        setDatasetDocs(catalog as unknown as Record<string, { year_min?: number; year_max?: number; description?: string }>);
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
      const years = doc.year_min || doc.year_max ? `Tersedia: ${doc.year_min ?? "-"}-${doc.year_max ?? "-"}` : "";
      const combined = [years, doc.description].filter(Boolean).join(" · ");
      if (combined) return combined;
    }
    return DATASET_NOTES[dataset] || "";
  })();

  const yearA = activeYears.length >= 2 ? activeYears[pairIndex] : null;
  const yearB = activeYears.length >= 2 ? activeYears[pairIndex + 1] : null;

  const trans = useMemo(() => {
    if (yearA == null || yearB == null) return null;
    return computeTransitions(yearData[yearA]?.classes || {}, yearData[yearB]?.classes || {});
  }, [yearA, yearB, yearData]);

  // Mirror AOI + transition summary for the Geo-AI Assistant's grounding context
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
    yearA != null && yearB != null ? `${dataset}:${yearA}:${yearB}:${startMonth}:${endMonth}` : null;
  const changeMapData = changeMapCacheKey ? changeMapCache[changeMapCacheKey] ?? null : null;

  // Fetch the changed-pixel map for the current pair whenever it's needed
  // (matrix/netchange/timeseries tabs don't need it - only fetch lazily when
  // the maps tab is active or already cached, mirroring legacy's on-demand load).
  useEffect(() => {
    if (!aoi || !changeMapCacheKey || tab !== "maps" || changeMapCache[changeMapCacheKey] || yearA == null || yearB == null) {
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

    showLoading("Menganalisis tutupan lahan…", `0 dari ${uniqueYears.length} tahun diproses`);
    for (let i = 0; i < uniqueYears.length; i++) {
      const year = uniqueYears[i];
      setLoadingProgress(Math.round((i / uniqueYears.length) * 85) + 5, `${i + 1} dari ${uniqueYears.length} tahun diproses (${year})`);
      try {
        const res = await analyzeLandCoverYear({
          aoi: { geojson: aoi },
          year,
          datasets: [dataset],
          start_month: startMonth,
          end_month: endMonth,
        });
        const bucket = res[dataset];
        if (bucket?.classes) {
          collected[year] = bucket;
        }
      } catch (err) {
        console.error(`LC-change: gagal memuat tahun ${year}`, err);
      }
    }
    hideLoading();
    setRunning(false);

    const successYears = Object.keys(collected).map(Number).sort((a, b) => a - b);
    if (successYears.length < 2) {
      setRunError("Data tidak cukup (minimal 2 tahun berhasil). Coba ubah parameter.");
      return;
    }
    setYearData(collected);
    setActiveYears(successYears);
    setPairIndex(0);
    setTab("matrix");
  };

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

  const monthOptions = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des",
  ];

  return (
    <div className="row g-3">
      {/* Control panel */}
      <div className="col-lg-3">
        <div className="sidebar">
          <h5 className="mb-3">
            <i className="fas fa-cog" /> Pengaturan
          </h5>

          <div className="mb-3">
            <label className="form-label fw-bold">
              <i className="fas fa-map-marker-alt" /> Area of Interest
            </label>
            {aoi ? (
              <div className="alert alert-success py-2 mb-0" style={{ fontSize: ".8rem" }}>
                <i className="fas fa-check-circle" /> AOI tergambar ({aoi.geometry.type})
              </div>
            ) : (
              <div className="alert alert-warning py-2 mb-0" style={{ fontSize: ".8rem" }}>
                <i className="fas fa-exclamation-triangle" /> Gambar AOI (polygon/rectangle) di peta kiri di bawah.
              </div>
            )}
            {aoi && (
              <button type="button" className="btn btn-sm btn-outline-secondary w-100 mt-2" onClick={() => setAoiState(null)}>
                <i className="fas fa-eraser" /> Hapus AOI
              </button>
            )}
          </div>

          <hr />

          <div className="mb-3">
            <label className="form-label fw-bold" htmlFor="lcChangeDataset">
              <i className="fas fa-database" /> Dataset LULC
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
              <i className="fas fa-calendar-alt" /> Tahun Analisis
            </label>
            <YearSelector years={years} minYear={minYear} maxYear={maxYear} onChange={setYears} />
          </div>

          <div className="mb-3">
            <label className="form-label fw-bold">
              <i className="fas fa-calendar" /> Rentang Bulan
            </label>
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
            <small className="text-muted">Berlaku untuk Dynamic World</small>
          </div>

          <hr />

          {runError && (
            <div className="alert alert-danger py-2 mb-2" style={{ fontSize: ".8rem" }}>
              {runError}
            </div>
          )}

          <button className="btn btn-warning w-100 fw-bold" disabled={running} onClick={runAnalysis}>
            {running ? (
              <>
                <i className="fas fa-spinner fa-spin" /> Menganalisis...
              </>
            ) : (
              <>
                <i className="fas fa-play" /> Jalankan Analisis
              </>
            )}
          </button>

          <div className="mt-3 text-muted" style={{ fontSize: ".8rem" }}>
            <i className="fas fa-clock" /> ~1–2 menit per tahun
            <br />
            <i className="fas fa-info-circle" /> Setiap tahun = 1 request ke backend
          </div>
        </div>
      </div>

      {/* Results panel */}
      <div className="col-lg-9">
        {!hasResults && (
          <div className="card text-center py-5 border-dashed">
            <div className="card-body">
              <i className="bi bi-arrow-left-right text-muted" style={{ fontSize: "3.5rem" }} />
              <h5 className="mt-3 text-muted">Belum Ada Hasil</h5>
              <p className="text-muted mb-4">
                Gambar AOI, pilih dataset dan tahun lalu klik <strong>Jalankan Analisis</strong>
              </p>
            </div>
          </div>
        )}

        <div className="alert alert-info d-flex align-items-start gap-2 mb-3">
          <i className="fas fa-info-circle mt-1 flex-shrink-0" />
          <div style={{ fontSize: ".875rem" }}>
            <strong>Catatan Metodologi:</strong> Transisi antar kelas (Matriks &amp; Net Change) dihitung dari{" "}
            <em>perubahan agregat luas area</em>, bukan analisis pixel-per-pixel GEE - kecuali tab{" "}
            <strong>Peta Perubahan</strong>, yang memakai data riil piksel dari backend.
          </div>
        </div>

        {hasResults && (
          <>
            <div className="card mb-3">
              <div className="card-body py-2 d-flex align-items-center gap-3 flex-wrap">
                <span className="fw-bold text-muted flex-shrink-0">
                  <i className="fas fa-exchange-alt" /> Periode:
                </span>
                <div style={{ maxWidth: 200 }}>
                  <SearchableSelect
                    value={String(pairIndex)}
                    onChange={(v) => setPairIndex(Number(v))}
                    options={activeYears.slice(0, -1).map((y, i) => ({
                      value: String(i),
                      label: `${y} → ${activeYears[i + 1]}`,
                    }))}
                  />
                </div>
                <span className="badge bg-secondary">{activeYears.length} tahun dianalisis</span>
                <button type="button" className="btn btn-sm btn-outline-secondary ms-auto" onClick={downloadData}>
                  <i className="fas fa-download" /> Export JSON
                </button>
              </div>
            </div>

            <div className="card mb-3">
              <div className="card-header">
                <ul className="nav nav-tabs card-header-tabs">
                  <li className="nav-item">
                    <button className={`nav-link ${tab === "matrix" ? "active" : "text-white"}`} onClick={() => setTab("matrix")}>
                      <i className="fas fa-th" /> Matriks Transisi
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${tab === "netchange" ? "active" : "text-white"}`}
                      onClick={() => setTab("netchange")}
                    >
                      <i className="fas fa-balance-scale" /> Net Change
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${tab === "timeseries" ? "active" : "text-white"}`}
                      onClick={() => setTab("timeseries")}
                    >
                      <i className="fas fa-chart-area" /> Time Series
                    </button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link ${tab === "maps" ? "active" : "text-white"}`} onClick={() => setTab("maps")}>
                      <i className="fas fa-map-location-dot" /> Peta Perubahan
                    </button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link ${tab === "hotspot" ? "active" : "text-white"}`} onClick={() => setTab("hotspot")}>
                      <i className="fas fa-map-pin" /> Hotspot
                    </button>
                  </li>
                </ul>
              </div>
              <div className="card-body pt-3">
                {tab === "matrix" && trans && <TransitionMatrixTable trans={trans} yearA={yearA!} yearB={yearB!} />}
                {tab === "netchange" && (
                  <NetChangeChart clsA={yearData[yearA!]?.classes || {}} clsB={yearData[yearB!]?.classes || {}} />
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
                  <SummaryPanel trans={trans} clsA={yearData[yearA!]?.classes || {}} dataset={dataset} yearData={yearData} />
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
          />
        )}
      </div>
    </div>
  );
}
