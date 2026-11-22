import { useEffect, useState } from "react";
import CropPanelAccordion from "./CropPanelAccordion";
import { apiClient } from "@/services/apiClient";
import { runAnalysisJob } from "@/services/analysisJobs";
import { useI18nStore } from "@/hooks/useI18nStore";
import { localizeCropMessage } from "../utils";
import type { AoiPayload } from "@/features/carbon/lib/geo";
import type { CarbonResult } from "@/features/carbon/types";
import "./modis-productivity.css";

interface Props {
  aoi: AoiPayload | null;
  fieldName?: string;
  results: Record<string, CarbonResult>;
  onResult: (key: string, result: CarbonResult) => void;
}

const number = (value?: number | null, locale = "id-ID") => value == null ? "—" : value.toLocaleString(locale, { maximumFractionDigits: 2 });

export default function ModisProductivityPanel({ aoi, fieldName, results, onResult }: Props) {
  const t = useI18nStore((state) => state.t);
  const language = useI18nStore((state) => state.language);
  const numberLocale = language === "id" ? "id-ID" : "en-US";
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
      .catch((reason) => { if (active) setError(localizeCropMessage(reason instanceof Error ? reason.message : null, t) ?? (reason instanceof Error ? reason.message : t("crop.modis.yearsLoadFailed"))); });
    return () => { active = false; };
  }, []);

  const toggle = (metric: string) => setMetrics((current) => current.includes(metric) ? current.filter((item) => item !== metric) : [...current, metric]);

  async function run() {
    if (!aoi) {
      setError(t("crop.modis.aoiRequired"));
      return;
    }
    if (!metrics.length) {
      setError(t("crop.modis.productRequired"));
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
        failures.push(`${metric.toUpperCase()}: ${localizeCropMessage(reason instanceof Error ? reason.message : null, t) ?? (reason instanceof Error ? reason.message : t("crop.modis.analysisFailed"))}`);
      }
    }));
    if (failures.length) setError(failures.join("; "));
    setBusy(false);
  }

  return (
    <CropPanelAccordion title={t("crop.modis.panelTitle")} icon="bi-graph-up-arrow" className="cm-panel-card cm-modis-productivity-card">
      <div className="cm-modis-productivity__intro">
        <span><i className="bi bi-broadcast-pin" /> {t("crop.modis.sourceResolution")}</span>
        {fieldName && <span><i className="bi bi-geo-alt" /> {fieldName}</span>}
      </div>
      <p className="small text-muted">{t("crop.modis.intro")}</p>
      <div className="cm-modis-productivity__controls">
        <label className="form-label mb-0">{t("crop.modis.sourceYear")}
          <select className="form-select form-select-sm" value={year} disabled={busy || !years.length} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((value) => <option key={value} value={value}>{value}{value === years[0] ? ` · ${t("crop.modis.latest")}` : ""}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>{t("crop.modis.products")}</legend>
          {[["npp", "NPP"], ["gpp", "GPP"]].map(([key, label]) => <label className="form-check form-check-inline" key={key}>
            <input className="form-check-input" type="checkbox" checked={metrics.includes(key)} disabled={busy} onChange={() => toggle(key)} />
            <span className="form-check-label">{label}</span>
          </label>)}
        </fieldset>
        <button type="button" className="btn btn-success btn-sm" onClick={() => void run()} disabled={busy || !aoi || !years.length}>
          {busy ? <><span className="spinner-border spinner-border-sm me-1" /> {t("crop.modis.processing")}</> : <><i className="bi bi-play-fill me-1" /> {t("crop.runShort")}</>}
        </button>
      </div>
      {error && <div className="alert alert-warning py-2 mt-3 mb-0 small" role="alert">{error}</div>}
      {Object.entries(results).map(([key, result]) => (
        <div className="cm-modis-productivity__result" key={key}>
          <div><span>{key.toUpperCase()} · {year}</span><strong>{number(result.carbon_estimated.statistics?.mean, numberLocale)} {result.carbon_estimated.unit || t("crop.modis.defaultUnit")}</strong></div>
          <div><span>{t("crop.modis.totalArea")}</span><strong>{number(result.area_info.total_carbon_tons, numberLocale)} {result.carbon_estimated.unit?.replace("/ha", "") || t("crop.modis.totalUnit")}</strong></div>
        </div>
      ))}
      <a className="small d-inline-block mt-2" href="https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD17A3HGF" target="_blank" rel="noreferrer">{t("crop.modis.documentation")} <i className="bi bi-box-arrow-up-right" /></a>
    </CropPanelAccordion>
  );
}
