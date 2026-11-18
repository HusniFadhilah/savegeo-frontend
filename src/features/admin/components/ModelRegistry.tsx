import { AdminTableNumberCell, AdminTableNumberHeader } from "@/features/admin/components/AdminTableNumber";
import { useRef, useState } from "react";
import { activateModel, deleteModel, evaluateModel, getModelLifecycle, requestModelReview, reviewModel, setDefaultModel, uploadModel } from "../api";
import type { MlModel, ModelEvaluationResult } from "../types";
import { useAdmin } from "../AdminContext";
import { useServerTable } from "@/hooks/useServerTable";
import TablePagination from "@/components/ui/TablePagination";
import { useI18nStore } from "@/hooks/useI18nStore";
import BulkTableToolbar from "./BulkTableToolbar";

const ALGOS = ["Ridge", "Lasso", "Linear", "ElasticNet", "RandomForest", "XGBoost"];
const TYPES = ["carbon", "vegetation", "landcover"];
const ALLOWED_EXT = [".onnx"];
const MAX_FILE_BYTES = 128 * 1024 * 1024;

function formatAlgorithmName(algo?: string | null): string {
  if (!algo) return "—";
  const map: Record<string, string> = {
    random_forest: "Random Forest",
    ridge: "Ridge",
    lasso: "Lasso",
    linear: "Linear",
    elasticnet: "ElasticNet",
    xgboost: "XGBoost",
  };
  const key = String(algo).trim().toLowerCase();
  if (map[key]) return map[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ModelStatusBadges({ m }: { m: MlModel }) {
  const t = useI18nStore((state) => state.t);
  const colors: Record<MlModel["lifecycle_state"], string> = {
    experimental: "badge-gray", training: "badge-blue", evaluated: "badge-blue",
    review_pending: "badge-amber", approved: "badge-green", active: "badge-green",
    rejected: "badge-red", archived: "badge-gray",
  };
  const labels: Record<MlModel["lifecycle_state"], string> = {
    experimental: "Eksperimental", training: "Training", evaluated: "Dievaluasi",
    review_pending: "Menunggu review", approved: "Disetujui", active: "Aktif",
    rejected: "Ditolak", archived: "Diarsipkan",
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      <span className={`stat-badge ${colors[m.lifecycle_state] || "badge-gray"}`}>{labels[m.lifecycle_state] || m.lifecycle_state}</span>
      {m.is_default && <span className="stat-badge badge-blue">{t("admin.default")}</span>}
      {m.is_legacy && <span className="stat-badge badge-amber">{t("admin.legacy")}</span>}
    </div>
  );
}

export default function ModelRegistry() {
  const { notify } = useAdmin();
  const t = useI18nStore((state) => state.t);
  const {
    rows, loading, error, page, pageCount, pageSize,
    recordsTotal, recordsFiltered, search, setSearch,
    nextPage, prevPage, reload,
  } = useServerTable<MlModel>("/admin/models");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [dispName, setDispName] = useState("");
  const [modelType, setModelType] = useState(TYPES[0]);
  const [algo, setAlgo] = useState(ALGOS[0]);
  const [version, setVersion] = useState("");
  const [featureNamesRaw, setFeatureNamesRaw] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [evaluatingModel, setEvaluatingModel] = useState<MlModel | null>(null);
  const [evaluationFile, setEvaluationFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [datasetSource, setDatasetSource] = useState("");
  const [targetColumn, setTargetColumn] = useState("observed");
  const [targetUnit, setTargetUnit] = useState("Mg C/ha");
  const [groupColumn, setGroupColumn] = useState("group_id");
  const [trainingGroupsRaw, setTrainingGroupsRaw] = useState("");
  const [splitMethod, setSplitMethod] = useState("spatial_holdout");
  const [evaluationBusy, setEvaluationBusy] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<ModelEvaluationResult | null>(null);
  const [lifecycleDetail, setLifecycleDetail] = useState<Awaited<ReturnType<typeof getModelLifecycle>> | null>(null);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);

  const validateFile = (f: File): string | null => {
    const lower = f.name.toLowerCase();
    if (!ALLOWED_EXT.some((ext) => lower.endsWith(ext))) {
      return `Ekstensi file tidak didukung (harus salah satu: ${ALLOWED_EXT.join(", ")})`;
    }
    if (f.size > MAX_FILE_BYTES) return "Ukuran file terlalu besar (maks 128 MiB)";
    return null;
  };

  const pickFile = (f: File | null) => {
    if (!f) return;
    const err = validateFile(f);
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setFile(f);
  };

  const handleUpload = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError(t("admin.models.nameRequired"));
      return;
    }
    if (!file) {
      setFormError(t("admin.models.fileRequired"));
      return;
    }
    const featureNames = featureNamesRaw.split(/[\r\n,]+/).map((value) => value.trim()).filter(Boolean);
    if (!featureNames.length || new Set(featureNames).size !== featureNames.length) {
      setFormError("Daftarkan nama fitur ONNX sesuai urutan input model; setiap nama harus unik.");
      return;
    }
    setUploading(true);
    setFormError(null);
    try {
      await uploadModel({
        file,
        name: trimmedName,
        display_name: dispName || trimmedName,
        model_type: modelType,
        algorithm: algo,
        version,
        featureNames,
      });
      notify(t("admin.models.uploaded"), "s");
      setFormOpen(false);
      setFile(null);
      setName("");
      setVersion("");
      setFeatureNamesRaw("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("admin.models.uploadFailed");
      setFormError(msg);
      notify(msg, "e");
    } finally {
      setUploading(false);
    }
  };

  const doSetDefault = async (id: number) => {
    setBusyId(id);
    try {
      await setDefaultModel(id);
      notify(t("admin.models.defaultUpdated"), "s");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal", "e");
    } finally {
      setBusyId(null);
    }
  };

  const doActivate = async (id: number) => {
    setBusyId(id);
    try {
      await activateModel(id);
      notify("Model disetujui dan diaktifkan", "s");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal", "e");
    } finally {
      setBusyId(null);
    }
  };

  const doRequestReview = async (id: number) => {
    setBusyId(id);
    try {
      await requestModelReview(id);
      notify("Model diajukan untuk review independen", "s");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal mengajukan review", "e");
    } finally {
      setBusyId(null);
    }
  };

  const doReview = async (id: number, decision: "approved" | "rejected") => {
    const reason = window.prompt(decision === "approved" ? "Catatan review dan batas penggunaan:" : "Alasan penolakan:");
    if (!reason || reason.trim().length < 10) return;
    setBusyId(id);
    try {
      await reviewModel(id, decision, reason.trim());
      notify(decision === "approved" ? "Review disetujui" : "Review ditolak", "s");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal menyimpan review", "e");
    } finally {
      setBusyId(null);
    }
  };

  const handleEvaluate = async () => {
    if (!evaluatingModel || !evaluationFile || !datasetName.trim()) return;
    const trainingGroups = trainingGroupsRaw.split(/[\r\n,]+/).map((value) => value.trim()).filter(Boolean);
    setEvaluationBusy(true);
    try {
      const result = await evaluateModel(evaluatingModel.id, {
        file: evaluationFile,
        datasetName: datasetName.trim(),
        datasetSource: datasetSource.trim() || undefined,
        targetColumn: targetColumn.trim(),
        targetUnit: targetUnit.trim(),
        groupColumn: groupColumn.trim(),
        trainingGroups,
        splitMethod,
      });
      setEvaluationResult(result);
      setEvaluatingModel(null);
      setEvaluationFile(null);
      setDatasetName("");
      setTrainingGroupsRaw("");
      notify("Evaluasi dihitung dari data uji oleh server", "s");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Evaluasi model gagal", "e");
    } finally {
      setEvaluationBusy(false);
    }
  };

  const showLifecycle = async (id: number) => {
    setLifecycleBusy(true);
    try {
      setLifecycleDetail(await getModelLifecycle(id));
    } catch (err) {
      notify(err instanceof Error ? err.message : "Riwayat model gagal dimuat", "e");
    } finally {
      setLifecycleBusy(false);
    }
  };

  const doDelete = async (id: number) => {
    if (!confirm("Arsipkan model ini? Artefak dan riwayat review akan tetap disimpan.")) return;
    setBusyId(id);
    try {
      await deleteModel(id);
      notify("Model diarsipkan; artefak dan histori review disimpan", "s");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal", "e");
    } finally {
      setBusyId(null);
    }
  };

  const allPageSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  const toggleSelected = (id: number) => setSelectedIds((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));
  const toggleAllPage = () => setSelectedIds((ids) => (allPageSelected ? ids.filter((id) => !rows.some((row) => row.id === id)) : Array.from(new Set([...ids, ...rows.map((row) => row.id)]))));
  const handleBulkDelete = async () => {
    if (!selectedIds.length || !confirm(`Arsipkan ${selectedIds.length} model terpilih?`)) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(selectedIds.map((id) => deleteModel(id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    setSelectedIds([]);
    notify(failed ? `${results.length - failed} model dihapus, ${failed} gagal` : `${results.length} model dihapus`, failed ? "e" : "s");
    await reload();
    setBulkBusy(false);
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>{t("admin.models.title")}</span>
        <button type="button" className="btn-sm primary" onClick={() => setFormOpen((o) => !o)}>
          <i className="bi bi-plus-lg" /> {t("admin.models.upload")}
        </button>
      </div>
      <div className="card-body-custom">
        <div className={`collapse-form ${formOpen ? "open" : ""}`}>
          <div className="three-col" style={{ marginBottom: "0.5rem" }}>
            <div className="form-field">
              <label className="form-label">Nama (slug) *</label>
              <input className="form-input" placeholder="carbon_ridge_v3" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Nama tampilan</label>
              <input className="form-input" placeholder="Carbon Ridge v3" value={dispName} onChange={(e) => setDispName(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Tipe *</label>
              <select className="form-select" value={modelType} onChange={(e) => setModelType(e.target.value)}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Algoritma</label>
              <select className="form-select" value={algo} onChange={(e) => setAlgo(e.target.value)}>
                {ALGOS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Versi</label>
              <input className="form-input" placeholder="1.0.0" value={version} onChange={(e) => setVersion(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Fitur input ONNX (urut, pisahkan koma)</label>
              <input
                className="form-input"
                placeholder="NDVI, EVI, elevation"
                value={featureNamesRaw}
                onChange={(e) => setFeatureNamesRaw(e.target.value)}
              />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">File model ONNX (.onnx)</label>
            <div
              className={`upload-zone ${dragOver ? "dragover" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files[0] ?? null);
              }}
            >
              <i className="bi bi-box-seam" style={{ fontSize: 20, color: "#94a3b8", marginBottom: 6, display: "block" }} />
              <div style={{ fontSize: 12, color: "#64748b" }}>Pilih file atau seret dan letakkan file model</div>
              {file && (
                <div style={{ fontSize: 11, color: "#3b82f6", marginTop: 4 }}>
                  ✓ {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_EXT.join(",")}
              style={{ display: "none" }}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="alert alert-info py-2 small">Unggahan masuk status eksperimental. Nilai metrik tidak diisi manual; server akan menghitungnya dari data uji sebelum model dapat direview.</div>
          {formError && <div className="alert alert-danger py-1 px-2 small">{formError}</div>}
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn-sm primary" disabled={uploading} onClick={handleUpload}>
              <i className="bi bi-upload" /> {uploading ? "Mengunggah..." : "Unggah"}
            </button>
            <button type="button" className="btn-sm" onClick={() => setFormOpen(false)}>
              Batal
            </button>
          </div>
        </div>

        {evaluatingModel && (
          <div className="card" style={{ margin: "0.75rem 0", border: "1px solid var(--border-color, #dbe2ea)" }}>
            <div className="card-header-custom">
              <span>Evaluasi holdout · {evaluatingModel.display_name || evaluatingModel.name}</span>
              <button type="button" className="btn-sm" disabled={evaluationBusy} onClick={() => setEvaluatingModel(null)}>Tutup</button>
            </div>
            <div className="card-body-custom">
              <div className="alert alert-warning py-2 small">Metrik dihitung dari prediksi model dan target pada CSV yang diunggah. ID grup pelatihan serta asal dataset merupakan deklarasi pengunggah; belum diverifikasi secara independen dan bukan validasi lapangan tersertifikasi.</div>
              <div className="three-col" style={{ marginBottom: "0.75rem" }}>
                <div className="form-field"><label className="form-label">Nama dataset</label><input className="form-input" value={datasetName} onChange={(event) => setDatasetName(event.target.value)} /></div>
                <div className="form-field"><label className="form-label">Sumber / referensi dataset</label><input className="form-input" value={datasetSource} onChange={(event) => setDatasetSource(event.target.value)} /></div>
                <div className="form-field"><label className="form-label">Metode pemisahan</label><select className="form-select" value={splitMethod} onChange={(event) => setSplitMethod(event.target.value)}><option value="spatial_holdout">Spatial holdout</option><option value="temporal_holdout">Temporal holdout</option><option value="grouped_holdout">Group holdout</option><option value="independent_dataset">Dataset independen</option></select></div>
                <div className="form-field"><label className="form-label">Kolom target</label><input className="form-input" value={targetColumn} onChange={(event) => setTargetColumn(event.target.value)} /></div>
                <div className="form-field"><label className="form-label">Satuan target</label><input className="form-input" value={targetUnit} onChange={(event) => setTargetUnit(event.target.value)} /></div>
                <div className="form-field"><label className="form-label">Kolom ID grup independen</label><input className="form-input" value={groupColumn} onChange={(event) => setGroupColumn(event.target.value)} /></div>
              </div>
              <div className="form-field"><label className="form-label">ID grup pada data pelatihan (pisahkan baris/koma)</label><textarea className="form-input" rows={3} value={trainingGroupsRaw} onChange={(event) => setTrainingGroupsRaw(event.target.value)} placeholder="plot-001, plot-002, site-a" /></div>
              <div className="form-field"><label className="form-label">CSV holdout · fitur + target + ID grup</label><input className="form-input" type="file" accept=".csv,text/csv" onChange={(event) => setEvaluationFile(event.target.files?.[0] ?? null)} /></div>
              <button type="button" className="btn-sm primary" disabled={evaluationBusy || !evaluationFile || !datasetName.trim()} onClick={handleEvaluate}>{evaluationBusy ? "Menghitung..." : "Hitung evaluasi"}</button>
            </div>
          </div>
        )}
        {evaluationResult && (
          <div className="alert alert-success py-2 small" role="status">
            Evaluasi tersimpan · n={evaluationResult.metrics.sample_count}, grup={evaluationResult.metrics.independent_group_count}, {evaluationResult.metrics.metric_type === "classification" ? `akurasi=${(evaluationResult.metrics.accuracy ?? 0).toFixed(3)}, balanced accuracy=${(evaluationResult.metrics.balanced_accuracy ?? 0).toFixed(3)}` : `R²=${evaluationResult.metrics.r2 == null ? "tidak terdefinisi" : evaluationResult.metrics.r2.toFixed(3)}, RMSE=${(evaluationResult.metrics.rmse ?? 0).toFixed(3)}, MAE=${(evaluationResult.metrics.mae ?? 0).toFixed(3)}`}
            <button type="button" className="btn-sm" style={{ marginLeft: 8 }} onClick={() => setEvaluationResult(null)}>Tutup</button>
          </div>
        )}
        {lifecycleDetail && (
          <div className="card" style={{ margin: "0.75rem 0", border: "1px solid var(--border-color, #dbe2ea)" }}>
            <div className="card-header-custom">
              <span>Evaluasi dan review · {lifecycleDetail.model.display_name || lifecycleDetail.model.name}</span>
              <button type="button" className="btn-sm" onClick={() => setLifecycleDetail(null)}>Tutup</button>
            </div>
            <div className="card-body-custom">
              {lifecycleDetail.model.metadata_json?.training_manifest != null && (
                <details className="border rounded p-2 mb-2">
                  <summary>Manifest training reproducible</summary>
                  <pre className="small mt-2 mb-0" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {JSON.stringify(lifecycleDetail.model.metadata_json.training_manifest, null, 2)}
                  </pre>
                  {typeof lifecycleDetail.model.metadata_json.mlflow === "object" && lifecycleDetail.model.metadata_json.mlflow && (
                    <div className="small mt-2">MLflow run: {String((lifecycleDetail.model.metadata_json.mlflow as Record<string, unknown>).run_id || "tercatat")}</div>
                  )}
                </details>
              )}
              {lifecycleDetail.evaluations.length === 0 ? <p className="small text-muted">Belum ada evaluasi.</p> : lifecycleDetail.evaluations.map((evaluation) => (
                <div key={evaluation.id} className="border rounded p-2 mb-2">
                  <strong>{evaluation.dataset_name}</strong> · {evaluation.metrics.sample_count} baris · {evaluation.metrics.independent_group_count} grup
                  <div>{evaluation.metrics.metric_type === "classification" ? `Accuracy: ${(evaluation.metrics.accuracy ?? 0).toFixed(3)} · balanced accuracy: ${(evaluation.metrics.balanced_accuracy ?? 0).toFixed(3)}` : `R²: ${evaluation.metrics.r2 == null ? "tidak terdefinisi" : evaluation.metrics.r2.toFixed(3)} · RMSE: ${(evaluation.metrics.rmse ?? 0).toFixed(3)} · MAE: ${(evaluation.metrics.mae ?? 0).toFixed(3)} · bias: ${(evaluation.metrics.bias_prediction_minus_observed ?? 0).toFixed(3)}`}</div>
                  <div className="small text-muted">Sumber: {evaluation.dataset_source || "tidak dicantumkan"} · metode: {String(evaluation.manifest.evaluation_method || evaluation.manifest.split_method || "—")} · provenance: {String(evaluation.manifest.source_data_kind || evaluation.manifest.provenance_status || "—")}</div>
                  <code className="small">SHA-256 data: {evaluation.dataset_sha256}</code>
                </div>
              ))}
              <h4>Catatan review</h4>
              {lifecycleDetail.reviews.length === 0 ? <p className="small text-muted">Belum ada keputusan review.</p> : lifecycleDetail.reviews.map((item) => (
                <div key={item.id} className="border rounded p-2 mb-2"><strong>{item.decision}</strong> · {new Date(item.created_at).toLocaleString("id-ID")}<div>{item.reason}</div></div>
              ))}
              <div className="small text-warning-emphasis">{lifecycleDetail.model.metadata_json?.format === "gee_saved_ensemble" ? "Label model ini berasal dari proxy raster dan evaluasi silang spasial; hasilnya bukan validasi lapangan. Reviewer perlu mempertimbangkan batas tersebut sebelum menyetujui aktivasi." : "Asal dataset dan daftar grup pelatihan merupakan deklarasi pengunggah/evaluator, belum diverifikasi secara independen."}</div>
            </div>
          </div>
        )}

        <BulkTableToolbar selectedCount={selectedIds.length} onClear={() => setSelectedIds([])}>
          <button type="button" className="btn-sm danger" disabled={bulkBusy} onClick={handleBulkDelete}>
            <i className="bi bi-trash" /> {bulkBusy ? "Menghapus..." : "Hapus terpilih"}
          </button>
        </BulkTableToolbar>

        <div style={{ overflowX: "auto" }}>
          <table className="tbl tbl-wide">
            <colgroup>
              <col className="admin-table-selection-col" />
              <col className="admin-table-number-col" />
              <col style={{ width: "24%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "28%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="admin-table-selection"><input className="admin-table-check" type="checkbox" aria-label="Pilih semua model di halaman" checked={allPageSelected} onChange={toggleAllPage} /></th>
                <AdminTableNumberHeader />
                <th>Model</th>
                <th>Tipe</th>
                <th>Algoritma</th>
                <th>Ukuran</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--danger-color, #e53935)", padding: "1.5rem" }}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    Belum ada model. Unggah model ML terlebih dahulu.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                rows.map((m, index) => {
                  const featureCount = m.feature_names?.length ?? 0;
                  const updatedAt = m.updated_at ? new Date(m.updated_at).toLocaleDateString("id-ID") : "—";
                  return (
                    <tr key={m.id}>
                      <td className="admin-table-selection"><input className="admin-table-check" type="checkbox" aria-label={`Pilih ${m.name}`} checked={selectedIds.includes(m.id)} onChange={() => toggleSelected(m.id)} /></td>
                      <AdminTableNumberCell index={index} page={page} pageSize={pageSize} />
                      <td>
                        <div style={{ fontWeight: 600 }}>{m.name || "—"}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {m.display_name || "—"} • v{m.version || "—"}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {featureCount} fitur • update {updatedAt}
                        </div>
                        {m.metadata_json?.format === "gee_saved_ensemble" && <div className="small text-warning">Evaluasi CV spasial memakai label proxy; bukan validasi lapangan.</div>}
                      </td>
                      <td>
                        <span className="stat-badge badge-blue">{m.model_type || "—"}</span>
                      </td>
                      <td>
                        <span className="stat-badge badge-gray">{formatAlgorithmName(m.algorithm)}</span>
                      </td>
                      <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {m.file_size_kb ? `${Number(m.file_size_kb).toFixed(1)} KB` : "—"}
                      </td>
                      <td>
                        <ModelStatusBadges m={m} />
                      </td>
                      <td>
                        {["experimental", "evaluated"].includes(m.lifecycle_state) && m.metadata_json?.format !== "gee_saved_ensemble" && (
                          <button type="button" className="btn-sm" disabled={busyId === m.id || bulkBusy} onClick={() => { setEvaluationResult(null); setEvaluatingModel(m); }}>
                            Evaluasi
                          </button>
                        )}
                        {m.lifecycle_state === "evaluated" && <button type="button" className="btn-sm" disabled={busyId === m.id || bulkBusy} onClick={() => doRequestReview(m.id)}>Ajukan review</button>}
                        {m.lifecycle_state === "review_pending" && <>
                          <button type="button" className="btn-sm primary" disabled={busyId === m.id || bulkBusy} onClick={() => doReview(m.id, "approved")}>Setujui</button>
                          <button type="button" className="btn-sm danger" disabled={busyId === m.id || bulkBusy} onClick={() => doReview(m.id, "rejected")}>Tolak</button>
                        </>}
                        {m.lifecycle_state === "approved" && <button type="button" className="btn-sm primary" disabled={busyId === m.id || bulkBusy} onClick={() => doActivate(m.id)}>Aktifkan</button>}
                        {m.lifecycle_state === "active" && !m.is_default && m.metadata_json?.format === "onnx" && <button type="button" className="btn-sm" disabled={busyId === m.id || bulkBusy} onClick={() => doSetDefault(m.id)}>Jadikan default</button>}
                        <button type="button" className="btn-sm" disabled={lifecycleBusy} onClick={() => showLifecycle(m.id)}>Riwayat</button>
                        <button
                          type="button"
                          className="btn-sm danger"
                          style={{ marginLeft: 3 }}
                          disabled={busyId === m.id || bulkBusy || m.lifecycle_state === "archived"}
                          onClick={() => doDelete(m.id)}
                        >
                          Arsipkan
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          pageCount={pageCount}
          recordsTotal={recordsTotal}
          recordsFiltered={recordsFiltered}
          pageSize={pageSize}
          search={search}
          onSearchChange={setSearch}
          onPrev={prevPage}
          onNext={nextPage}
          searchPlaceholder="Cari nama model, algoritma..."
        />
      </div>
    </div>
  );
}
