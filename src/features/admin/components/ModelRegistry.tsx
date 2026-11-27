import { AdminTableNumberCell, AdminTableNumberHeader } from "@/features/admin/components/AdminTableNumber";
import { useRef, useState } from "react";
import { activateModel, deleteModel, evaluateModel, getModelLifecycle, requestModelReview, reviewModel, setDefaultModel, uploadModel } from "../api";
import type { MlModel, ModelEvaluationResult } from "../types";
import { useAdmin } from "../AdminContext";
import { useServerTable } from "@/hooks/useServerTable";
import TablePagination from "@/components/ui/TablePagination";
import { useI18nStore } from "@/hooks/useI18nStore";
import { useBilingualCopy } from "@/hooks/useBilingualCopy";
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
  const c = useBilingualCopy();
  const colors: Record<MlModel["lifecycle_state"], string> = {
    experimental: "badge-gray", training: "badge-blue", evaluated: "badge-blue",
    review_pending: "badge-amber", approved: "badge-green", active: "badge-green",
    rejected: "badge-red", archived: "badge-gray", legacy_unmigrated: "badge-amber",
  };
  const labels: Record<MlModel["lifecycle_state"], string> = {
    experimental: c("Eksperimental", "Experimental"), training: c("Pelatihan", "Training"), evaluated: c("Dievaluasi", "Evaluated"),
    review_pending: c("Menunggu review", "Review pending"), approved: c("Disetujui", "Approved"), active: c("Aktif", "Active"),
    rejected: c("Ditolak", "Rejected"), archived: c("Diarsipkan", "Archived"), legacy_unmigrated: c("Legacy - siklus hidup belum dimigrasikan", "Legacy - lifecycle not migrated"),
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      <span className={`stat-badge ${colors[m.lifecycle_state] || "badge-gray"}`}>{labels[m.lifecycle_state] || m.lifecycle_state}</span>
      {m.lifecycle_state === "legacy_unmigrated" && m.is_active && <span className="stat-badge badge-green">{c("Aktif di server", "Active on server")}</span>}
      {m.is_default && <span className="stat-badge badge-blue">{t("admin.default")}</span>}
      {m.is_legacy && <span className="stat-badge badge-amber">{t("admin.legacy")}</span>}
    </div>
  );
}

export default function ModelRegistry() {
  const { notify } = useAdmin();
  const t = useI18nStore((state) => state.t);
  const c = useBilingualCopy();
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
      setFormError(c("Daftarkan nama fitur ONNX sesuai urutan input model; setiap nama harus unik.", "Enter ONNX feature names in model input order. Each name must be unique."));
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
      notify(err instanceof Error ? err.message : c("Gagal", "Failed"), "e");
    } finally {
      setBusyId(null);
    }
  };

  const doActivate = async (id: number) => {
    setBusyId(id);
    try {
      await activateModel(id);
      notify(c("Model disetujui dan diaktifkan", "Model approved and activated"), "s");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : c("Gagal", "Failed"), "e");
    } finally {
      setBusyId(null);
    }
  };

  const doRequestReview = async (id: number) => {
    setBusyId(id);
    try {
      await requestModelReview(id);
      notify(c("Model diajukan untuk review independen", "Model submitted for independent review"), "s");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : c("Gagal mengajukan review", "Could not submit the review request"), "e");
    } finally {
      setBusyId(null);
    }
  };

  const doReview = async (id: number, decision: "approved" | "rejected") => {
    const reason = window.prompt(decision === "approved" ? c("Catatan review dan batas penggunaan:", "Review notes and usage limits:") : c("Alasan penolakan:", "Reason for rejection:"));
    if (!reason || reason.trim().length < 10) return;
    setBusyId(id);
    try {
      await reviewModel(id, decision, reason.trim());
      notify(decision === "approved" ? c("Review disetujui", "Review approved") : c("Review ditolak", "Review rejected"), "s");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : c("Gagal menyimpan review", "Could not save the review"), "e");
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
      notify(c("Evaluasi dihitung dari data uji oleh server", "Evaluation was calculated by the server from the test data"), "s");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : c("Evaluasi model gagal", "Model evaluation failed"), "e");
    } finally {
      setEvaluationBusy(false);
    }
  };

  const showLifecycle = async (id: number) => {
    setLifecycleBusy(true);
    try {
      setLifecycleDetail(await getModelLifecycle(id));
    } catch (err) {
      notify(err instanceof Error ? err.message : c("Riwayat model gagal dimuat", "Could not load model history"), "e");
    } finally {
      setLifecycleBusy(false);
    }
  };

  const doDelete = async (id: number) => {
    if (!confirm(c("Arsipkan model ini? Artefak dan riwayat review akan tetap disimpan.", "Archive this model? Its artifact and review history will be retained."))) return;
    setBusyId(id);
    try {
      await deleteModel(id);
      notify(c("Model diarsipkan; artefak dan histori review disimpan", "Model archived; artifact and review history retained"), "s");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal", "e");
    } finally {
      setBusyId(null);
    }
  };

  const actionableRows = rows.filter((row) => row.lifecycle_state !== "legacy_unmigrated" && row.lifecycle_state !== "archived");
  const legacySchemaDetected = rows.some((model) => model.lifecycle_state === "legacy_unmigrated");
  const allPageSelected = actionableRows.length > 0 && actionableRows.every((row) => selectedIds.includes(row.id));
  const toggleSelected = (id: number) => setSelectedIds((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));
  const toggleAllPage = () => setSelectedIds((ids) => (allPageSelected ? ids.filter((id) => !actionableRows.some((row) => row.id === id)) : Array.from(new Set([...ids, ...actionableRows.map((row) => row.id)]))));
  const handleBulkDelete = async () => {
    if (!selectedIds.length || !confirm(c(`Arsipkan ${selectedIds.length} model terpilih?`, `Archive the ${selectedIds.length} selected models?`))) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(selectedIds.map((id) => deleteModel(id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    setSelectedIds([]);
    notify(failed ? c(`${results.length - failed} model dihapus, ${failed} gagal`, `${results.length - failed} models archived, ${failed} failed`) : c(`${results.length} model dihapus`, `${results.length} models archived`), failed ? "e" : "s");
    await reload();
    setBulkBusy(false);
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>{t("admin.models.title")}</span>
        <button type="button" className="btn-sm primary" disabled={legacySchemaDetected} onClick={() => setFormOpen((o) => !o)}>
          <i className="bi bi-plus-lg" /> {t("admin.models.upload")}
        </button>
      </div>
      <div className="card-body-custom">
        {legacySchemaDetected && (
          <div className="alert alert-warning py-2 px-3 small" role="status">
            {c("Skema katalog ini belum memiliki siklus review. Model lama ditampilkan apa adanya; tindakan siklus hidup dinonaktifkan sampai migrasi ditinjau dan diterapkan.", "This catalogue schema does not include a review lifecycle. Legacy models are shown as stored; lifecycle actions remain disabled until the migration is reviewed and applied.")}
          </div>
        )}
        <div className={`collapse-form ${formOpen ? "open" : ""}`}>
          <div className="three-col" style={{ marginBottom: "0.5rem" }}>
            <div className="form-field">
              <label className="form-label">{c("Nama (slug) *", "Name (slug) *")}</label>
              <input className="form-input" placeholder="carbon_ridge_v3" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">{c("Nama tampilan", "Display name")}</label>
              <input className="form-input" placeholder="Carbon Ridge v3" value={dispName} onChange={(e) => setDispName(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">{c("Tipe *", "Type *")}</label>
              <select className="form-select" value={modelType} onChange={(e) => setModelType(e.target.value)}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === "carbon" ? c("Karbon", "Carbon") : t === "vegetation" ? c("Vegetasi", "Vegetation") : c("Tutupan lahan", "Land cover")}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">{c("Algoritma", "Algorithm")}</label>
              <select className="form-select" value={algo} onChange={(e) => setAlgo(e.target.value)}>
                {ALGOS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">{c("Versi", "Version")}</label>
              <input className="form-input" placeholder="1.0.0" value={version} onChange={(e) => setVersion(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">{c("Fitur input ONNX (urut, pisahkan koma)", "ONNX input features (in order, comma-separated)")}</label>
              <input
                className="form-input"
                placeholder="NDVI, EVI, elevation"
                value={featureNamesRaw}
                onChange={(e) => setFeatureNamesRaw(e.target.value)}
              />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">{c("File model ONNX (.onnx)", "ONNX model file (.onnx)")}</label>
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
              <div style={{ fontSize: 12, color: "#64748b" }}>{c("Pilih file atau seret dan letakkan file model", "Choose a file or drag and drop the model file")}</div>
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
          <div className="alert alert-info py-2 small">{c("Unggahan masuk status eksperimental. Nilai metrik tidak diisi manual; server akan menghitungnya dari data uji sebelum model dapat direview.", "Uploads start in experimental status. Metrics are not entered manually; the server calculates them from test data before the model can be reviewed.")}</div>
          {formError && <div className="alert alert-danger py-1 px-2 small">{formError}</div>}
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn-sm primary" disabled={uploading} onClick={handleUpload}>
              <i className="bi bi-upload" /> {uploading ? c("Mengunggah...", "Uploading...") : c("Unggah", "Upload")}
            </button>
            <button type="button" className="btn-sm" onClick={() => setFormOpen(false)}>
              {c("Batal", "Cancel")}
            </button>
          </div>
        </div>

        {evaluatingModel && (
          <div className="card" style={{ margin: "0.75rem 0", border: "1px solid var(--border-color, #dbe2ea)" }}>
            <div className="card-header-custom">
              <span>{c("Evaluasi holdout ·", "Holdout evaluation ·")} {evaluatingModel.display_name || evaluatingModel.name}</span>
              <button type="button" className="btn-sm" disabled={evaluationBusy} onClick={() => setEvaluatingModel(null)}>{c("Tutup", "Close")}</button>
            </div>
            <div className="card-body-custom">
              <div className="alert alert-warning py-2 small">{c("Metrik dihitung dari prediksi model dan target pada CSV yang diunggah. ID grup pelatihan serta asal dataset merupakan deklarasi pengunggah; belum diverifikasi secara independen dan bukan validasi lapangan tersertifikasi.", "Metrics are calculated from model predictions and targets in the uploaded CSV. Training-group IDs and dataset provenance are declared by the uploader; they are not independently verified and do not constitute certified field validation.")}</div>
              <div className="three-col" style={{ marginBottom: "0.75rem" }}>
                <div className="form-field"><label className="form-label">{c("Nama dataset", "Dataset name")}</label><input className="form-input" value={datasetName} onChange={(event) => setDatasetName(event.target.value)} /></div>
                <div className="form-field"><label className="form-label">{c("Sumber / referensi dataset", "Dataset source / reference")}</label><input className="form-input" value={datasetSource} onChange={(event) => setDatasetSource(event.target.value)} /></div>
                <div className="form-field"><label className="form-label">{c("Metode pemisahan", "Holdout method")}</label><select className="form-select" value={splitMethod} onChange={(event) => setSplitMethod(event.target.value)}><option value="spatial_holdout">{c("Pemisahan spasial", "Spatial holdout")}</option><option value="temporal_holdout">{c("Pemisahan temporal", "Temporal holdout")}</option><option value="grouped_holdout">{c("Pemisahan berdasarkan grup", "Group holdout")}</option><option value="independent_dataset">{c("Dataset independen", "Independent dataset")}</option></select></div>
                <div className="form-field"><label className="form-label">{c("Kolom target", "Target column")}</label><input className="form-input" value={targetColumn} onChange={(event) => setTargetColumn(event.target.value)} /></div>
                <div className="form-field"><label className="form-label">{c("Satuan target", "Target unit")}</label><input className="form-input" value={targetUnit} onChange={(event) => setTargetUnit(event.target.value)} /></div>
                <div className="form-field"><label className="form-label">{c("Kolom ID grup independen", "Independent-group ID column")}</label><input className="form-input" value={groupColumn} onChange={(event) => setGroupColumn(event.target.value)} /></div>
              </div>
              <div className="form-field"><label className="form-label">{c("ID grup pada data pelatihan (pisahkan baris/koma)", "Training data group IDs (separate with new lines or commas)")}</label><textarea className="form-input" rows={3} value={trainingGroupsRaw} onChange={(event) => setTrainingGroupsRaw(event.target.value)} placeholder="plot-001, plot-002, site-a" /></div>
              <div className="form-field"><label className="form-label">{c("CSV holdout · fitur + target + ID grup", "Holdout CSV · features + target + group ID")}</label><input className="form-input" type="file" accept=".csv,text/csv" onChange={(event) => setEvaluationFile(event.target.files?.[0] ?? null)} /></div>
              <button type="button" className="btn-sm primary" disabled={evaluationBusy || !evaluationFile || !datasetName.trim()} onClick={handleEvaluate}>{evaluationBusy ? c("Menghitung...", "Calculating...") : c("Hitung evaluasi", "Run evaluation")}</button>
            </div>
          </div>
        )}
        {evaluationResult && (
          <div className="alert alert-success py-2 small" role="status">
            {c("Evaluasi tersimpan", "Evaluation saved")} · n={evaluationResult.metrics.sample_count}, {c("grup", "groups")}={evaluationResult.metrics.independent_group_count}, {evaluationResult.metrics.metric_type === "classification" ? `${c("akurasi", "accuracy")}=${(evaluationResult.metrics.accuracy ?? 0).toFixed(3)}, ${c("akurasi seimbang", "balanced accuracy")}=${(evaluationResult.metrics.balanced_accuracy ?? 0).toFixed(3)}` : `R²=${evaluationResult.metrics.r2 == null ? c("tidak terdefinisi", "undefined") : evaluationResult.metrics.r2.toFixed(3)}, RMSE=${(evaluationResult.metrics.rmse ?? 0).toFixed(3)}, MAE=${(evaluationResult.metrics.mae ?? 0).toFixed(3)}`}
            <button type="button" className="btn-sm" style={{ marginLeft: 8 }} onClick={() => setEvaluationResult(null)}>{c("Tutup", "Close")}</button>
          </div>
        )}
        {lifecycleDetail && (
          <div className="card" style={{ margin: "0.75rem 0", border: "1px solid var(--border-color, #dbe2ea)" }}>
            <div className="card-header-custom">
              <span>{c("Evaluasi dan review ·", "Evaluation and review ·")} {lifecycleDetail.model.display_name || lifecycleDetail.model.name}</span>
              <button type="button" className="btn-sm" onClick={() => setLifecycleDetail(null)}>{c("Tutup", "Close")}</button>
            </div>
            <div className="card-body-custom">
              {lifecycleDetail.model.metadata_json?.training_manifest != null && (
                <details className="border rounded p-2 mb-2">
                  <summary>{c("Manifest pelatihan yang dapat direproduksi", "Reproducible training manifest")}</summary>
                  <pre className="small mt-2 mb-0" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {JSON.stringify(lifecycleDetail.model.metadata_json.training_manifest, null, 2)}
                  </pre>
                  {typeof lifecycleDetail.model.metadata_json.mlflow === "object" && lifecycleDetail.model.metadata_json.mlflow && (
                    <div className="small mt-2">MLflow {c("run", "run")}: {String((lifecycleDetail.model.metadata_json.mlflow as Record<string, unknown>).run_id || c("tercatat", "recorded"))}</div>
                  )}
                </details>
              )}
              {lifecycleDetail.evaluations.length === 0 ? <p className="small text-muted">{c("Belum ada evaluasi.", "No evaluations yet.")}</p> : lifecycleDetail.evaluations.map((evaluation) => (
                <div key={evaluation.id} className="border rounded p-2 mb-2">
                  <strong>{evaluation.dataset_name}</strong> · {evaluation.metrics.sample_count} {c("baris", "rows")} · {evaluation.metrics.independent_group_count} {c("grup", "groups")}
                  <div>{evaluation.metrics.metric_type === "classification" ? `Accuracy: ${(evaluation.metrics.accuracy ?? 0).toFixed(3)} · balanced accuracy: ${(evaluation.metrics.balanced_accuracy ?? 0).toFixed(3)}` : `R²: ${evaluation.metrics.r2 == null ? "tidak terdefinisi" : evaluation.metrics.r2.toFixed(3)} · RMSE: ${(evaluation.metrics.rmse ?? 0).toFixed(3)} · MAE: ${(evaluation.metrics.mae ?? 0).toFixed(3)} · bias: ${(evaluation.metrics.bias_prediction_minus_observed ?? 0).toFixed(3)}`}</div>
                  <div className="small text-muted">{c("Sumber:", "Source:")} {evaluation.dataset_source || c("tidak dicantumkan", "not provided")} · {c("metode:", "method:")} {String(evaluation.manifest.evaluation_method || evaluation.manifest.split_method || "—")} · provenance: {String(evaluation.manifest.source_data_kind || evaluation.manifest.provenance_status || "—")}</div>
                  <code className="small">SHA-256 data: {evaluation.dataset_sha256}</code>
                </div>
              ))}
              <h4>{c("Catatan review", "Review notes")}</h4>
              {lifecycleDetail.reviews.length === 0 ? <p className="small text-muted">{c("Belum ada keputusan review.", "No review decisions yet.")}</p> : lifecycleDetail.reviews.map((item) => (
                <div key={item.id} className="border rounded p-2 mb-2"><strong>{item.decision}</strong> · {new Date(item.created_at).toLocaleString("id-ID")}<div>{item.reason}</div></div>
              ))}
              <div className="small text-warning-emphasis">{lifecycleDetail.model.metadata_json?.format === "gee_saved_ensemble" ? c("Label model ini berasal dari proxy raster dan evaluasi silang spasial; hasilnya bukan validasi lapangan. Reviewer perlu mempertimbangkan batas tersebut sebelum menyetujui aktivasi.", "This model is labelled using raster proxies and spatial cross-validation; it has not undergone field validation. Reviewers should account for this limitation before approving activation.") : c("Asal dataset dan daftar grup pelatihan merupakan deklarasi pengunggah/evaluator, belum diverifikasi secara independen.", "Dataset provenance and training-group lists are declared by the uploader/evaluator and have not been independently verified.")}</div>
            </div>
          </div>
        )}

        <BulkTableToolbar selectedCount={selectedIds.length} onClear={() => setSelectedIds([])}>
          <button type="button" className="btn-sm danger" disabled={bulkBusy} onClick={handleBulkDelete}>
            <i className="bi bi-trash" /> {bulkBusy ? c("Mengarsipkan...", "Archiving...") : c("Arsipkan terpilih", "Archive selected")}
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
                <th className="admin-table-selection"><input className="admin-table-check" type="checkbox" aria-label={c("Pilih semua model di halaman", "Select all models on this page")} checked={allPageSelected} disabled={actionableRows.length === 0} onChange={toggleAllPage} /></th>
                <AdminTableNumberHeader />
                <th>{c("Model", "Model")}</th>
                <th>{c("Tipe", "Type")}</th>
                <th>{c("Algoritma", "Algorithm")}</th>
                <th>{c("Ukuran", "Size")}</th>
                <th>{c("Status", "Status")}</th>
                <th>{c("Aksi", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    {c("Memuat...", "Loading...")}
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
                    {c("Belum ada model. Unggah model ML terlebih dahulu.", "No models yet. Upload a machine-learning model to get started.")}
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                rows.map((m, index) => {
                  const featureCount = m.feature_names?.length ?? 0;
                  const updatedAt = m.updated_at ? new Date(m.updated_at).toLocaleDateString("id-ID") : "—";
                  const lifecycleUnavailable = m.lifecycle_state === "legacy_unmigrated";
                  return (
                    <tr key={m.id}>
                      <td className="admin-table-selection"><input className="admin-table-check" type="checkbox" aria-label={`Pilih ${m.name}`} checked={selectedIds.includes(m.id)} disabled={lifecycleUnavailable || m.lifecycle_state === "archived"} onChange={() => toggleSelected(m.id)} /></td>
                      <AdminTableNumberCell index={index} page={page} pageSize={pageSize} />
                      <td>
                        <div style={{ fontWeight: 600 }}>{m.name || "—"}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {m.display_name || "—"} • v{m.version || "—"}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {featureCount} {c("fitur", "features")} • {c("diperbarui", "updated")} {updatedAt}
                        </div>
                        {m.metadata_json?.format === "gee_saved_ensemble" && <div className="small text-warning">{c("Evaluasi CV spasial memakai label proxy; bukan validasi lapangan.", "Spatial cross-validation uses proxy labels; it is not field validation.")}</div>}
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
                            {c("Evaluasi", "Evaluate")}
                          </button>
                        )}
                        {m.lifecycle_state === "evaluated" && <button type="button" className="btn-sm" disabled={busyId === m.id || bulkBusy} onClick={() => doRequestReview(m.id)}>{c("Ajukan review", "Request review")}</button>}
                        {m.lifecycle_state === "review_pending" && <>
                          <button type="button" className="btn-sm primary" disabled={busyId === m.id || bulkBusy} onClick={() => doReview(m.id, "approved")}>{c("Setujui", "Approve")}</button>
                          <button type="button" className="btn-sm danger" disabled={busyId === m.id || bulkBusy} onClick={() => doReview(m.id, "rejected")}>{c("Tolak", "Reject")}</button>
                        </>}
                        {m.lifecycle_state === "approved" && <button type="button" className="btn-sm primary" disabled={busyId === m.id || bulkBusy} onClick={() => doActivate(m.id)}>{c("Aktifkan", "Activate")}</button>}
                        {m.lifecycle_state === "active" && !m.is_default && m.metadata_json?.format === "onnx" && <button type="button" className="btn-sm" disabled={busyId === m.id || bulkBusy} onClick={() => doSetDefault(m.id)}>{c("Jadikan default", "Set as default")}</button>}
                        {!lifecycleUnavailable && <button type="button" className="btn-sm" disabled={lifecycleBusy} onClick={() => showLifecycle(m.id)}>{c("Riwayat", "History")}</button>}
                        <button
                          type="button"
                          className="btn-sm danger"
                          style={{ marginLeft: 3 }}
                          disabled={lifecycleUnavailable || busyId === m.id || bulkBusy || m.lifecycle_state === "archived"}
                          onClick={() => doDelete(m.id)}
                        >
                          {c("Arsipkan", "Archive")}
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
          searchPlaceholder={c("Cari nama model, algoritma...", "Search model name or algorithm...")}
        />
      </div>
    </div>
  );
}
