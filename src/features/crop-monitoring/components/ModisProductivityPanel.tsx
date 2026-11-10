import { useEffect, useState } from "react";
import CropPanelAccordion from "./CropPanelAccordion";
import { apiClient } from "@/services/apiClient";
import { runAnalysisJob } from "@/services/analysisJobs";
import type { AoiPayload } from "@/features/carbon/lib/geo";
import type { CarbonResult } from "@/features/carbon/types";
import "./modis-productivity.css";

interface Props {
  aoi: AoiPayload | null;
  fieldName?: string;
  results: Record<string, CarbonResult>;
  onResult: (key: string, result: CarbonResult) => void;
}

const number = (value?: number | null) => value == null ? "—" : value.toLocaleString("id-ID", { maximumFractionDigits: 2 });

export default function ModisProductivityPanel({ aoi, fieldName, results, onResult }: Props) {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [metrics, setMetrics] = useState(["npp", "gpp"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiClient.get<{ years: number[] }>("/carbon/extensions/productivity-years", { auth: "app" })
      .then((data) => {
        if (!active) return;
        setYears(data.years);
        setYear((current) => data.years.includes(current) ? current : data.years[0] ?? current);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Tahun MODIS gagal dimuat."); });
    return () => { active = false; };
  }, []);

  const toggle = (metric: string) => setMetrics((current) => current.includes(metric) ? current.filter((item) => item !== metric) : [...current, metric]);

  async function run() {
    if (!aoi) {
      setError("Pilih atau gambar AOI di Crop Monitoring terlebih dahulu.");
      return;
    }
    if (!metrics.length) {
      setError("Pilih minimal satu produk MODIS.");
      return;
    }
    setBusy(true);
    setError(null);
    const failures: string[] = [];
    await Promise.all(metrics.map(async (metric) => {
      try {
        const result = await runAnalysisJob<CarbonResult>("carbon", { extension: metric, aoi, year }, { timeoutMs: 1800000 });
        onResult(metric, result);
      } catch (reason) {
        failures.push(`${metric.toUpperCase()}: ${reason instanceof Error ? reason.message : "Analisis gagal"}`);
      }
    }));
    if (failures.length) setError(failures.join("; "));
    setBusy(false);
  }

  return (
    <CropPanelAccordion title="Produktivitas tahunan · MODIS NPP / GPP" icon="bi-graph-up-arrow" className="cm-panel-card cm-modis-productivity-card">
      <div className="cm-modis-productivity__intro">
        <span><i className="bi bi-broadcast-pin" /> Sumber MOD17A3HGF · resolusi 500 m</span>
        {fieldName && <span><i className="bi bi-geo-alt" /> {fieldName}</span>}
      </div>
      <p className="small text-muted">Pilih produk produktivitas vegetasi tahunan untuk AOI lahan ini. NPP/GPP bukan stok karbon atau serapan bersih ekosistem. Data tersedia mengikuti publikasi MODIS.</p>
      <div className="cm-modis-productivity__controls">
        <label className="form-label mb-0">Tahun sumber
          <select className="form-select form-select-sm" value={year} disabled={busy || !years.length} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((value) => <option key={value} value={value}>{value}{value === years[0] ? " · terbaru" : ""}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>Produk</legend>
          {[["npp", "NPP"], ["gpp", "GPP"]].map(([key, label]) => <label className="form-check form-check-inline" key={key}>
            <input className="form-check-input" type="checkbox" checked={metrics.includes(key)} disabled={busy} onChange={() => toggle(key)} />
            <span className="form-check-label">{label}</span>
          </label>)}
        </fieldset>
        <button type="button" className="btn btn-success btn-sm" onClick={() => void run()} disabled={busy || !aoi || !years.length}>
          {busy ? <><span className="spinner-border spinner-border-sm me-1" /> Memproses…</> : <><i className="bi bi-play-fill me-1" /> Jalankan</>}
        </button>
      </div>
      {error && <div className="alert alert-warning py-2 mt-3 mb-0 small" role="alert">{error}</div>}
      {Object.entries(results).map(([key, result]) => (
        <div className="cm-modis-productivity__result" key={key}>
          <div><span>{key.toUpperCase()} · {year}</span><strong>{number(result.carbon_estimated.statistics?.mean)} {result.carbon_estimated.unit || "kg C/m²/tahun"}</strong></div>
          <div><span>Total area</span><strong>{number(result.area_info.total_carbon_tons)} {result.carbon_estimated.unit?.replace("/ha", "") || "kg C/tahun"}</strong></div>
        </div>
      ))}
      <a className="small d-inline-block mt-2" href="https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD17A3HGF" target="_blank" rel="noreferrer">Dokumentasi dataset MODIS <i className="bi bi-box-arrow-up-right" /></a>
    </CropPanelAccordion>
  );
}
