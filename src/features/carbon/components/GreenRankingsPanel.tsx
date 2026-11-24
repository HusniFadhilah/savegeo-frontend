import { useEffect, useRef, useState } from "react";
import { fetchProvinces, fetchCities, fetchDistricts } from "@/services/analysisService";
import { runAnalysisJob } from "@/services/analysisJobs";
import { apiClient } from "@/services/apiClient";
import { env } from "@/config/env";
import SearchableSelect from "@/components/ui/SearchableSelect";
import InfoTip from "@/components/ui/InfoTip";
import type { RegionOption } from "@/types/api";
import type { GreenRankingResult } from "../extendedTypes";
import CropPanelAccordion from "@/features/crop-monitoring/components/CropPanelAccordion";
import "./green-rankings-panel.css";

const LEVELS = [
  ["province", "Provinsi"],
  ["city", "Kabupaten/kota"],
  ["district", "Kecamatan"],
  ["village", "Desa/kelurahan"],
];
const fmt = (value?: number | null) =>
  value == null ? "—" : value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
const carbonStatusLabel: Record<string, string> = {
  year_product: "produk tahun terpilih",
  nearest_year_product: "tahun sumber terdekat",
  modelled_wall_to_wall: "peta hasil imputasi",
  sparse_footprint_sample: "sampel footprint GEDI",
  forward_estimate_from_latest_sample: "estimasi dari sampel terbaru",
  forward_estimate_from_latest_map: "estimasi dari peta terbaru",
  derived_estimate: "estimasi turunan",
  derived_proxy: "proksi turunan",
  period_model: "model periode",
  period_extrapolation: "ekstrapolasi periode",
};
const formatRankingValue = (value: number | null | undefined, compact: boolean, unit: "%" | "ha" | "Mg C/ha") => {
  if (value == null) return "—";
  const formatted = new Intl.NumberFormat(
    "id-ID",
    compact
      ? { notation: "compact", minimumFractionDigits: 1, maximumFractionDigits: 1 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  )
    .format(value)
    .replace(/\u00a0/g, " ");
  if (!compact) return formatted;
  return unit === "%" ? `${formatted}%` : `${formatted} ${unit}`;
};

export default function GreenRankingsPanel({
  year,
  startMonth,
  endMonth,
  onResult,
  onRunReady,
}: {
  year: number;
  startMonth: number;
  endMonth: number;
  onResult: (result: GreenRankingResult) => void;
  onRunReady?: (run: (() => Promise<boolean>) | null) => void;
}) {
  const [level, setLevel] = useState("province");
  const [rankingYear, setRankingYear] = useState(year);
  const rankingStartMonth = rankingYear <= 2022 ? 1 : startMonth;
  const rankingEndMonth = rankingYear <= 2022 ? 12 : endMonth;
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [provinces, setProvinces] = useState<RegionOption[]>([]);
  const [cities, setCities] = useState<RegionOption[]>([]);
  const [districts, setDistricts] = useState<RegionOption[]>([]);
  const [result, setResult] = useState<GreenRankingResult | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [tableSort, setTableSort] = useState("rank");
  const [tableSortDir, setTableSortDir] = useState<"asc" | "desc">("asc");
  const [tablePageSize, setTablePageSize] = useState(50);
  const [compactNumbers, setCompactNumbers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keepRunning = useRef(false);
  const scopeRef = useRef("");
  const mounted = useRef(true);
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);
  const filters = { level, province, city, district };
  const storageKey = `savegeo-green:v4:${rankingYear}:${rankingStartMonth}:${rankingEndMonth}:${level}:${province}:${city}:${district}`;
  scopeRef.current = storageKey;
  const depth = LEVELS.findIndex(([key]) => key === level);
  useEffect(() => {
    mounted.current = true;
    void fetchProvinces()
      .then(setProvinces)
      .catch(() => setError("Daftar provinsi belum dapat dimuat."));
    return () => {
      keepRunning.current = false;
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setCities([]);
    if (province)
      void fetchCities(province)
        .then((items) => {
          if (active) setCities(items);
        })
        .catch(() => {
          if (active) setError("Daftar kabupaten/kota gagal dimuat.");
        });
    return () => {
      active = false;
    };
  }, [province]);
  useEffect(() => {
    let active = true;
    setDistricts([]);
    if (city)
      void fetchDistricts(city)
        .then((items) => {
          if (active) setDistricts(items);
        })
        .catch(() => {
          if (active) setError("Daftar kecamatan gagal dimuat.");
        });
    return () => {
      active = false;
    };
  }, [city]);
  useEffect(() => {
    let active = true;
    setResult(null);
    const saved = localStorage.getItem(storageKey);
    const params = new URLSearchParams({
      year: String(rankingYear),
      start_month: String(rankingStartMonth),
      end_month: String(rankingEndMonth),
      level,
    });
    if (province) params.set("province", province);
    if (city) params.set("city", city);
    if (district) params.set("district", district);
    const acceptResult = (data: GreenRankingResult) => {
      if (!active) return;
      setResult(data);
      onResultRef.current(data);
      setTableSearch(data.search || "");
      setTableSort(data.sort_by || "rank");
      setTableSortDir(data.sort_dir || "asc");
      setTablePageSize(data.page_size || 50);
      localStorage.setItem(storageKey, data.run_id);
    };
    const loadLatest = () =>
      apiClient.get<GreenRankingResult>(`/carbon/green-rankings/latest?${params}`, { auth: "app" });
    if (saved) {
      const savedUrl = saved.startsWith("snapshot:")
        ? `/carbon/green-rankings/${encodeURIComponent(saved)}?${params}`
        : `/carbon/green-rankings/${encodeURIComponent(saved)}`;
      void apiClient
        .get<GreenRankingResult>(savedUrl, { auth: "app" })
        .then(async (data) => {
          if (!data.done || data.run_id.startsWith("snapshot:")) {
            acceptResult(data);
            return;
          }
          try {
            acceptResult(await loadLatest());
          } catch {
            acceptResult(data);
          }
        })
        .catch(() => loadLatest().then(acceptResult).catch(() => {
          if (active) localStorage.removeItem(storageKey);
        }));
    } else {
      void loadLatest().then(acceptResult).catch((reason: unknown) => {
        if (!active) return;
        const status =
          typeof reason === "object" && reason !== null && "status" in reason
            ? Number((reason as { status?: unknown }).status)
            : undefined;
        setError(
          status === 404
            ? "Snapshot dengan nilai pool karbon belum tersedia untuk cakupan ini. Klik ‘Hitung peringkat’ sekali untuk membuat dan menyimpannya; pemuatan berikutnya memakai snapshot database."
            : reason instanceof Error
              ? reason.message
              : "Snapshot peringkat gagal dimuat.",
        );
      });
    }
    return () => {
      active = false;
    };
  }, [city, district, rankingEndMonth, level, province, rankingStartMonth, storageKey, rankingYear]);
  async function run(fresh = false) {
    setBusy(true);
    setError(null);
    keepRunning.current = true;
    let next = fresh ? null : result;
    try {
      do {
        next = await runAnalysisJob<GreenRankingResult>(
          "carbon",
          {
            extension: "green_rankings",
            year: rankingYear,
            start_month: rankingStartMonth,
            end_month: rankingEndMonth,
            aoi: { west: 94, south: -12, east: 142, north: 8 },
            extension_settings: {
              ...filters,
              run_id: next?.run_id,
              cursor: next?.cursor,
              force_refresh: fresh,
            },
          },
          { timeoutMs: 1800000 },
        );
        localStorage.setItem(storageKey, next.run_id);
        if (!mounted.current || scopeRef.current !== storageKey) break;
        setResult(next);
        onResult(next);
      } while (keepRunning.current && !next.done);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Peringkat gagal dihitung.");
    } finally {
      setBusy(false);
      keepRunning.current = false;
    }
    return Boolean(next?.statistics.processed);
  }
  const runner = useRef(run);
  runner.current = run;
  useEffect(() => {
    onRunReady?.(() => runner.current(false));
    return () => onRunReady?.(null);
  }, [onRunReady]);
  async function page(
    value: number,
    overrides: {
      search?: string;
      sortBy?: string;
      sortDir?: "asc" | "desc";
      pageSize?: number;
    } = {},
  ) {
    if (!result) return;
    try {
      const params = new URLSearchParams({
        page: String(value),
        page_size: String(overrides.pageSize ?? tablePageSize),
        sort_by: overrides.sortBy ?? tableSort,
        sort_dir: overrides.sortDir ?? tableSortDir,
      });
      const search = (overrides.search ?? tableSearch).trim();
      if (search) params.set("search", search);
      if (result.run_id.startsWith("snapshot:")) {
        params.set("year", String(rankingYear));
        params.set("start_month", String(rankingStartMonth));
        params.set("end_month", String(rankingEndMonth));
        params.set("level", level);
        if (province) params.set("province", province);
        if (city) params.set("city", city);
        if (district) params.set("district", district);
      }
      const data = await apiClient.get<GreenRankingResult>(
        `/carbon/green-rankings/${result.run_id}?${params.toString()}`,
        { auth: "app" },
      );
      setResult(data);
      onResult(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Halaman gagal dimuat.");
    }
  }
  useEffect(() => {
    if (!result?.run_id || result.search === undefined || result.search === tableSearch.trim()) return;
    const timer = window.setTimeout(() => void page(1, { search: tableSearch }), 300);
    return () => window.clearTimeout(timer);
    // Table search is intentionally debounced like a data table search field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableSearch, result?.run_id]);
  function sortTable(column: string) {
    const direction = tableSort === column && tableSortDir === "asc" ? "desc" : "asc";
    setTableSort(column);
    setTableSortDir(direction);
    void page(1, { sortBy: column, sortDir: direction });
  }
  const select = (
    label: string,
    value: string,
    options: RegionOption[],
    update: (value: string) => void,
    disabled = false,
  ) => (
    <div className="col-md-4">
      <label className="form-label" htmlFor={`green-filter-${label.replace(/\W/g, "")}`}>
        {label}
      </label>
      <SearchableSelect
        id={`green-filter-${label.replace(/\W/g, "")}`}
        value={value}
        onChange={update}
        options={[
          { value: "", label: "Semua / nasional" },
          ...options.map((item) => ({ value: item.code, label: item.name })),
        ]}
        disabled={disabled || busy}
      />
    </div>
  );
  const recordsTotal = result?.records_total ?? result?.statistics.processed ?? 0;
  const recordsFiltered = result?.records_filtered ?? recordsTotal;
  const pageCount = result ? Math.max(1, Math.ceil(recordsFiltered / result.page_size)) : 1;
  const firstRow = recordsFiltered === 0 ? 0 : ((result?.page ?? 1) - 1) * (result?.page_size ?? 50) + 1;
  const lastRow = Math.min(recordsFiltered, (result?.page ?? 1) * (result?.page_size ?? 50));
  const exportScopeParams = new URLSearchParams({
    year: String(rankingYear),
    start_month: String(rankingStartMonth),
    end_month: String(rankingEndMonth),
    level,
  });
  if (province) exportScopeParams.set("province", province);
  if (city) exportScopeParams.set("city", city);
  if (district) exportScopeParams.set("district", district);
  const exportScopeSuffix = result?.run_id.startsWith("snapshot:")
    ? "?" + exportScopeParams.toString()
    : "";
  const sortHeading = (key: string, label: string, title?: string) => (
    <th
      key={key}
      scope="col"
      title={title}
      aria-sort={tableSort === key ? (tableSortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button type="button" className="green-rankings__sort" onClick={() => sortTable(key)}>
        {label}
        <span aria-hidden="true">{tableSort === key ? (tableSortDir === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
  const classComposition = result ? [
    { key: "trees", label: "Pohon", value: result.statistics.trees_ha ?? 0 },
    { key: "grass", label: "Rumput", value: result.statistics.grass_ha ?? 0 },
    { key: "crops", label: "Tanaman", value: result.statistics.crops_ha ?? 0 },
    { key: "shrubs", label: "Semak", value: result.statistics.shrubs_ha ?? 0 },
    { key: "flooded", label: "Vegetasi tergenang", value: result.statistics.flooded_ha ?? 0 },
  ].map((item) => ({ ...item, value: Math.max(0, item.value) })) : [];
  const compositionTotal = classComposition.reduce((sum, item) => sum + item.value, 0);
  const histogramBins = result?.statistics.histogram ?? [];
  const histogramMax = Math.max(1, ...histogramBins.map((bin) => bin.count));
  const carbonPools = [
    {
      key: "agb",
      label: "AGB · Mg C/ha",
      value: (row: GreenRankingResult["rows"][number]) => row.agb_mg_c_ha,
      source: "Sumber AGB dipilih sesuai ketersediaan tahun; resolusi dan cakupan sumber tercatat per hasil.",
      total: (row: GreenRankingResult["rows"][number]) => row.agb_total_mg_c,
    },
    {
      key: "bgb",
      label: "BGB · Mg C/ha",
      value: (row: GreenRankingResult["rows"][number]) => row.bgb_mg_c_ha,
      source: "Estimasi BGB untuk tahun terpilih dari rasio spasial BGB/AGB NASA/ORNL 2010; resolusi efektif mengikuti sumber yang lebih kasar.",
      total: (row: GreenRankingResult["rows"][number]) => row.bgb_total_mg_c,
    },
    {
      key: "soc",
      label: "SOC · Mg C/ha",
      value: (row: GreenRankingResult["rows"][number]) => row.soc_mg_c_ha,
      source: "OpenLandMap-soildb SOC 0–30 cm, 30 m; sumber tersedia per periode, bukan observasi tahunan.",
      total: (row: GreenRankingResult["rows"][number]) => row.soc_total_mg_c,
    },
    {
      key: "litter",
      label: "Serasah · Mg C/ha",
      value: (row: GreenRankingResult["rows"][number]) => row.litter_mg_c_ha,
      source: "Estimasi proxy hutan tropis dari biomassa dan faktor iklim; bukan pengukuran langsung.",
      total: (row: GreenRankingResult["rows"][number]) => row.litter_total_mg_c,
    },
    {
      key: "deadwood",
      label: "Kayu mati · Mg C/ha",
      value: (row: GreenRankingResult["rows"][number]) => row.deadwood_mg_c_ha,
      source: "Estimasi proxy hutan tropis dari biomassa dan faktor iklim; bukan pengukuran langsung.",
      total: (row: GreenRankingResult["rows"][number]) => row.deadwood_total_mg_c,
    },
  ];
  return (
    <section className="green-rankings" aria-label="Peringkat wilayah hijau">
      <div className="green-rankings__intro">
        <span className="green-rankings__eyebrow">
          <i className="bi bi-globe-asia-australia" aria-hidden="true" /> Analisis wilayah
          <InfoTip
            label="Metode dan cakupan peringkat hijau"
            content={
              <div className="green-rankings__method-tip">
                <p>
                  Persentase tutupan hijau memakai GLC_FCS30D 30 m untuk 2000–2022 dan Dynamic
                  World untuk 2023 ke atas. Kelas hijau mencakup pohon, rumput, vegetasi tergenang,
                  tanaman, dan semak. Perbandingan lintas sumber perlu memperhatikan perbedaan
                  skema klasifikasi.
                </p>
                <p>
                  Nilai dibandingkan terhadap luas penuh batas administrasi. Wilayah dengan cakupan
                  data di bawah 80% tidak diberi peringkat. Peringkat parsial dapat berubah sampai
                  seluruh wilayah selesai diproses; proses yang dihentikan dapat dilanjutkan.
                </p>
                <p>
                  Hasil dapat dihitung secara nasional atau dibatasi induk wilayah. Filter ini
                  berdiri sendiri dari AOI peta utama. Resolusi statistik mengikuti tingkat yang
                  dipilih: provinsi 100 m, kabupaten/kota 30 m, kecamatan 20 m, dan desa/kelurahan
                  10 m.
                </p>
                <p>
                  Hasil disimpan terpisah untuk setiap tahun, periode, tingkat, dan filter wilayah.
                  Gunakan tombol hitung ulang untuk memperbarui snapshot tahun/periode tersebut.
                </p>
                <small>Sumber: GLC_FCS30D dan Dynamic World · Google Earth Engine</small>
              </div>
            }
          />
        </span>
        <p className="small text-muted mb-0">
          Peringkat tutupan hijau historis dan terbaru.
        </p>
        <div className="mt-3" style={{ maxWidth: 240 }}>
          <label className="form-label mb-1" htmlFor="green-ranking-year">Tahun peringkat</label>
          <input
            id="green-ranking-year"
            className="form-control"
            type="number"
            min={2000}
            max={new Date().getFullYear()}
            step={1}
            value={rankingYear}
            disabled={busy}
            onChange={(event) => {
              const nextYear = Number(event.target.value);
              if (Number.isInteger(nextYear) && nextYear >= 2000 && nextYear <= new Date().getFullYear())
                setRankingYear(nextYear);
            }}
          />
          <small className="text-muted">
            {rankingYear <= 2022 ? "Data tahunan GLC_FCS30D; periode Januari–Desember." : "Periode mengikuti pilihan bulan analisis."}
          </small>
        </div>
      </div>
      <CropPanelAccordion
        title="Wilayah dan tingkat peringkat"
        icon="bi-sliders"
        className="green-rankings__accordion green-rankings__filter-accordion"
        defaultOpen
      >
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label" htmlFor="green-level">
              Tingkat peringkat
            </label>
            <select
              id="green-level"
              className="form-select"
              value={level}
              disabled={busy}
              onChange={(event) => {
                setLevel(event.target.value);
                setProvince("");
                setCity("");
                setDistrict("");
              }}
            >
              {LEVELS.map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          {depth > 0 &&
            select("Provinsi", province, provinces, (value) => {
              setProvince(value);
              setCity("");
              setDistrict("");
            })}
          {depth > 1 &&
            select(
              "Kabupaten/kota",
              city,
              cities,
              (value) => {
                setCity(value);
                setDistrict("");
              },
              !province,
            )}
          {depth > 2 && select("Kecamatan", district, districts, setDistrict, !city)}
        </div>
      </CropPanelAccordion>
      <div className="green-rankings__actions">
        {!onRunReady && (
          <button
            type="button"
            className="btn btn-success"
            disabled={busy}
            onClick={() => void run(false)}
          >
            {busy
              ? "Menghitung batch wilayah..."
              : result && !result.done
                ? "Lanjutkan perhitungan"
                : "Hitung peringkat"}
          </button>
        )}
        {busy && (
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => {
              keepRunning.current = false;
            }}
          >
            Berhenti setelah batch ini
          </button>
        )}
        {result && (
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={busy}
            onClick={() => void run(true)}
          >
            {result.snapshot_refresh_due
              ? "Perbarui data dari Dynamic World"
              : "Hitung ulang dari awal"}
          </button>
        )}
      </div>
      {error && (
        <div className="alert alert-warning mt-3" role="alert">
          {error}
        </div>
      )}
      {result && (
        <div className="green-rankings__results">
          <div
            className={`green-rankings__status ${result.done ? "is-complete" : "is-partial"}`}
            role="status"
          >
            <i
              className={`bi ${result.done ? "bi-check-circle-fill" : "bi-info-circle-fill"}`}
              aria-hidden="true"
            />
            <span>
              {result.done
                ? "Penelusuran wilayah selesai"
                : "Hasil parsial; belum merupakan peringkat lengkap"}{" "}
              · {result.statistics.processed} wilayah diproses · {result.statistics.eligible || 0}{" "}
              layak peringkat (cakupan ≥80%).
            </span>
          </div>
          <p className="small text-muted mt-2 mb-0">
            Nilai pool berupa densitas rata-rata berbobot luas (Mg C/ha); baris kecil menampilkan
            total pada piksel valid. Sumber, tahun, resolusi, cakupan, dan status estimasi tiap pool
            ditampilkan pada setiap sel. BGB diturunkan dari rasio NASA/ORNL 2010; SOC memakai
            OpenLandMap-soildb 0–30 cm; serasah dan kayu mati adalah proxy hutan tropis berbasis
            faktor UNFCCC, bukan hasil pengukuran langsung.
          </p>
          {result.snapshot_saved_at && (
            <div className="green-rankings__snapshot-note">
              <i className="bi bi-database-check" aria-hidden="true" />
              <span>
                Snapshot database · {new Date(result.snapshot_saved_at).toLocaleString("id-ID")}
                {result.snapshot_refresh_due && <strong> · Perlu diperbarui</strong>}
              </span>
            </div>
          )}
          <div className="green-rankings__stats">
            {[
              {
                label: "Hijau tertimbang (%)",
                value: result.statistics.area_weighted_green_percent,
                icon: "bi-leaf-fill",
                tone: "green",
              },
              {
                label: "Rata-rata wilayah (%)",
                value: result.statistics.mean_percent,
                icon: "bi-bar-chart-line-fill",
                tone: "blue",
              },
              {
                label: "Median (%)",
                value: result.statistics.median_percent,
                icon: "bi-distribute-vertical",
                tone: "teal",
              },
              {
                label: "Simpangan baku (%)",
                value: result.statistics.std_dev_percent,
                icon: "bi-activity",
                tone: "violet",
              },
              {
                label: "Minimum (%)",
                value: result.statistics.min_percent,
                icon: "bi-arrow-down-short",
                tone: "amber",
              },
              {
                label: "Maksimum (%)",
                value: result.statistics.max_percent,
                icon: "bi-arrow-up-short",
                tone: "green",
              },
              {
                label: "Luas batas (ha)",
                value: result.statistics.area_ha,
                icon: "bi-bounding-box",
                tone: "blue",
              },
              {
                label: "Luas data valid (ha)",
                value: result.statistics.valid_area_ha,
                icon: "bi-patch-check-fill",
                tone: "teal",
              },
              {
                label: "Luas hijau teramati (ha)",
                value: result.statistics.green_area_ha,
                icon: "bi-tree-fill",
                tone: "green",
              },
            ].map(({ label, value, icon, tone }) => (
              <div key={label} className="green-rankings__stat">
                <span className={`green-rankings__stat-icon is-${tone}`} aria-hidden="true">
                  <i className={`bi ${icon}`} />
                </span>
                <span className="green-rankings__stat-copy">
                  <small>{label}</small>
                  <strong>{fmt(value)}</strong>
                </span>
              </div>
            ))}
          </div>
          <CropPanelAccordion
            title="Distribusi dan komposisi tutupan hijau"
            icon="bi-bar-chart-line"
            className="green-rankings__accordion green-rankings__visual-accordion"
            defaultOpen
          >
            <div className="green-rankings__visual-grid">
              <article className="green-rankings__chart-card">
                <div className="green-rankings__chart-heading">
                  <div>
                    <span className="green-rankings__chart-icon is-green">
                      <i className="bi bi-tree-fill" aria-hidden="true" />
                    </span>
                    <h3>Komposisi kelas vegetasi</h3>
                  </div>
                  <strong>{fmt(compositionTotal)} ha</strong>
                </div>
                <p className="green-rankings__chart-caption">
                  Proporsi luas vegetasi yang teramati pada periode terpilih.
                </p>
                {compositionTotal > 0 ? (
                  <>
                    <div
                      className="green-rankings__stacked-bar"
                      role="img"
                      aria-label={"Komposisi vegetasi, total " + fmt(compositionTotal) + " hektare"}
                    >
                      {classComposition
                        .filter((item) => item.value > 0)
                        .map((item) => (
                          <span
                            key={item.key}
                            className={"is-" + item.key}
                            style={{ width: (item.value / compositionTotal) * 100 + "%" }}
                            title={item.label + ": " + fmt(item.value) + " ha"}
                          />
                        ))}
                    </div>
                    <div className="green-rankings__composition-legend">
                      {classComposition.map((item) => (
                        <div className="green-rankings__composition-item" key={item.key}>
                          <span
                            className={"green-rankings__legend-swatch is-" + item.key}
                            aria-hidden="true"
                          />
                          <span className="green-rankings__legend-label">{item.label}</span>
                          <strong>{fmt(item.value)} ha</strong>
                          <small>{fmt((item.value / compositionTotal) * 100)}%</small>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="green-rankings__chart-empty">
                    Belum ada data komposisi vegetasi.
                  </div>
                )}
              </article>
              <article className="green-rankings__chart-card">
                <div className="green-rankings__chart-heading">
                  <div>
                    <span className="green-rankings__chart-icon is-blue">
                      <i className="bi bi-bar-chart-fill" aria-hidden="true" />
                    </span>
                    <h3>Sebaran persentase hijau</h3>
                  </div>
                  <span className="green-rankings__chart-unit">jumlah wilayah</span>
                </div>
                <p className="green-rankings__chart-caption">
                  Banyaknya wilayah pada setiap rentang tutupan hijau.
                </p>
                {histogramBins.length > 0 ? (
                  <div
                    className="green-rankings__histogram"
                    role="img"
                    aria-label="Histogram sebaran persentase tutupan hijau"
                  >
                    {histogramBins.map((bin) => (
                      <div
                        className="green-rankings__histogram-column"
                        key={bin.from_percent}
                        title={
                          bin.from_percent + "–" + bin.to_percent + "%: " + bin.count + " wilayah"
                        }
                      >
                        <span className="green-rankings__histogram-count">{bin.count}</span>
                        <div className="green-rankings__histogram-track">
                          <span
                            style={{ height: Math.max(4, (bin.count / histogramMax) * 100) + "%" }}
                          />
                        </div>
                        <small>
                          {bin.from_percent}–{bin.to_percent}%
                        </small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="green-rankings__chart-empty">
                    Histogram belum tersedia untuk hasil ini.
                  </div>
                )}
              </article>
            </div>
            <div className="green-rankings__quality-note">
              <span>
                <i className="bi bi-check2-circle" aria-hidden="true" />{" "}
                {result.statistics.processed - (result.statistics.failed_geometry || 0)} geometri
                berhasil diproses
              </span>
              <span>
                <i className="bi bi-exclamation-triangle" aria-hidden="true" />{" "}
                {result.statistics.failed_geometry || 0} geometri bermasalah
              </span>
            </div>
          </CropPanelAccordion>
          <CropPanelAccordion
            title="Tabel peringkat wilayah"
            icon="bi-table"
            className="green-rankings__accordion green-rankings__table-accordion"
            defaultOpen
            headerTrailing={fmt(recordsFiltered) + " wilayah"}
          >
            <div className="green-rankings__table-content">
              <div className="green-rankings__table-actions">
                <a
                  className="btn btn-outline-success green-rankings__export"
                  href={env.apiBaseUrl + "/carbon/green-rankings/" + result.run_id + "/export" + exportScopeSuffix}
                >
                  <i className="bi bi-download me-1" aria-hidden="true" />
                  Unduh statistik CSV ({result.status})
                </a>
                <div className="green-rankings__datatable-toolbar">
                  <label className="green-rankings__search">
                    <i className="bi bi-search" aria-hidden="true" />
                    <input
                      type="search"
                      className="form-control"
                      aria-label="Cari wilayah berdasarkan nama atau kode"
                      placeholder="Cari wilayah atau kode"
                      value={tableSearch}
                      onChange={(event) => setTableSearch(event.target.value)}
                    />
                  </label>
                  <div className="green-rankings__table-display">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary green-rankings__number-format-toggle"
                      aria-label={compactNumbers ? "Tampilkan angka penuh" : "Ringkas angka tabel"}
                      aria-pressed={compactNumbers}
                      title={compactNumbers ? "Tampilkan angka penuh" : "Tampilkan angka ringkas"}
                      onClick={() => setCompactNumbers((value) => !value)}
                    >
                      <i
                        className={`bi ${compactNumbers ? "bi-arrows-angle-expand" : "bi-arrows-angle-contract"}`}
                        aria-hidden="true"
                      />
                    </button>
                    <label className="green-rankings__page-size">
                      <span>Baris</span>
                      <select
                        className="form-select"
                        aria-label="Jumlah baris per halaman"
                        value={tablePageSize}
                        onChange={(event) => {
                          const nextSize = Number(event.target.value);
                          setTablePageSize(nextSize);
                          void page(1, { pageSize: nextSize });
                        }}
                      >
                        {[10, 25, 50, 100].map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                      <span>per halaman</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="table-responsive green-rankings__table-wrap">
                <table className="table table-sm align-middle green-rankings__table">
                  <thead>
                    <tr>
                      <th scope="col">No</th>
                      {sortHeading("rank", "Peringkat")}
                      {sortHeading("code", "Kode")}
                      {sortHeading("name", "Wilayah")}
                      {sortHeading("green_percent", "Hijau %")}
                      {sortHeading("coverage_percent", "Cakupan %")}
                      {sortHeading("area_ha", "Luas ha")}
                      {sortHeading("green_area_ha", "Hijau ha")}
                      {sortHeading("trees_ha", "Pohon ha")}
                      {sortHeading("grass_ha", "Rumput ha")}
                      {sortHeading("crops_ha", "Tanaman ha")}
                      {sortHeading("shrubs_ha", "Semak ha")}
                      {sortHeading("flooded_ha", "Vegetasi tergenang ha")}
                      {carbonPools.map((pool) => (
                        sortHeading(`${pool.key}_mg_c_ha`, pool.label, pool.source)
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.length ? (
                      result.rows.map((row, i) => (
                        <tr key={row.code}>
                          <td>{(result.page - 1) * result.page_size + i + 1}</td>
                          <td>{row.rank ?? "—"}</td>
                          <td>{row.code}</td>
                          <td>
                            {row.name}
                            {row.error && (
                              <small className="d-block text-danger">{row.error}</small>
                            )}
                          </td>
                          {[
                            { value: row.green_percent, unit: "%" as const },
                            { value: row.coverage_percent, unit: "%" as const },
                            { value: row.area_ha, unit: "ha" as const },
                            { value: row.green_area_ha, unit: "ha" as const },
                            { value: row.classes_ha?.trees, unit: "ha" as const },
                            { value: row.classes_ha?.grass, unit: "ha" as const },
                            { value: row.classes_ha?.crops, unit: "ha" as const },
                            { value: row.classes_ha?.shrubs, unit: "ha" as const },
                            { value: row.classes_ha?.flooded, unit: "ha" as const },
                          ].map((value, index) => (
                            <td key={index}>
                              {formatRankingValue(value.value, compactNumbers, value.unit)}
                            </td>
                          ))}
                          {carbonPools.map((pool) => (
                            <td key={`carbon-${pool.key}`} title={row.carbon_pool_sources?.[pool.key]?.method || pool.source}>
                              {row.carbon_pool_sources?.[pool.key] && (
                                <small className="d-block text-muted">
                                  {row.carbon_pool_sources[pool.key].name || row.carbon_pool_sources[pool.key].dataset}
                                  {" · "}{row.carbon_pool_sources[pool.key].source_period || row.carbon_pool_sources[pool.key].source_year || "tahun sumber tidak tercatat"}
                                  {" · "}{row.carbon_pool_sources[pool.key].resolution_m ? `${row.carbon_pool_sources[pool.key].resolution_m} m` : "resolusi tidak tercatat"}
                                  {" · "}{carbonStatusLabel[row.carbon_pool_sources[pool.key].status] || row.carbon_pool_sources[pool.key].status}
                                  {row.carbon_pool_sources[pool.key].estimate_year != null && ` · estimasi ${row.carbon_pool_sources[pool.key].estimate_year}`}
                                  {row.carbon_pool_sources[pool.key].reference_year != null && ` · acuan ${row.carbon_pool_sources[pool.key].reference_year}`}
                                  {row.carbon_pool_sources[pool.key].valid_coverage_percent != null && ` · cakupan valid ${fmt(row.carbon_pool_sources[pool.key].valid_coverage_percent)}%`}
                                </small>
                              )}
                              <span className="d-block">
                                {formatRankingValue(pool.value(row), compactNumbers, "Mg C/ha")}
                              </span>
                              <small className="text-muted">
                                Total {pool.total(row) == null ? "—" : `${fmt(pool.total(row))} Mg C`}
                              </small>
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={18} className="green-rankings__empty">
                          {tableSearch.trim()
                            ? "Tidak ada wilayah yang cocok dengan pencarian."
                            : "Belum ada wilayah pada halaman ini."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="green-rankings__datatable-footer">
                <span>
                  Menampilkan {firstRow}–{lastRow} dari {recordsFiltered} wilayah
                  {recordsFiltered !== recordsTotal ? ` (disaring dari ${recordsTotal})` : ""}
                </span>
                <div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={busy || result.page <= 1}
                    onClick={() => void page(result.page - 1)}
                  >
                    Sebelumnya
                  </button>
                  <span>
                    Halaman {result.page} dari {pageCount}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={busy || result.page >= pageCount}
                    onClick={() => void page(result.page + 1)}
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            </div>
          </CropPanelAccordion>
        </div>
      )}
    </section>
  );
}
