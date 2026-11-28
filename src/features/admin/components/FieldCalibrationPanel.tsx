import { useEffect, useState, type FormEvent } from "react";
import TablePagination from "@/components/ui/TablePagination";
import InfoTip from "@/components/ui/InfoTip";
import { AdminTableNumberCell, AdminTableNumberHeader } from "./AdminTableNumber";
import { formatNumber, useI18nStore } from "@/hooks/useI18nStore";
import { useBilingualCopy } from "@/hooks/useBilingualCopy";
import {
  downloadJson,
  FIELD_CSV_HEADER,
  FIELD_POOLS,
  fieldApi,
  type Assessment,
  type CsvPreview,
  type FieldObservation,
  type Metric,
  type Pool,
  type FieldInventory,
} from "./carbonFieldApi";
import FieldObservationForm from "./FieldObservationForm";
import FieldValidationPlot from "./FieldValidationPlot";

const fmt = (n: number | null | undefined, language: "id" | "en") =>
  n == null ? "—" : formatNumber(n, language, { maximumFractionDigits: 3 });
function MetricRow({ label, metric, index, language }: { label: string; metric?: Metric; index: number; language: "id" | "en" }) {
  return (
    <tr>
      <AdminTableNumberCell index={index} />
      <td title={metric?.reason}>{label}</td>
      <td>{metric?.n_plots ?? "—"}</td>
      <td>{fmt(metric?.rmse, language)}</td>
      <td>{fmt(metric?.mae, language)}</td>
      <td>{fmt(metric?.bias, language)}</td>
      <td>{fmt(metric?.r2, language)}</td>
    </tr>
  );
}

export default function FieldCalibrationPanel({ datasetId }: { datasetId: string }) {
  const c = useBilingualCopy();
  const { t, language } = useI18nStore();
  const poolLabel = (value: string) => {
    const pool = value.includes("aboveground") || value === "agb" ? "agb"
      : value.includes("belowground") || value === "bgb" ? "bgb"
        : value.includes("soil_organic") || value === "soc" ? "soc"
          : value.includes("litter") ? "litter" : value.includes("deadwood") ? "deadwood" : null;
    return pool ? t(`admin.fieldCalibration.pool.${pool}`) : value;
  };
  const [rows, setRows] = useState<FieldObservation[]>([]);
  const [total, setTotal] = useState(0);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [history, setHistory] = useState<
    { id: string; target_pool: string; status: string; created_at: string; model?: Assessment["model"] }[]
  >([]);
  const [reviewReason, setReviewReason] = useState("");
  const [pool, setPool] = useState<Pool>("agb");
  const [autoPool, setAutoPool] = useState<Pool>("agb");
  const [autoYear, setAutoYear] = useState(new Date().getFullYear());
  const [autoOffset, setAutoOffset] = useState(0);
  const [predictionSource, setPredictionSource] = useState("");
  const [filterPool, setFilterPool] = useState<Pool | undefined>();
  const [inventory, setInventory] = useState<FieldInventory | null>(null);
  const [loadingRows, setLoadingRows] = useState(true);
  useEffect(() => {
    let active = true;
    void fieldApi
      .summary(datasetId)
      .then((data) => {
        if (active) setInventory(data);
      })
      .catch(() => {
        if (active) setError("Ringkasan data lapangan belum dapat dimuat.");
      });
    return () => {
      active = false;
    };
  }, [datasetId, refresh]);
  useEffect(() => {
    let active = true;
    void fieldApi
      .history(datasetId)
      .then((data) => {
        if (active) setHistory(data.runs);
      })
      .catch(() => {
        if (active) setError("Riwayat evaluasi belum dapat dimuat.");
      });
    return () => {
      active = false;
    };
  }, [datasetId, refresh]);
  useEffect(() => {
    let active = true;
    setLoadingRows(true);
    void fieldApi
      .list(datasetId, page, filterPool, search)
      .then((result) => {
        if (active) {
          setRows(result.rows);
          setTotal(result.total);
          setRecordsTotal(result.records_total ?? result.total);
        }
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "Data lapangan gagal dimuat.");
      })
      .finally(() => {
        if (active) setLoadingRows(false);
      });
    return () => {
      active = false;
    };
  }, [datasetId, page, refresh, filterPool, search]);
  function changed() {
    setRefresh((n) => n + 1);
    setAssessment(null);
    setNotice("Data lapangan tersimpan.");
  }
  async function calibrationAction(action: "approve" | "reject" | "activate" | "rollback") {
    const candidate = assessment?.model;
    if (!assessment || !candidate) return;
    if (action !== "activate" && reviewReason.trim().length < 3) {
      setError(language === "id" ? "Tulis alasan minimal 3 karakter." : "Enter a reason of at least 3 characters.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (action === "approve") await fieldApi.approve(assessment.id, reviewReason.trim());
      if (action === "reject") await fieldApi.reject(candidate.id, reviewReason.trim());
      if (action === "activate") await fieldApi.activate(candidate.id);
      if (action === "rollback") await fieldApi.rollback(candidate.id, reviewReason.trim());
      setAssessment(await fieldApi.assessment(assessment.id));
      setReviewReason("");
      setRefresh((n) => n + 1);
      setNotice(language === "id" ? "Status kalibrasi diperbarui dan dicatat di audit log." : "Calibration state updated and recorded in the audit log.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (language === "id" ? "Perubahan status gagal." : "Could not update calibration state."));
    } finally {
      setBusy(false);
    }
  }
  async function csv(previewOnly: boolean) {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await fieldApi.csv(datasetId, file, previewOnly);
      setPreview(data);
      if (!previewOnly) {
        changed();
        setPreview(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSV gagal diproses.");
    } finally {
      setBusy(false);
    }
  }
  async function addPrediction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const observation = rows.find((row) => row.id === data.get("observation"));
      const body: Record<string, unknown> = {
        source: data.get("source"),
        year: Number(data.get("year")),
        value_mg_c_ha: Number(data.get("value")),
        scale_m: Number(data.get("scale")),
        support: data.get("support"),
      };
      if (observation?.pool === "soc") {
        if (!String(data.get("top") ?? "").trim() || !String(data.get("bottom") ?? "").trim())
          throw new Error("Kedalaman prediksi SOC wajib diisi.");
        body.depth_top_cm = Number(data.get("top"));
        body.depth_bottom_cm = Number(data.get("bottom"));
      }
      await fieldApi.prediction(datasetId, String(data.get("observation")), body);
      changed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prediksi gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }
  async function extractPredictions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { run: queued } = await fieldApi.extractPredictions(datasetId, {
        pool: autoPool,
        analysis_year: Number(data.get("year")),
        offset: Number(data.get("offset")),
        limit: Number(data.get("limit")),
      });
      let run = queued;
      for (let attempt = 0; attempt < 90 && ["queued", "running"].includes(run.status); attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        run = await fieldApi.run(run.id);
      }
      if (run.status === "failed") {
        throw new Error(run.error?.message ?? "Ekstraksi prediksi GEE gagal.");
      }
      if (run.status === "queued" || run.status === "running") {
        throw new Error(`Ekstraksi masih berjalan. Buka riwayat run ${run.id} untuk memeriksa statusnya.`);
      }
      const source = run.metrics?.prediction_source;
      if (!source) throw new Error("Run selesai tanpa ID sumber prediksi.");
      setPool(autoPool);
      setPredictionSource(source);
      let validationNotice = "";
      try {
        const assessment = await fieldApi.assess(datasetId, {
          pool: autoPool,
          prediction_source: source,
          max_year_gap: Number(data.get("year_gap") ?? 0),
          allow_point_pixel: false,
          create_calibration_candidate: false,
          ...(autoPool === "soc"
            ? {
                depth_top_cm: Number(data.get("soc_top")),
                depth_bottom_cm: Number(data.get("soc_bottom")),
              }
            : {}),
        });
        setAssessment(assessment);
        validationNotice = assessment.metrics.baseline_validation.status === "computed"
          ? `Validasi lapangan otomatis tersimpan: ${assessment.metrics.validation_plots} plot validasi terpisah.`
          : `Evaluasi lapangan tersimpan, tetapi metrik validasi belum dapat dihitung (${assessment.metrics.validation_plots} plot validasi cocok).`;
      } catch (assessmentError) {
        validationNotice = assessmentError instanceof Error
          ? `Prediksi tersimpan; evaluasi otomatis belum berhasil: ${assessmentError.message}`
          : "Prediksi tersimpan; evaluasi otomatis belum berhasil. Jalankan evaluasi manual setelah memeriksa pasangan plot.";
      }
      setRefresh((value) => value + 1);
      setNotice(
        `Prediksi ${autoPool.toUpperCase()} tersimpan untuk batch ini: ${run.metrics?.predictions_saved ?? 0} baru, ${run.metrics?.predictions_reused ?? 0} dipakai ulang, ${run.metrics?.without_valid_pixels ?? 0} tanpa piksel valid. ${validationNotice} Sumber: ${source}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prediksi GEE gagal diproses.");
    } finally {
      setBusy(false);
    }
  }
  async function evaluate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await fieldApi.assess(datasetId, {
        pool,
        prediction_source: data.get("source"),
        max_year_gap: Number(data.get("gap")),
        allow_point_pixel: data.get("point") === "on",
        ...(pool === "soc"
          ? { depth_top_cm: Number(data.get("top")), depth_bottom_cm: Number(data.get("bottom")) }
          : {}),
      });
      setAssessment(result);
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluasi gagal.");
    } finally {
      setBusy(false);
    }
  }
  function template() {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + FIELD_CSV_HEADER + "\r\n"], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "savegeo-field-carbon-pools.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="field-calibration-panel" aria-label={t("admin.fieldCalibration.panelAria")}>
      <header className="field-calibration-panel__header">
        <div className="field-calibration-panel__title">
          <span className="field-calibration-panel__icon"><i className="bi bi-clipboard-data" aria-hidden="true" /></span>
          <div>
            <h3>{t("admin.fieldCalibration.panelTitle")}</h3>
            <span>{t("admin.fieldCalibration.inventorySummary", { records: formatNumber(inventory?.total_records ?? recordsTotal, language) })}</span>
          </div>
          <InfoTip label={t("admin.fieldCalibration.guideTitle")} content={t("admin.fieldCalibration.guideText")} />
        </div>
        <button type="button" className="btn btn-light field-calibration-panel__template" onClick={template}>
          <i className="bi bi-download" aria-hidden="true" /> {t("admin.fieldCalibration.downloadTemplate")}
        </button>
      </header>
      <div className="field-calibration-panel__body">
      <div
        className="field-pool-filters"
        role="group"
        aria-label={t("admin.fieldCalibration.poolFilter")}
      >
        <button
          type="button"
          className={`field-pool-filter ${filterPool ? "" : "is-active"}`}
          aria-pressed={!filterPool}
          onClick={() => {
            setFilterPool(undefined);
            setPage(1);
          }}
        >
          <strong>{t("admin.fieldCalibration.allPools")}</strong><small>{t("admin.fieldCalibration.measurementCount", { count: formatNumber(inventory?.total_records ?? recordsTotal, language) })}</small>
        </button>
        {FIELD_POOLS.map(({ value }) => (
          <button
            type="button"
            key={value}
            className={`field-pool-filter ${filterPool === value ? "is-active" : ""}`}
            aria-pressed={filterPool === value}
            onClick={() => {
              setFilterPool(value);
              setPage(1);
            }}
          >
            <strong className="d-block">
              {poolLabel(value)} · {inventory?.pools[value].records ?? "—"}
            </strong>
            <small>
              {inventory
                ? t("admin.fieldCalibration.plotCounts", {
                    calibration: formatNumber(inventory.pools[value].calibration_plots, language),
                    validation: formatNumber(inventory.pools[value].validation_plots, language),
                  })
                : t("admin.fieldCalibration.loadingSummary")}
            </small>
          </button>
        ))}
      </div>
      <FieldObservationForm datasetId={datasetId} onSaved={changed} />
      <details className="field-panel-accordion">
        <summary className="fw-semibold">{t("admin.fieldCalibration.csvImportTitle")}</summary>
        <div className="d-flex gap-2 flex-wrap mt-3">
          <input
            type="file"
            accept=".csv"
            aria-label={t("admin.fieldCalibration.csvFile")}
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
            }}
          />
          <button
            className="btn btn-outline-primary btn-sm"
            type="button"
            disabled={busy || !file}
            onClick={() => void csv(true)}
          >
            {t("admin.fieldCalibration.checkCsv")}
          </button>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            disabled={busy || !preview?.valid}
            onClick={() => void csv(false)}
          >
            {t("admin.fieldCalibration.saveAllRows")}
          </button>
        </div>
        <p className="small text-muted mt-2">
          {t("admin.fieldCalibration.csvHelp")}
        </p>
        {preview && (
          <>
            <p>
              {t("admin.fieldCalibration.previewSummary", { valid: preview.preview.length, errors: preview.errors.length })}
            </p>
            {preview.errors.length > 0 && (
              <ul className="text-danger">
                {preview.errors.slice(0, 15).map((row) => (
                  <li key={row.row}>
                    {t("admin.fieldCalibration.csvRowError", { row: row.row, message: row.message })}
                  </li>
                ))}
              </ul>
            )}
            <div className="field-calibration-table-wrap">
              <table className="tbl tbl-wide field-calibration-table field-calibration-table--preview">
                <thead>
                  <tr>
                    <AdminTableNumberHeader />
                    <th>{t("admin.fieldObservation.plotId")}</th>
                    <th>{t("admin.fieldObservation.pool")}</th>
                    <th>{t("admin.fieldObservation.plotRole")}</th>
                    <th>Mg C/ha</th>
                    <th>{t("admin.fieldCalibration.notes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.slice(0, 10).map((row, i) => (
                    <tr key={row.row}>
                      <AdminTableNumberCell index={i} />
                      <td>{row.plot_id}</td>
                      <td>{row.pool.toUpperCase()}</td>
                      <td>{row.role === "calibration" ? t("admin.fieldObservation.calibration") : t("admin.fieldObservation.independentValidation")}</td>
                      <td>{fmt(row.observed_mg_c_ha, language)}</td>
                      <td>{row.warnings.join(" ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </details>
      <div className="field-calibration-table-wrap">
        <table className="tbl tbl-wide field-calibration-table field-calibration-table--observations">
          <thead>
            <tr>
              <AdminTableNumberHeader />
              <th>{t("admin.fieldCalibration.plotDate")}</th>
              <th>{t("admin.fieldCalibration.poolDepth")}</th>
              <th>{t("admin.fieldObservation.plotRole")}</th>
              <th>{t("admin.fieldCalibration.carbonMg")}</th>
              <th>{t("admin.fieldCalibration.reference")}</th>
              <th>{t("admin.fieldCalibration.predictionSource")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id}>
                <AdminTableNumberCell index={(page - 1) * 100 + i} />
                <td>
                  {row.raw.plot_id}
                  <small className="d-block text-muted">{row.raw.survey_date}</small>
                </td>
                <td>
                  {row.pool.toUpperCase()}
                  {row.pool === "soc" && (
                    <small className="d-block">
                      {row.raw.depth_top_cm}–{row.raw.depth_bottom_cm} cm
                    </small>
                  )}
                </td>
                <td>{row.role === "calibration" ? t("admin.fieldObservation.calibration") : t("admin.fieldObservation.independentValidation")}</td>
                <td>{fmt(row.observed_mg_c_ha, language)}</td>
                <td>
                  {t(`admin.fieldObservation.reference.${row.raw.reference_type}`)}
                  <small className="d-block text-muted">{row.raw.source}</small>
                </td>
                <td>{row.predictions.map((p) => p.source).join(", ") || t("admin.fieldCalibration.noPredictionPaired")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination
        page={page - 1}
        pageCount={Math.max(1, Math.ceil(total / 100))}
        recordsTotal={recordsTotal}
        recordsFiltered={total}
        pageSize={100}
        search={search}
        searchPlaceholder={t("admin.fieldCalibration.searchPlaceholder")}
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
        onPrev={() => setPage((current) => Math.max(1, current - 1))}
        onNext={() => setPage((current) => Math.min(Math.max(1, Math.ceil(total / 100)), current + 1))}
      />
      {loadingRows && (
        <p role="status" className="text-muted">
          {t("admin.fieldCalibration.loadingMeasurements")}
        </p>
      )}
      {!loadingRows && !rows.length && (
        <p className="field-calibration-empty">
          {search ? t("admin.fieldCalibration.noSearchMatch") : t("admin.fieldCalibration.noMeasurements")}
        </p>
      )}
      <details className="field-panel-accordion">
        <summary className="fw-semibold">{t("admin.fieldCalibration.extractTitle")}</summary>
        <form className="mt-3" onSubmit={(event) => void extractPredictions(event)}>
          <fieldset disabled={busy || !(inventory?.total_records ?? total)}>
            <div className="row g-2">
              <label className="col-md-3 form-label">
                {t("admin.fieldObservation.pool")}
                <select
                  className="form-select"
                  value={autoPool}
                  onChange={(event) => setAutoPool(event.target.value as Pool)}
                >
                  {FIELD_POOLS.map((item) => <option key={item.value} value={item.value}>{poolLabel(item.value)}</option>)}
                </select>
              </label>
              <label className="col-md-3 form-label">
                {t("admin.fieldCalibration.predictionYear")}
                <input
                  name="year"
                  type="number"
                  min={1984}
                  max={new Date().getFullYear()}
                  value={autoYear}
                  onChange={(event) => setAutoYear(Number(event.target.value))}
                  className="form-control"
                  required
                />
              </label>
              <label className="col-md-3 form-label">
                {t("admin.fieldCalibration.batchOffset")}
                <input
                  name="offset"
                  type="number"
                  min={0}
                  max={100000}
                  step={1}
                  value={autoOffset}
                  onChange={(event) => setAutoOffset(Number(event.target.value))}
                  className="form-control"
                />
              </label>
              <label className="col-md-3 form-label">
                {t("admin.fieldCalibration.plotsPerBatch")}
                <select name="limit" className="form-select" defaultValue="250">
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="250">250</option>
                  <option value="500">500</option>
                </select>
              </label>
              <label className="col-md-3 form-label">
                {t("admin.fieldCalibration.maxSurveyYearGap")}
                <input name="year_gap" type="number" min={0} max={5} step={1} defaultValue={0} className="form-control" />
              </label>
              {autoPool === "soc" && (
                <>
                  <label className="col-md-3 form-label">
                    {t("admin.fieldObservation.targetDepthTop")}
                    <input name="soc_top" type="number" min={0} step="any" required className="form-control" />
                  </label>
                  <label className="col-md-3 form-label">
                    {t("admin.fieldObservation.targetDepthBottom")}
                    <input name="soc_bottom" type="number" min={0.001} step="any" required className="form-control" />
                  </label>
                </>
              )}
            </div>
            <p className="small text-muted mt-2 mb-2">
              {t("admin.fieldCalibration.extractHelp")}
            </p>
            <button type="submit" className="btn btn-outline-success" disabled={busy}>
              {busy ? t("admin.fieldCalibration.extracting") : t("admin.fieldCalibration.extractBatch")}
            </button>
          </fieldset>
        </form>
      </details>
      <details className="field-panel-accordion">
        <summary className="fw-semibold">{t("admin.fieldCalibration.pairPredictionTitle")}</summary>
        <form className="mt-3" onSubmit={(event) => void addPrediction(event)}>
          <fieldset disabled={busy || !rows.length}>
            <div className="row g-2">
              <label className="col-md-6 form-label">
                {t("admin.fieldCalibration.measurementActivePage")}
                <select name="observation" className="form-select" required>
                  {rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.raw.plot_id} · {r.pool.toUpperCase()} · {r.raw.survey_date}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-md-6 form-label">
                {t("admin.fieldCalibration.modelVersionPeriod")}
                <input
                  name="source"
                  className="form-control"
                  minLength={3}
                  maxLength={255}
                  required
                  placeholder={t("admin.fieldCalibration.modelIdPlaceholder")}
                />
              </label>
              {[
                ["year", t("admin.fieldCalibration.predictionYear"), 1900, 2100],
                ["value", t("admin.fieldCalibration.predictedCarbonMg"), 0, undefined],
                ["scale", t("admin.fieldCalibration.sourceResolution"), 0.001, undefined],
                ["top", t("admin.fieldCalibration.socDepthTop"), 0, undefined],
                ["bottom", t("admin.fieldCalibration.socDepthBottom"), 0.001, undefined],
              ].map(([name, label, min, max]) => (
                <label key={String(name)} className="col-md-4 form-label">
                  {label}
                  <input
                    name={String(name)}
                    type="number"
                    step="any"
                    min={Number(min)}
                    max={max == null ? undefined : Number(max)}
                    required={!["top", "bottom"].includes(String(name))}
                    className="form-control"
                  />
                </label>
              ))}
              <label className="col-md-4 form-label">
                {t("admin.fieldCalibration.spatialSupport")}
                <select name="support" className="form-select">
                  <option value="plot_mean">{t("admin.fieldCalibration.plotRasterMean")}</option>
                  <option value="point_pixel">{t("admin.fieldCalibration.pointPixel")}</option>
                </select>
              </label>
            </div>
            <p className="small text-muted mt-2">
              {t("admin.fieldCalibration.pairPredictionHelp")}
            </p>
            <button type="submit" className="btn btn-outline-primary">
              {t("admin.fieldCalibration.savePredictionPair")}
            </button>
          </fieldset>
        </form>
      </details>
      <details className="field-panel-accordion">
        <summary className="fw-semibold">{t("admin.fieldCalibration.evaluateTitle")}</summary>
        <form className="mt-3" onSubmit={(event) => void evaluate(event)}>
          <fieldset disabled={busy || !(inventory?.total_records ?? total)}>
            <div className="row g-3">
              <label className="col-md-3 form-label">
                {t("admin.fieldObservation.pool")}
                <select
                  className="form-select"
                  value={pool}
                  onChange={(e) => setPool(e.target.value as Pool)}
                >
                  <option value="agb">AGB</option>
                  <option value="bgb">BGB</option>
                  <option value="soc">SOC</option>
                  <option value="litter">{poolLabel("litter")}</option>
                  <option value="deadwood">{poolLabel("deadwood")}</option>
                </select>
              </label>
              <label className="col-md-6 form-label">
                {t("admin.fieldCalibration.predictionSourceId")}
                <input
                  name="source"
                  list="field-prediction-sources"
                  minLength={3}
                  required
                  className="form-control"
                  value={predictionSource}
                  onChange={(event) => setPredictionSource(event.target.value)}
                />
                <datalist id="field-prediction-sources">
                  {(
                    inventory?.pools[pool].sources ?? [
                      ...new Set(rows.flatMap((r) => r.predictions.map((p) => p.source))),
                    ]
                  ).map((source) => (
                    <option key={source} value={source} />
                  ))}
                </datalist>
              </label>
              <label className="col-md-3 form-label">
                {t("admin.fieldCalibration.maxYearGap")}
                <input
                  name="gap"
                  type="number"
                  min={0}
                  max={5}
                  step={1}
                  defaultValue={0}
                  className="form-control"
                  required
                />
              </label>
              {pool === "soc" && (
                <>
                  <label className="col-md-3 form-label">
                    {t("admin.fieldCalibration.socDepthTop")}
                    <input
                      name="top"
                      type="number"
                      step="any"
                      min={0}
                      required
                      className="form-control"
                    />
                  </label>
                  <label className="col-md-3 form-label">
                    {t("admin.fieldCalibration.socDepthBottom")}
                    <input
                      name="bottom"
                      type="number"
                      step="any"
                      min={0.001}
                      required
                      className="form-control"
                    />
                  </label>
                </>
              )}
            </div>
            <label className="form-check mt-3">
              <input name="point" className="form-check-input" type="checkbox" />
              <span className="form-check-label">
                {t("admin.fieldCalibration.allowPointPixel")}
              </span>
            </label>
            <button className="btn btn-primary mt-3" type="submit">
              {busy ? t("admin.fieldCalibration.calculating") : t("admin.fieldCalibration.runEvaluation")}
            </button>
          </fieldset>
        </form>
      </details>
      {error && (
        <p className="text-danger mt-3" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-success mt-2">
          {notice}
        </p>
      )}
      {history.length > 0 && (
        <label className="form-label mt-3 d-block">
          {t("admin.fieldCalibration.openSavedAssessments")}
          <select
            className="form-select"
            disabled={busy}
            value={assessment?.id ?? ""}
            onChange={async (event) => {
              const id = event.target.value;
              if (!id) return;
              setBusy(true);
              try {
                setAssessment(await fieldApi.assessment(id));
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : "Riwayat gagal dibuka.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <option value="">{t("admin.fieldCalibration.selectAssessment")}</option>
            {history.map((item) => (
              <option key={item.id} value={item.id}>
                {poolLabel(item.target_pool)} ·{" "}
                {new Date(item.created_at).toLocaleString(language === "en" ? "en-US" : "id-ID")} · {item.status}
              </option>
            ))}
          </select>
        </label>
      )}
      {assessment && (
        <div className="field-assessment-card">
          <div className="d-flex gap-3 flex-wrap justify-content-between">
            <h4 className="h6">
              {t("admin.fieldCalibration.assessmentResult")} ·{" "}
              {poolLabel(
                assessment.metrics.configuration?.pool ?? assessment.target_pool ?? "",
              )}{" "}
              · {assessment.metrics.status === "computed" ? t("admin.fieldCalibration.computed") : t("admin.fieldCalibration.couldNotCompute")}
            </h4>
            <button
              className="btn btn-outline-secondary btn-sm"
              type="button"
              onClick={() => downloadJson(assessment, `field-assessment-${assessment.id}.json`)}
            >
              {t("admin.fieldCalibration.downloadJson")}
            </button>
          </div>
          <p>
            {t("admin.fieldCalibration.assessmentCounts", {
              calibration: formatNumber(assessment.metrics.calibration_plots, language),
              validation: formatNumber(assessment.metrics.validation_plots, language),
              excluded: formatNumber(assessment.metrics.excluded.length, language),
            })}
          </p>
          {assessment.metrics.configuration && (
            <p className="small text-muted">
              {t("admin.fieldCalibration.predictionSource")}: {assessment.metrics.configuration.prediction_source}
            </p>
          )}
          {assessment.model && (
            <section className="border rounded p-3 my-3" aria-label={language === "id" ? "Siklus review kalibrasi" : "Calibration review lifecycle"}>
              <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center">
                <strong>{assessment.model.model_name} · v{assessment.model.version}</strong>
                <span className={`badge ${assessment.model.status === "active_local" ? "text-bg-success" : assessment.model.status === "approved_local" ? "text-bg-primary" : "text-bg-secondary"}`}>
                  {assessment.model.status}{assessment.model.is_active ? " · active" : ""}
                </span>
              </div>
              {assessment.model.metadata?.review && (
                <div className="small mt-2" aria-label={language === "id" ? "Catatan review terakhir" : "Latest review record"}>
                  <strong>{assessment.model.metadata.review.decision}</strong>
                  {assessment.model.metadata.review.reviewer?.username && ` · ${assessment.model.metadata.review.reviewer.username}`}
                  {assessment.model.metadata.review.reviewer?.role && ` (${assessment.model.metadata.review.reviewer.role})`}
                  {assessment.model.metadata.review.reviewed_at && ` · ${new Date(assessment.model.metadata.review.reviewed_at).toLocaleString(language === "en" ? "en-US" : "id-ID")}`}
                  {assessment.model.metadata.review.reason && <div>{assessment.model.metadata.review.reason}</div>}
                </div>
              )}
              <p className="small text-muted mt-2 mb-2">
                {language === "id"
                  ? "Persetujuan mensyaratkan baseline model, hash, snapshot prediksi, domain aplikasi, serta sedikitnya tiga plot kalibrasi dan tiga plot validasi terpisah. Penyetuju harus berbeda dari pembuat run."
                  : "Approval requires the base model, artifact hash, prediction snapshot, application domain, and at least three separate calibration and validation plots. The reviewer must differ from the run creator."}
              </p>
              {assessment.model.status !== "active_local" && assessment.model.status !== "rejected" && (
                <label className="form-label small d-block">
                  {language === "id" ? "Alasan review / rollback" : "Review / rollback reason"}
                  <input className="form-control form-control-sm mt-1" value={reviewReason} maxLength={1000}
                    onChange={(event) => setReviewReason(event.target.value)} />
                </label>
              )}
              <div className="d-flex flex-wrap gap-2">
                {["experimental", "pending_approval", "approved_local", "rolled_back"].includes(assessment.model.status) && (
                  <>
                    <button className="btn btn-outline-primary btn-sm" type="button" disabled={busy || reviewReason.trim().length < 3} onClick={() => void calibrationAction("approve")}>
                      {language === "id" ? "Setujui sebagai lokal" : "Approve locally"}
                    </button>
                    <button className="btn btn-outline-danger btn-sm" type="button" disabled={busy || reviewReason.trim().length < 3} onClick={() => void calibrationAction("reject")}>
                      {language === "id" ? "Tolak kandidat" : "Reject candidate"}
                    </button>
                  </>
                )}
                {["approved_local", "rolled_back"].includes(assessment.model.status) && (
                  <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => void calibrationAction("activate")}>
                    {language === "id" ? "Aktifkan versi lokal" : "Activate local version"}
                  </button>
                )}
                {assessment.model.status === "active_local" && (
                  <>
                    <label className="form-label small mb-0">
                      {language === "id" ? "Alasan rollback" : "Rollback reason"}
                      <input className="form-control form-control-sm mt-1" value={reviewReason} maxLength={1000}
                        onChange={(event) => setReviewReason(event.target.value)} />
                    </label>
                    <button className="btn btn-outline-danger btn-sm align-self-end" type="button" disabled={busy || reviewReason.trim().length < 3} onClick={() => void calibrationAction("rollback")}>
                      {language === "id" ? "Rollback ke versi sebelumnya" : "Rollback to previous version"}
                    </button>
                  </>
                )}
              </div>
            </section>
          )}
          <div className="field-calibration-table-wrap">
            <table className="tbl tbl-wide field-calibration-table field-calibration-table--metrics">
              <thead>
                <tr>
                  <AdminTableNumberHeader />
                  <th>{t("admin.fieldCalibration.evaluation")}</th>
                  <th>{t("admin.fieldCalibration.plotCount")}</th>
                  <th>RMSE</th>
                  <th>MAE</th>
                  <th>{t("admin.fieldCalibration.bias")}</th>
                  <th>R²</th>
                </tr>
              </thead>
              <tbody>
                <MetricRow
                  index={0}
                  label={t("admin.fieldCalibration.baselineCalibration")}
                  metric={assessment.metrics.baseline_calibration}
                  language={language}
                />
                <MetricRow
                  index={1}
                  label={t("admin.fieldCalibration.crossValidation")}
                  metric={assessment.metrics.cross_validation}
                  language={language}
                />
                <MetricRow
                  index={2}
                  label={t("admin.fieldCalibration.baselineValidation")}
                  metric={assessment.metrics.baseline_validation}
                  language={language}
                />
                <MetricRow
                  index={3}
                  label={t("admin.fieldCalibration.calibratedValidation")}
                  metric={assessment.metrics.calibrated_validation}
                  language={language}
                />
              </tbody>
            </table>
          </div>
          <p className="small">
            {t("admin.fieldCalibration.metricNote")}
          </p>
          {assessment.metrics.artifact && (
            <p>
              {t("admin.fieldCalibration.candidateEquation")} C ={" "}
              {assessment.metrics.artifact.clip_min === 0 ? "maks(0, " : ""}
              {fmt(assessment.metrics.artifact.intercept, language)} +{" "}
              {fmt(assessment.metrics.artifact.slope, language)} × {t("admin.fieldCalibration.sourcePrediction")}
              {assessment.metrics.artifact.clip_min === 0 ? ")" : ""}{c(". Disimpan sebagai model", ". Saved as a model")}
              {t("admin.fieldCalibration.experimentalNotActive")}
            </p>
          )}
          <p className="small text-muted">{assessment.metrics.method_note}</p>
          <FieldValidationPlot
            independent={assessment.metrics.baseline_validation.status === "computed"}
            baseline={
              assessment.metrics.baseline_validation.status === "computed"
                ? assessment.metrics.baseline_validation
                : assessment.metrics.baseline_calibration
            }
            corrected={
              assessment.metrics.baseline_validation.status === "computed"
                ? assessment.metrics.calibrated_validation
                : assessment.metrics.cross_validation
            }
          />
          <ul>
            {assessment.metrics.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          {assessment.metrics.excluded.length > 0 && (
            <details>
              <summary>{t("admin.fieldCalibration.excludedReasons")}</summary>
              <ul>
                {assessment.metrics.excluded.map((r) => (
                  <li key={r.id}>
                    {r.plot_id}: {t(`admin.fieldCalibration.exclusion.${r.reason}`)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      </div>
    </section>
  );
}
