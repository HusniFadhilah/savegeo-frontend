import { useEffect, useState, type FormEvent } from "react";
import TablePagination from "@/components/ui/TablePagination";
import InfoTip from "@/components/ui/InfoTip";
import { AdminTableNumberCell, AdminTableNumberHeader } from "./AdminTableNumber";
import {
  downloadJson,
  FIELD_CSV_HEADER,
  FIELD_POOLS,
  FIELD_REFERENCE_LABELS,
  FIELD_EXCLUSION_LABELS,
  fieldPoolLabel,
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

const fmt = (n?: number | null) =>
  n == null ? "—" : n.toLocaleString("id-ID", { maximumFractionDigits: 3 });
function MetricRow({ label, metric, index }: { label: string; metric?: Metric; index: number }) {
  return (
    <tr>
      <AdminTableNumberCell index={index} />
      <td title={metric?.reason}>{label}</td>
      <td>{metric?.n_plots ?? "—"}</td>
      <td>{fmt(metric?.rmse)}</td>
      <td>{fmt(metric?.mae)}</td>
      <td>{fmt(metric?.bias)}</td>
      <td>{fmt(metric?.r2)}</td>
    </tr>
  );
}

export default function FieldCalibrationPanel({ datasetId }: { datasetId: string }) {
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
    { id: string; target_pool: string; status: string; created_at: string }[]
  >([]);
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
    <section className="field-calibration-panel" aria-label="Data lapangan dan kalibrasi per pool">
      <header className="field-calibration-panel__header">
        <div className="field-calibration-panel__title">
          <span className="field-calibration-panel__icon"><i className="bi bi-clipboard-data" aria-hidden="true" /></span>
          <div>
            <h3>Data lapangan dan kalibrasi karbon</h3>
            <span>{inventory?.total_records ?? recordsTotal} pengukuran <span aria-hidden="true">·</span> 5 pool <span aria-hidden="true">·</span> Mg C/ha <span aria-hidden="true">·</span> WGS84</span>
          </div>
          <InfoTip label="Panduan data lapangan dan kalibrasi" content="Pisahkan plot kalibrasi dan validasi sejak awal. Persamaan allometri, rasio akar:tajuk, metode laboratorium, sumber, luas, dan tanggal pengukuran perlu dicatat per pengamatan. Ringkasan mencakup seluruh kunjungan. Kalibrasi memerlukan minimal tiga plot; statistik validasi terpisah memerlukan minimal dua plot lain. Evaluasi menyaring kesesuaian tahun, dukungan spasial, dan kedalaman SOC." />
        </div>
        <button type="button" className="btn btn-light field-calibration-panel__template" onClick={template}>
          <i className="bi bi-download" aria-hidden="true" /> Unduh template CSV
        </button>
      </header>
      <div className="field-calibration-panel__body">
      <div
        className="field-pool-filters"
        role="group"
        aria-label="Filter data berdasarkan pool"
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
          <strong>Semua pool</strong><small>{inventory?.total_records ?? recordsTotal} pengukuran</small>
        </button>
        {FIELD_POOLS.map(({ value, label }) => (
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
              {label} · {inventory?.pools[value].records ?? "—"}
            </strong>
            <small>
              {inventory
                ? `${inventory.pools[value].calibration_plots} plot kalibrasi · ${inventory.pools[value].validation_plots} plot validasi`
                : "Memuat ringkasan…"}
            </small>
          </button>
        ))}
      </div>
      <FieldObservationForm datasetId={datasetId} onSaved={changed} />
      <details className="field-panel-accordion">
        <summary className="fw-semibold">Impor CSV · pratinjau sebelum menyimpan</summary>
        <div className="d-flex gap-2 flex-wrap mt-3">
          <input
            type="file"
            accept=".csv"
            aria-label="Berkas pengukuran lapangan CSV"
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
            Periksa CSV
          </button>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            disabled={busy || !preview?.valid}
            onClick={() => void csv(false)}
          >
            Simpan seluruh baris
          </button>
        </div>
        <p className="small text-muted mt-2">
          Nilai karbon dan biomassa kering dibedakan oleh kolom quantity. Prediksi opsional dapat
          ditambahkan kemudian. soil_layers_json dapat memuat lapisan SOC; fraksi kasar memakai
          persen volume dan BD tanah halus. Maksimum 2.000 baris / 5 MB; jika satu baris salah,
          seluruh impor dibatalkan.
        </p>
        {preview && (
          <>
            <p>
              {preview.preview.length} baris valid; {preview.errors.length} kesalahan.
            </p>
            {preview.errors.length > 0 && (
              <ul className="text-danger">
                {preview.errors.slice(0, 15).map((row) => (
                  <li key={row.row}>
                    Baris {row.row}: {row.message}
                  </li>
                ))}
              </ul>
            )}
            <div className="field-calibration-table-wrap">
              <table className="tbl tbl-wide field-calibration-table field-calibration-table--preview">
                <thead>
                  <tr>
                    <AdminTableNumberHeader />
                    <th>Plot</th>
                    <th>Pool</th>
                    <th>Peran</th>
                    <th>Mg C/ha</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.slice(0, 10).map((row, i) => (
                    <tr key={row.row}>
                      <AdminTableNumberCell index={i} />
                      <td>{row.plot_id}</td>
                      <td>{row.pool.toUpperCase()}</td>
                      <td>{row.role}</td>
                      <td>{fmt(row.observed_mg_c_ha)}</td>
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
              <th>Plot / tanggal</th>
              <th>Pool / kedalaman</th>
              <th>Peran</th>
              <th>Karbon (Mg C/ha)</th>
              <th>Referensi</th>
              <th>Sumber prediksi</th>
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
                <td>{row.role === "calibration" ? "Kalibrasi" : "Validasi"}</td>
                <td>{fmt(row.observed_mg_c_ha)}</td>
                <td>
                  {FIELD_REFERENCE_LABELS[row.raw.reference_type] ?? row.raw.reference_type}
                  <small className="d-block text-muted">{row.raw.source}</small>
                </td>
                <td>{row.predictions.map((p) => p.source).join(", ") || "Belum dipasangkan"}</td>
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
        searchPlaceholder="Cari plot, pool, referensi, sumber"
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
        onPrev={() => setPage((current) => Math.max(1, current - 1))}
        onNext={() => setPage((current) => Math.min(Math.max(1, Math.ceil(total / 100)), current + 1))}
      />
      {loadingRows && (
        <p role="status" className="text-muted">
          Memuat pengukuran…
        </p>
      )}
      {!loadingRows && !rows.length && (
        <p className="field-calibration-empty">
          {search ? "Tidak ada pengukuran yang cocok dengan pencarian." : "Belum ada pengukuran pada filter ini. Berkas survei lama tetap tersedia di bagian sumber dataset."}
        </p>
      )}
      <details className="field-panel-accordion">
        <summary className="fw-semibold">Ekstrak prediksi dari model GEE yang disetujui</summary>
        <form className="mt-3" onSubmit={(event) => void extractPredictions(event)}>
          <fieldset disabled={busy || !(inventory?.total_records ?? total)}>
            <div className="row g-2">
              <label className="col-md-3 form-label">
                Pool
                <select
                  className="form-select"
                  value={autoPool}
                  onChange={(event) => setAutoPool(event.target.value as Pool)}
                >
                  {FIELD_POOLS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="col-md-3 form-label">
                Tahun prediksi
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
                Offset batch
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
                Plot per batch
                <select name="limit" className="form-select" defaultValue="250">
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="250">250</option>
                  <option value="500">500</option>
                </select>
              </label>
              <label className="col-md-3 form-label">
                Selisih tahun survei maksimum
                <input name="year_gap" type="number" min={0} max={5} step={1} defaultValue={0} className="form-control" />
              </label>
              {autoPool === "soc" && (
                <>
                  <label className="col-md-3 form-label">
                    Kedalaman SOC atas (cm)
                    <input name="soc_top" type="number" min={0} step="any" required className="form-control" />
                  </label>
                  <label className="col-md-3 form-label">
                    Kedalaman SOC bawah (cm)
                    <input name="soc_bottom" type="number" min={0.001} step="any" required className="form-control" />
                  </label>
                </>
              )}
            </div>
            <p className="small text-muted mt-2 mb-2">
              Sistem memilih model GEE aktif dengan evaluasi dan persetujuan independen yang cocok untuk pool ini.
              Jalankan batch berikutnya dengan offset bertambah sesuai jumlah plot per batch. Geometri plot tersimpan
              dipakai bila tersedia; selain itu digunakan lingkaran dengan luas setara dari titik koordinat dan luas plot.
              Hasil tersimpan sebagai snapshot prediksi berversi dan tidak menimpa snapshot sebelumnya. Setelah ekstraksi,
              pasangan dievaluasi otomatis terhadap plot kalibrasi dan validasi; SOC hanya dibandingkan pada kedalaman
              yang Anda isi dan plot tanpa pasangan cocok tetap dilaporkan sebagai pengecualian. Evaluasi otomatis tidak
              membuat kandidat kalibrasi; gunakan evaluasi manual setelah seluruh batch tersedia untuk membuat kandidat.
            </p>
            <button type="submit" className="btn btn-outline-success" disabled={busy}>
              {busy ? "Mengekstrak dari Earth Engine…" : "Ekstrak prediksi batch"}
            </button>
          </fieldset>
        </form>
      </details>
      <details className="field-panel-accordion">
        <summary className="fw-semibold">Pasangkan prediksi model / raster</summary>
        <form className="mt-3" onSubmit={(event) => void addPrediction(event)}>
          <fieldset disabled={busy || !rows.length}>
            <div className="row g-2">
              <label className="col-md-6 form-label">
                Pengukuran (halaman aktif)
                <select name="observation" className="form-select" required>
                  {rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.raw.plot_id} · {r.pool.toUpperCase()} · {r.raw.survey_date}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-md-6 form-label">
                ID model/dataset, versi dan periode
                <input
                  name="source"
                  className="form-control"
                  minLength={3}
                  maxLength={255}
                  required
                  placeholder="model_v1_2025"
                />
              </label>
              {[
                ["year", "Tahun prediksi", 1900, 2100],
                ["value", "Prediksi karbon (Mg C/ha)", 0, undefined],
                ["scale", "Resolusi sumber (m)", 0.001, undefined],
                ["top", "SOC: kedalaman atas (cm)", 0, undefined],
                ["bottom", "SOC: kedalaman bawah (cm)", 0.001, undefined],
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
                Dukungan spasial
                <select name="support" className="form-select">
                  <option value="plot_mean">Rerata raster dalam plot</option>
                  <option value="point_pixel">Satu piksel pada titik</option>
                </select>
              </label>
            </div>
            <p className="small text-muted mt-2">
              Masukkan densitas numerik raster asli, bukan nilai RGB atau total stok. Satu ID sumber
              harus mewakili versi, periode, dan metode sampling yang konsisten. Prediksi tidak
              menggantikan hasil pengukuran.
            </p>
            <button type="submit" className="btn btn-outline-primary">
              Simpan pasangan prediksi
            </button>
          </fieldset>
        </form>
      </details>
      <details className="field-panel-accordion">
        <summary className="fw-semibold">Validasi dan kalibrasi model</summary>
        <form className="mt-3" onSubmit={(event) => void evaluate(event)}>
          <fieldset disabled={busy || !(inventory?.total_records ?? total)}>
            <div className="row g-3">
              <label className="col-md-3 form-label">
                Pool
                <select
                  className="form-select"
                  value={pool}
                  onChange={(e) => setPool(e.target.value as Pool)}
                >
                  <option value="agb">AGB</option>
                  <option value="bgb">BGB</option>
                  <option value="soc">SOC</option>
                  <option value="litter">Litter / serasah</option>
                  <option value="deadwood">Deadwood / kayu mati</option>
                </select>
              </label>
              <label className="col-md-6 form-label">
                ID sumber prediksi
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
                Selisih tahun maksimum
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
                    SOC atas (cm)
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
                    SOC bawah (cm)
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
                Izinkan pasangan satu piksel titik (dukungan berbeda dari rerata plot)
              </span>
            </label>
            <button className="btn btn-primary mt-3" type="submit">
              {busy ? "Menghitung…" : "Hitung evaluasi dan kandidat kalibrasi"}
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
          Buka hasil evaluasi tersimpan (20 terbaru)
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
            <option value="">Pilih evaluasi…</option>
            {history.map((item) => (
              <option key={item.id} value={item.id}>
                {fieldPoolLabel(item.target_pool)} ·{" "}
                {new Date(item.created_at).toLocaleString("id-ID")} · {item.status}
              </option>
            ))}
          </select>
        </label>
      )}
      {assessment && (
        <div className="field-assessment-card">
          <div className="d-flex gap-3 flex-wrap justify-content-between">
            <h4 className="h6">
              Hasil evaluasi ·{" "}
              {fieldPoolLabel(
                assessment.metrics.configuration?.pool ?? assessment.target_pool ?? "",
              )}{" "}
              · {assessment.metrics.status === "computed" ? "Dihitung" : "Belum dapat dihitung"}
            </h4>
            <button
              className="btn btn-outline-secondary btn-sm"
              type="button"
              onClick={() => downloadJson(assessment, `field-assessment-${assessment.id}.json`)}
            >
              Unduh laporan JSON
            </button>
          </div>
          <p>
            {assessment.metrics.calibration_plots} plot kalibrasi ·{" "}
            {assessment.metrics.validation_plots} plot validasi terpisah ·{" "}
            {assessment.metrics.excluded.length} pengukuran dikecualikan
          </p>
          {assessment.metrics.configuration && (
            <p className="small text-muted">
              Sumber prediksi: {assessment.metrics.configuration.prediction_source}
            </p>
          )}
          <div className="field-calibration-table-wrap">
            <table className="tbl tbl-wide field-calibration-table field-calibration-table--metrics">
              <thead>
                <tr>
                  <AdminTableNumberHeader />
                  <th>Evaluasi</th>
                  <th>Plot</th>
                  <th>RMSE</th>
                  <th>MAE</th>
                  <th>Bias</th>
                  <th>R²</th>
                </tr>
              </thead>
              <tbody>
                <MetricRow
                  index={0}
                  label="Baseline pada kalibrasi"
                  metric={assessment.metrics.baseline_calibration}
                />
                <MetricRow
                  index={1}
                  label="Kalibrasi: leave-one-plot-out"
                  metric={assessment.metrics.cross_validation}
                />
                <MetricRow
                  index={2}
                  label="Baseline: validasi terpisah"
                  metric={assessment.metrics.baseline_validation}
                />
                <MetricRow
                  index={3}
                  label="Hasil kalibrasi: validasi terpisah"
                  metric={assessment.metrics.calibrated_validation}
                />
              </tbody>
            </table>
          </div>
          <p className="small">
            Galat dalam Mg C/ha; R² tanpa satuan. Tanda — berarti belum dapat dihitung.
          </p>
          {assessment.metrics.artifact && (
            <p>
              Kandidat: C terkalibrasi ={" "}
              {assessment.metrics.artifact.clip_min === 0 ? "maks(0, " : ""}
              {fmt(assessment.metrics.artifact.intercept)} +{" "}
              {fmt(assessment.metrics.artifact.slope)} × prediksi sumber
              {assessment.metrics.artifact.clip_min === 0 ? ")" : ""}. Disimpan sebagai model
              eksperimental lokal; belum diaktifkan.
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
              <summary>Alasan pasangan tidak digunakan</summary>
              <ul>
                {assessment.metrics.excluded.map((r) => (
                  <li key={r.id}>
                    {r.plot_id}: {FIELD_EXCLUSION_LABELS[r.reason] ?? r.reason}
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
