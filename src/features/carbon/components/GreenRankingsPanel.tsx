import { useEffect, useRef, useState } from "react";
import { fetchProvinces, fetchCities, fetchDistricts } from "@/services/analysisService";
import { runAnalysisJob } from "@/services/analysisJobs";
import { apiClient } from "@/services/apiClient";
import { env } from "@/config/env";
import SearchableSelect from "@/components/ui/SearchableSelect";
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
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [provinces, setProvinces] = useState<RegionOption[]>([]);
  const [cities, setCities] = useState<RegionOption[]>([]);
  const [districts, setDistricts] = useState<RegionOption[]>([]);
  const [result, setResult] = useState<GreenRankingResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keepRunning = useRef(false);
  const scopeRef = useRef("");
  const mounted = useRef(true);
  const filters = { level, province, city, district };
  const storageKey = `savegeo-green:v1:${year}:${startMonth}:${endMonth}:${level}:${province}:${city}:${district}`;
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
    if (saved)
      void apiClient
        .get<GreenRankingResult>(`/carbon/green-rankings/${encodeURIComponent(saved)}`, {
          auth: "app",
        })
        .then((data) => {
          if (active) setResult(data);
        })
        .catch(() => {
          if (active) localStorage.removeItem(storageKey);
        });
    return () => {
      active = false;
    };
  }, [storageKey]);
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
            year,
            start_month: startMonth,
            end_month: endMonth,
            aoi: { west: 94, south: -12, east: 142, north: 8 },
            extension_settings: { ...filters, run_id: next?.run_id, cursor: next?.cursor },
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
  async function page(value: number) {
    if (!result) return;
    try {
      const data = await apiClient.get<GreenRankingResult>(
        `/carbon/green-rankings/${result.run_id}?page=${value}`,
        { auth: "app" },
      );
      setResult(data);
      onResult(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Halaman gagal dimuat.");
    }
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
  return (
    <section className="green-rankings" aria-label="Peringkat wilayah hijau">
      <div className="green-rankings__intro">
        <span className="green-rankings__eyebrow"><i className="bi bi-globe-asia-australia" /> Analisis wilayah</span>
        <p className="small text-muted mb-0">
        Persentase tutupan hijau dari Dynamic World pada periode terpilih. Semua tingkat dapat
        dihitung nasional atau dibatasi induk wilayah. Filter ini berdiri sendiri dari AOI peta
        utama. Pemrosesan bertahap dapat dilanjutkan setelah berhenti.
        </p>
      </div>
      <CropPanelAccordion title="Wilayah dan tingkat peringkat" icon="bi-sliders" className="green-rankings__accordion" defaultOpen>
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label" htmlFor="green-level">Tingkat peringkat</label>
            <select id="green-level" className="form-select" value={level} disabled={busy} onChange={(event) => {
              setLevel(event.target.value);
              setProvince("");
              setCity("");
              setDistrict("");
            }}>
              {LEVELS.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
            </select>
          </div>
          {depth > 0 && select("Provinsi", province, provinces, (value) => {
            setProvince(value);
            setCity("");
            setDistrict("");
          })}
          {depth > 1 && select("Kabupaten/kota", city, cities, (value) => {
            setCity(value);
            setDistrict("");
          }, !province)}
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
            Hitung ulang dari awal
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
          <div className={`green-rankings__status ${result.done ? "is-complete" : "is-partial"}`} role="status">
            <i className={`bi ${result.done ? "bi-check-circle-fill" : "bi-info-circle-fill"}`} aria-hidden="true" />
            <span>
            {result.done
              ? "Penelusuran wilayah selesai"
              : "Hasil parsial; belum merupakan peringkat lengkap"}{" "}
            · {result.statistics.processed} wilayah diproses · {result.statistics.eligible || 0}{" "}
            layak peringkat (cakupan ≥80%).
            </span>
          </div>
          <div className="green-rankings__stats">
            {Object.entries({
              "Hijau tertimbang (%)": result.statistics.area_weighted_green_percent,
              "Rata-rata wilayah (%)": result.statistics.mean_percent,
              "Median (%)": result.statistics.median_percent,
              "Simpangan baku (%)": result.statistics.std_dev_percent,
              "Minimum (%)": result.statistics.min_percent,
              "Maksimum (%)": result.statistics.max_percent,
              "Luas batas (ha)": result.statistics.area_ha,
              "Luas data valid (ha)": result.statistics.valid_area_ha,
              "Luas hijau teramati (ha)": result.statistics.green_area_ha,
            }).map(([label, value]) => (
              <div key={label} className="green-rankings__stat">
                <small>{label}</small>
                <strong>{fmt(value)}</strong>
              </div>
            ))}
          </div>
          <p className="green-rankings__method small">
            {result.method} Resolusi statistik {result.config.scale} m. {result.boundary_source}
          </p>
          <CropPanelAccordion title="Distribusi dan komposisi tutupan hijau" icon="bi-bar-chart-line" className="green-rankings__accordion">
            <p>
              Geometri gagal: {result.statistics.failed_geometry || 0}. Pohon{" "}
              {fmt(result.statistics.trees_ha)} ha; rumput {fmt(result.statistics.grass_ha)} ha;
              tanaman {fmt(result.statistics.crops_ha)} ha; semak {fmt(result.statistics.shrubs_ha)}{" "}
              ha; vegetasi tergenang {fmt(result.statistics.flooded_ha)} ha.
            </p>
            {result.statistics.histogram?.map((bin) => (
              <div className="d-flex align-items-center gap-2 mb-1" key={bin.from_percent}>
                <span style={{ minWidth: 80 }}>
                  {bin.from_percent}–{bin.to_percent}%
                </span>
                <meter
                  className="flex-grow-1"
                  min={0}
                  max={Math.max(1, result.statistics.eligible)}
                  value={bin.count}
                />
                <span>{bin.count} wilayah</span>
              </div>
            ))}
          </CropPanelAccordion>
          <a
            className="btn btn-outline-success green-rankings__export"
            href={`${env.apiBaseUrl}/carbon/green-rankings/${result.run_id}/export`}
          >
            Unduh seluruh statistik CSV ({result.status})
          </a>
          <div className="table-responsive green-rankings__table-wrap">
            <table className="table table-sm align-middle green-rankings__table">
              <thead>
                <tr>
                  {[
                    "No",
                    "Peringkat",
                    "Kode",
                    "Wilayah",
                    "Hijau %",
                    "Cakupan %",
                    "Luas ha",
                    "Hijau ha",
                    "Pohon ha",
                    "Rumput ha",
                    "Tanaman ha",
                    "Semak ha",
                    "Vegetasi tergenang ha",
                  ].map((title) => (
                    <th key={title}>{title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={row.code}>
                    <td>{(result.page - 1) * result.page_size + i + 1}</td>
                    <td>{row.rank ?? "—"}</td>
                    <td>{row.code}</td>
                    <td>
                      {row.name}
                      {row.error && <small className="d-block text-danger">{row.error}</small>}
                    </td>
                    {[
                      row.green_percent,
                      row.coverage_percent,
                      row.area_ha,
                      row.green_area_ha,
                      row.classes_ha?.trees,
                      row.classes_ha?.grass,
                      row.classes_ha?.crops,
                      row.classes_ha?.shrubs,
                      row.classes_ha?.flooded,
                    ].map((value, index) => (
                      <td key={index}>{fmt(value)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary me-2"
            disabled={busy || result.page <= 1}
            onClick={() => void page(result.page - 1)}
          >
            Sebelumnya
          </button>
          <span>Halaman {result.page}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary ms-2"
            disabled={busy || result.page * result.page_size >= result.statistics.processed}
            onClick={() => void page(result.page + 1)}
          >
            Berikutnya
          </button>
        </div>
      )}
    </section>
  );
}
