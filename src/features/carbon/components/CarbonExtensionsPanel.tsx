import { useBilingualCopy } from "@/hooks/useBilingualCopy";
import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { runAnalysisJob } from "@/services/analysisJobs";
import type { AoiPayload } from "../lib/geo";
import type { CarbonResult } from "../types";
import type { GreenRankingResult } from "../extendedTypes";
import CarbonStatsPanel from "./CarbonStatsPanel";
import GreenRankingsPanel from "./GreenRankingsPanel";

interface Props {
  analysisMode?: "bluecarbon" | "productivity";
  onRunReady?: (run: (() => Promise<boolean>) | null) => void;
  aoi: AoiPayload | null;
  year: number;
  startMonth: number;
  endMonth: number;
  results?: Record<string, CarbonResult>;
  onResult: (key: string, result: CarbonResult) => void;
  onRanking: (result: GreenRankingResult) => void;
}

export default function CarbonExtensionsPanel({
  analysisMode,
  onRunReady,
  aoi,
  year,
  startMonth,
  endMonth,
  results = {},
  onResult,
  onRanking,
}: Props) {
  const c = useBilingualCopy();
  const scope = JSON.stringify({ aoi, year, analysisMode });
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [mode, setMode] = useState<string>(analysisMode || "productivity");
  const [preset, setPreset] = useState("");
  const [domainConfirmed, setDomainConfirmed] = useState(false);
  const [catalog, setCatalog] = useState<{
    detritus_presets: { key: string; label: string; litter: number; deadwood: number }[];
    source: string;
    method: string;
  } | null>(null);
  useEffect(() => {
    void apiClient
      .get<NonNullable<typeof catalog>>("/carbon/extensions/catalog", { auth: "app" })
      .then(setCatalog)
      .catch(() => undefined);
  }, []);
  const [sourceYear, setSourceYear] = useState(year);
  useEffect(() => { if (analysisMode === "bluecarbon") setSourceYear(year); }, [year, analysisMode]);
  const [productivityYears, setProductivityYears] = useState<number[]>([]);
  useEffect(() => {
    if (mode !== "productivity") return;
    let active = true;
    void apiClient
      .get<{ years: number[] }>("/carbon/extensions/productivity-years", { auth: "app" })
      .then((data) => {
        if (active) setProductivityYears(data.years);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [mode]);
  const [source, setSource] = useState("");
  const [litter, setLitter] = useState("");
  const [deadwood, setDeadwood] = useState("");
  const [mask, setMask] = useState("trees");
  const [habitat, setHabitat] = useState("mangrove_2000");
  const [confirmed, setConfirmed] = useState(false);
  const [habitatType, setHabitatType] = useState("mangrove");
  const [agb, setAgb] = useState("");
  const [bgb, setBgb] = useState("");
  const [soc, setSoc] = useState("");
  const [depth, setDepth] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const numeric = (value: string, label: string) => {
    if (value.trim() === "" || !Number.isFinite(Number(value)) || Number(value) < 0)
      throw new Error(c(`Isi ${label} dengan angka ≥0 dari sumber yang sesuai.`, `Enter a value ≥0 for ${label} using an appropriate source.`));
    return Number(value);
  };
  async function run() {
    if (!aoi) {
      setError(c("Pilih AOI terlebih dahulu.", "Select an AOI first."));
      return false;
    }
    setBusy(true);
    setError(null);
    const requestedScope = scope;
    let successful = false;
    try {
      let jobs: { extension: string; extension_settings: Record<string, unknown> }[];
      if (mode === "detritus") {
        if (preset && !domainConfirmed)
          throw new Error(
            c("Pastikan kategori iklim hutan preset sesuai dengan area penerapan.", "Confirm that the preset forest climate category applies to this area."),
          );
        if (!preset && source.trim().length < 5)
          throw new Error(c("Cantumkan sumber pengukuran atau literatur koefisien.", "Provide a measurement source or coefficient literature reference."));
        jobs = [
          {
            extension: "litter",
            extension_settings: {
              density: numeric(litter, "stok karbon serasah"),
              source,
              mask,
              preset,
              domain_confirmed: domainConfirmed,
            },
          },
          {
            extension: "deadwood",
            extension_settings: {
              density: numeric(deadwood, "stok karbon kayu mati"),
              source,
              mask,
              preset,
              domain_confirmed: domainConfirmed,
            },
          },
        ];
      } else if (mode === "bluecarbon") {
        if (source.trim().length < 5) throw new Error(c("Cantumkan sumber stok karbon biru.", "Provide the blue carbon stock source."));
        if (habitat === "aoi_habitat" && !confirmed)
          throw new Error(c("Konfirmasikan bahwa AOI adalah batas habitat yang sudah dipetakan.", "Confirm that the AOI is a mapped habitat boundary."));
        jobs = [
          {
            extension: "bluecarbon",
            extension_settings: {
              source,
              habitat,
              habitat_type: habitatType,
              habitat_confirmed: confirmed,
              agb_density: numeric(agb, "AGB"),
              bgb_density: numeric(bgb, "BGB"),
              soc_density: numeric(soc, "SOC"),
              soil_depth_cm: numeric(depth, "kedalaman sedimen"),
            },
          },
        ];
      } else jobs = ["npp", "gpp"].map((extension) => ({ extension, extension_settings: {} }));
      const failures: string[] = [];
      await Promise.all(
        jobs.map(async (job) => {
          try {
            const result = await runAnalysisJob<CarbonResult>(
              "carbon",
              { ...job, aoi, year: sourceYear },
              { timeoutMs: 1800000 },
            );
            if (mounted.current && activeScope.current === requestedScope)
              onResult(job.extension, result);
            successful = true;
          } catch (reason) {
            failures.push(
              `${job.extension.toUpperCase()}: ${reason instanceof Error ? reason.message : "Analisis gagal"}`,
            );
          }
        }),
      );
      if (mounted.current && activeScope.current === requestedScope && failures.length)
        setError(failures.join(" "));
    } catch (reason) {
      if (mounted.current && activeScope.current === requestedScope)
        setError(reason instanceof Error ? reason.message : "Analisis gagal.");
    } finally {
      if (mounted.current) setBusy(false);
    }
    return successful;
  }
  const runner = useRef(run);
  runner.current = run;
  useEffect(() => {
    onRunReady?.(() => runner.current());
    return () => onRunReady?.(null);
  }, [onRunReady]);
  const input = (label: string, value: string, update: (value: string) => void) => (
    <label className="col-md-4 form-label">
      {label}
      <input
        type="number"
        min="0"
        step="any"
        className="form-control"
        value={value}
        disabled={busy || (mode === "detritus" && Boolean(preset))}
        onChange={(event) => update(event.target.value)}
      />
    </label>
  );
  return (
    <details className="card mb-3" open={Boolean(analysisMode)}>
      <summary className="card-header fw-semibold">
        {analysisMode === "bluecarbon"
          ? c("Parameter blue carbon", "Blue carbon parameters")
          : c("Produktivitas vegetasi NPP / GPP", "NPP / GPP vegetation productivity")}
      </summary>
      <div className="card-body">
        {!analysisMode && (
          <>
            <label className="form-label" htmlFor="carbon-extension">
              {c("Analisis tambahan", "Additional analysis")}
            </label>
            <select
              id="carbon-extension"
              value={mode}
              disabled={busy}
              className="form-select mb-3"
              onChange={(event) => {
                setMode(event.target.value);
                setError(null);
                if (event.target.value === "bluecarbon" && preset) setSource("");
              }}
            >
              <option value="productivity">{c("Produktivitas vegetasi NPP dan GPP", "NPP and GPP vegetation productivity")}</option>
              <option value="bluecarbon">{c("Karbon biru (blue carbon)", "Blue carbon")}</option>
            </select>
          </>
        )}
        {mode === "rankings" ? (
          <GreenRankingsPanel
            year={year}
            startMonth={startMonth}
            endMonth={endMonth}
            onResult={onRanking}
          />
        ) : (
          <>
            <label className="form-label">
              {c("Tahun data / skenario", "Data / scenario year")}
              <input
                type="number"
                min="2001"
                max={new Date().getFullYear()}
                className="form-control"
                value={sourceYear}
                disabled={busy}
                onChange={(event) => setSourceYear(Number(event.target.value))}
              />
            </label>
            {mode === "productivity" && productivityYears.length > 0 && (
              <label className="form-label d-block">
                {c("Tahun MODIS yang sudah diterbitkan", "Published MODIS years")}
                <select
                  className="form-select"
                  value={productivityYears.includes(sourceYear) ? sourceYear : ""}
                  disabled={busy}
                  onChange={(event) => setSourceYear(Number(event.target.value))}
                >
                  <option value="" disabled>
                    {c("Pilih tahun sumber yang tersedia", "Select an available source year")}
                  </option>
                  {productivityYears.map((value) => (
                    <option key={value} value={value}>
                      {value}
                      {value === productivityYears[0] ? ` · ${c("terbaru tersedia", "latest available")}` : ""}
                    </option>
                  ))}
                </select>
                <small className="text-muted">
                  {c("Tahun analisis utama tidak berubah otomatis. Produktivitas memakai tahun sumber yang dipilih di sini.", "The main analysis year does not change automatically. Productivity uses the source year selected here.")}
                </small>
              </label>
            )}
            {mode === "productivity" ? (
              <p className="small text-muted">
                {c("MODIS MOD17A3HGF, resolusi sumber 500 m, satu tahun penuh. NPP dan GPP mengukur produktivitas vegetasi, bukan serapan bersih ekosistem atau pengukuran daun individual. Tahun yang belum diterbitkan tidak diganti diam-diam dengan tahun sebelumnya.", "MODIS MOD17A3HGF provides annual data at a native 500 m resolution. NPP and GPP measure vegetation productivity, not net ecosystem uptake or individual leaf measurements. Unpublished years are not silently replaced with the previous year.")}{" "}
                <a
                  href="https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD17A3HGF"
                  target="_blank"
                  rel="noreferrer"
                >
                  {c("Sumber dan periode tersedia", "Source and available period")}
                </a>
                .
              </p>
            ) : (
              <>
                {mode === "detritus" && (
                  <label className="form-label d-block">
                    {c("Metode koefisien", "Coefficient method")}
                    <select
                      className="form-select"
                      value={preset}
                      disabled={busy}
                      onChange={(event) => {
                        const key = event.target.value;
                        setPreset(key);
                        setDomainConfirmed(false);
                        const chosen = catalog?.detritus_presets.find((item) => item.key === key);
                        setLitter(chosen ? String(chosen.litter) : "");
                        setDeadwood(chosen ? String(chosen.deadwood) : "");
                        setSource(
                          chosen
                            ? `IPCC 2019 Refinement Vol.4 Ch.2 Table 2.2; ${chosen.label}; ${catalog?.source}`
                            : "",
                        );
                        if (chosen) setMask("trees");
                      }}
                    >
                      <option value="">{c("Data lapangan / literatur yang ditentukan pengguna", "User-provided field data / literature")}</option>
                      {catalog?.detritus_presets.map((item) => (
                        <option key={item.key} value={item.key}>
                          {c("IPCC Tingkat 1 ·", "IPCC Tier 1 ·")} {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="form-label d-block">
                  {c("Sumber koefisien (pengukuran lapangan, judul/tautan literatur, lokasi dan tahun)", "Coefficient source (field measurement, literature title/link, location, and year)")}
                  <textarea
                    className="form-control"
                    value={source}
                    maxLength={2000}
                    disabled={busy || (mode === "detritus" && Boolean(preset))}
                    onChange={(event) => setSource(event.target.value)}
                  />
                </label>
                <p className="small text-muted">
                  {c("Masukkan stok karbon dalam Mg C/ha, bukan berat biomassa kering. Konversikan dengan fraksi karbon terukur sebelum memasukkan data. Hasil ditampilkan sebagai skenario dan tidak otomatis dijumlahkan dengan pool lain.", "Enter carbon stock in Mg C/ha, not dry biomass mass. Convert it using a measured carbon fraction before entering the data. Results are labelled as a scenario and are not automatically added to other pools.")}
                </p>
                {mode === "detritus" ? (
                  <>
                    <div className="row g-2">
                      {input(c("Serasah (Mg C/ha)", "Litter (Mg C/ha)"), litter, setLitter)}
                      {input(c("Kayu mati (Mg C/ha)", "Deadwood (Mg C/ha)"), deadwood, setDeadwood)}
                    </div>
                    <label className="form-label d-block">
                      {c("Area penerapan", "Area of application")}
                      <select
                        className="form-select"
                        value={mask}
                        disabled={busy || Boolean(preset)}
                        onChange={(event) => setMask(event.target.value)}
                      >
                        <option value="trees">{c("Kelas pohon Dynamic World tahun skenario", "Dynamic World tree class for the scenario year")}</option>
                        <option value="aoi">{c("Seluruh AOI (area pengukuran homogen)", "Entire AOI (homogeneous measurement area)")}</option>
                      </select>
                    </label>
                    {preset && (
                      <label className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={domainConfirmed}
                          onChange={(event) => setDomainConfirmed(event.target.checked)}
                          disabled={busy}
                        />
                        <span className="form-check-label">
                          {c("Kategori iklim hutan preset sesuai dengan area penerapan. Saya memahami hasilnya sebagai skenario Tier 1, bukan hasil survei lokal.", "The preset forest climate category applies to this area. I understand the result is a Tier 1 scenario, not a local survey result.")} {catalog?.method}
                        </span>
                      </label>
                    )}
                  </>
                ) : (
                  <>
                    <label className="form-label d-block">
                      {c("Batas habitat", "Habitat boundary")}
                      <select
                        className="form-select"
                        value={habitat}
                        disabled={busy}
                        onChange={(event) => {
                          setHabitat(event.target.value);
                          setConfirmed(false);
                        }}
                      >
                        <option value="mangrove_2000">
                          {c("Mangrove Landsat baseline 2000 di dalam AOI", "Landsat 2000 mangrove baseline within the AOI")}
                        </option>
                        <option value="aoi_habitat">
                          {c("AOI habitat terpetakan yang diunggah/dipilih", "Uploaded/selected mapped habitat AOI")}
                        </option>
                      </select>
                    </label>
                    {habitat === "aoi_habitat" && (
                      <>
                        <label className="form-label d-block">
                          {c("Jenis habitat", "Habitat type")}
                          <select
                            className="form-select"
                            value={habitatType}
                            onChange={(event) => setHabitatType(event.target.value)}
                          >
                            <option value="mangrove">{c("Mangrove", "Mangrove")}</option>
                            <option value="seagrass">{c("Lamun", "Seagrass")}</option>
                            <option value="saltmarsh">{c("Rawa asin", "Salt marsh")}</option>
                          </select>
                        </label>
                        <label className="form-check mb-2">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={confirmed}
                            onChange={(event) => setConfirmed(event.target.checked)}
                          />
                          <span className="form-check-label">
                            {c("AOI hanya mencakup habitat terpetakan; sumber batas dicantumkan di atas.", "The AOI covers only mapped habitat; the boundary source is listed above.")}
                          </span>
                        </label>
                      </>
                    )}
                    <div className="row g-2">
                      {input(c("AGB karbon (Mg C/ha)", "AGB carbon (Mg C/ha)"), agb, setAgb)}
                      {input(c("BGB karbon (Mg C/ha)", "BGB carbon (Mg C/ha)"), bgb, setBgb)}
                      {input(c("SOC sedimen (Mg C/ha)", "Sediment SOC (Mg C/ha)"), soc, setSoc)}
                      {input(c("Kedalaman sedimen (cm)", "Sediment depth (cm)"), depth, setDepth)}
                    </div>
                    <p className="small text-muted">
                      {c("Blue carbon di sini merupakan skenario stok untuk habitat dan kedalaman yang disebutkan. Perhitungan ini tidak menggunakan luas habitat masa kini dari baseline 2000 serta tidak menghitung penimbunan tahunan, emisi, atau kredit karbon.", "Blue carbon here is a stock scenario for the stated habitat and depth. It does not infer current habitat area from the 2000 baseline or calculate annual accumulation, emissions, or carbon credits.")}
                    </p>
                  </>
                )}
              </>
            )}
            {!onRunReady && (
              <button
                type="button"
                className="btn btn-primary mt-2"
                disabled={busy || !aoi}
                onClick={() => void run()}
              >
                {busy ? c("Memproses modul...", "Processing module...") : c("Jalankan modul", "Run module")}
              </button>
            )}
            {error && (
              <div className="alert alert-warning mt-3" role="alert">
                {error}
              </div>
            )}
          </>
        )}
        {Object.entries(results).map(([key, result]) => (
          <details key={key} className="border rounded p-3 mt-3">
            <summary className="fw-semibold">
              {result.carbon_reference?.name || key.toUpperCase()} ·{" "}
              {result.model_info.analysis_year}
            </summary>
            <p className="small mt-2">{result.model_info.method_description}</p>
            <div className="d-flex gap-4 flex-wrap">
              <span>
                {c("Rata-rata:", "Mean:")}{" "}
                <strong>
                  {result.carbon_estimated.statistics?.mean?.toLocaleString("id-ID", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  {result.carbon_estimated.unit}
                </strong>
              </span>
              <span>
                {c("Total", "Total")}{" "}
                {result.carbon_estimated.quantity === "productivity"
                  ? c("produktivitas tahunan", "annual productivity")
                  : c("stok", "stock")}
                :{" "}
                <strong>
                  {result.area_info.total_carbon_tons?.toLocaleString("id-ID", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  {result.carbon_estimated.unit?.replace("/ha", "")}
                </strong>
              </span>
            </div>
            <CarbonStatsPanel result={result} />
          </details>
        ))}
      </div>
    </details>
  );
}
