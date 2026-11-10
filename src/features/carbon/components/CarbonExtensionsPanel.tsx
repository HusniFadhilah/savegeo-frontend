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
      throw new Error(`Isi ${label} dengan angka ≥0 dari sumber yang sesuai.`);
    return Number(value);
  };
  async function run() {
    if (!aoi) {
      setError("Pilih AOI terlebih dahulu.");
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
            "Konfirmasikan bahwa kategori iklim hutan preset sesuai dengan area penerapan.",
          );
        if (!preset && source.trim().length < 5)
          throw new Error("Cantumkan sumber pengukuran atau literatur koefisien.");
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
        if (source.trim().length < 5) throw new Error("Cantumkan sumber stok blue carbon.");
        if (habitat === "aoi_habitat" && !confirmed)
          throw new Error("Konfirmasikan bahwa AOI adalah batas habitat yang sudah dipetakan.");
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
          ? "Parameter blue carbon"
          : "Produktivitas vegetasi NPP / GPP"}
      </summary>
      <div className="card-body">
        {!analysisMode && (
          <>
            <label className="form-label" htmlFor="carbon-extension">
              Analisis tambahan
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
              <option value="productivity">Produktivitas vegetasi NPP dan GPP</option>
              <option value="bluecarbon">Blue carbon</option>
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
              Tahun data / skenario
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
                Tahun MODIS yang sudah diterbitkan
                <select
                  className="form-select"
                  value={productivityYears.includes(sourceYear) ? sourceYear : ""}
                  disabled={busy}
                  onChange={(event) => setSourceYear(Number(event.target.value))}
                >
                  <option value="" disabled>
                    Pilih tahun sumber yang tersedia
                  </option>
                  {productivityYears.map((value) => (
                    <option key={value} value={value}>
                      {value}
                      {value === productivityYears[0] ? " · terbaru tersedia" : ""}
                    </option>
                  ))}
                </select>
                <small className="text-muted">
                  Tahun analisis utama tidak diganti otomatis. Produktivitas memakai tahun sumber
                  yang dipilih di sini.
                </small>
              </label>
            )}
            {mode === "productivity" ? (
              <p className="small text-muted">
                MODIS MOD17A3HGF, resolusi sumber 500 m, satu tahun penuh. NPP dan GPP mengukur
                produktivitas vegetasi, bukan serapan bersih ekosistem atau pengukuran daun
                individual. Tahun yang belum diterbitkan tidak diganti diam-diam dengan tahun
                sebelumnya.{" "}
                <a
                  href="https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD17A3HGF"
                  target="_blank"
                  rel="noreferrer"
                >
                  Sumber dan periode tersedia
                </a>
                .
              </p>
            ) : (
              <>
                {mode === "detritus" && (
                  <label className="form-label d-block">
                    Metode koefisien
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
                      <option value="">Data lapangan / literatur yang ditentukan pengguna</option>
                      {catalog?.detritus_presets.map((item) => (
                        <option key={item.key} value={item.key}>
                          IPCC Tier 1 · {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="form-label d-block">
                  Sumber koefisien (pengukuran lapangan, judul/tautan literatur, lokasi dan tahun)
                  <textarea
                    className="form-control"
                    value={source}
                    maxLength={2000}
                    disabled={busy || (mode === "detritus" && Boolean(preset))}
                    onChange={(event) => setSource(event.target.value)}
                  />
                </label>
                <p className="small text-muted">
                  Masukkan stok karbon dalam Mg C/ha. Nilai ini bukan berat biomassa kering; lakukan
                  konversi memakai fraksi karbon terukur sebelum memasukkan data. Hasil diberi label
                  skenario dan tidak dijumlahkan otomatis dengan pool lain.
                </p>
                {mode === "detritus" ? (
                  <>
                    <div className="row g-2">
                      {input("Serasah (Mg C/ha)", litter, setLitter)}
                      {input("Kayu mati (Mg C/ha)", deadwood, setDeadwood)}
                    </div>
                    <label className="form-label d-block">
                      Area penerapan
                      <select
                        className="form-select"
                        value={mask}
                        disabled={busy || Boolean(preset)}
                        onChange={(event) => setMask(event.target.value)}
                      >
                        <option value="trees">Kelas pohon Dynamic World tahun skenario</option>
                        <option value="aoi">Seluruh AOI (area pengukuran homogen)</option>
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
                          Kategori iklim hutan preset sesuai dengan area penerapan. Saya membaca
                          hasil sebagai skenario Tier 1, bukan hasil survei lokal. {catalog?.method}
                        </span>
                      </label>
                    )}
                  </>
                ) : (
                  <>
                    <label className="form-label d-block">
                      Batas habitat
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
                          Mangrove Landsat baseline 2000 di dalam AOI
                        </option>
                        <option value="aoi_habitat">
                          AOI habitat terpetakan yang diunggah/dipilih
                        </option>
                      </select>
                    </label>
                    {habitat === "aoi_habitat" && (
                      <>
                        <label className="form-label d-block">
                          Jenis habitat
                          <select
                            className="form-select"
                            value={habitatType}
                            onChange={(event) => setHabitatType(event.target.value)}
                          >
                            <option value="mangrove">Mangrove</option>
                            <option value="seagrass">Lamun</option>
                            <option value="saltmarsh">Rawa asin</option>
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
                            AOI hanya mencakup habitat terpetakan; sumber batas dicantumkan di atas.
                          </span>
                        </label>
                      </>
                    )}
                    <div className="row g-2">
                      {input("AGB karbon (Mg C/ha)", agb, setAgb)}
                      {input("BGB karbon (Mg C/ha)", bgb, setBgb)}
                      {input("SOC sedimen (Mg C/ha)", soc, setSoc)}
                      {input("Kedalaman sedimen (cm)", depth, setDepth)}
                    </div>
                    <p className="small text-muted">
                      Blue carbon di sini adalah skenario stok pada habitat dan kedalaman yang
                      dinyatakan. Tidak mengasumsikan luas habitat masa kini dari baseline 2000,
                      tidak menghitung penimbunan tahunan, emisi, atau kredit karbon.
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
                {busy ? "Memproses modul..." : "Jalankan modul"}
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
                Rata-rata:{" "}
                <strong>
                  {result.carbon_estimated.statistics?.mean?.toLocaleString("id-ID", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  {result.carbon_estimated.unit}
                </strong>
              </span>
              <span>
                Total{" "}
                {result.carbon_estimated.quantity === "productivity"
                  ? "produktivitas tahunan"
                  : "stok"}
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
