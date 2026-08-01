import { useEffect, useRef, useState } from "react";
import { deleteModel, listModels, setDefaultModel, toggleModelActive, uploadModel } from "../api";
import type { MlModel } from "../types";
import { useAdmin } from "../AdminContext";

const ALGOS = ["Ridge", "Lasso", "Linear", "ElasticNet", "RandomForest", "XGBoost"];
const TYPES = ["carbon", "vegetation", "landcover"];
const ALLOWED_EXT = [".pkl", ".joblib", ".h5", ".pt", ".pth", ".onnx", ".bin"];
const MAX_FILE_BYTES = 300 * 1024 * 1024; // 300 MB

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

function ModelMetricSummary({ m }: { m: MlModel }) {
  const metrics = m.metrics || {};
  const train = metrics.train_metrics || (m.metadata_json?.train_metrics as { r2?: number; rmse?: number }) || {};
  const cv = metrics.cv_metrics || (m.metadata_json?.cv_metrics as { r2_mean?: number; rmse_mean?: number }) || {};
  const trainR2 = train.r2 !== undefined ? Number(train.r2).toFixed(3) : "—";
  const trainRMSE = train.rmse !== undefined ? Number(train.rmse).toFixed(2) : "—";
  const cvR2 = cv.r2_mean !== undefined ? Number(cv.r2_mean).toFixed(3) : "—";
  const cvRMSE = cv.rmse_mean !== undefined ? Number(cv.rmse_mean).toFixed(2) : "—";
  return (
    <div className="tbl-mono" style={{ lineHeight: 1.4 }}>
      <div>
        <strong>Train</strong> R² {trainR2}
      </div>
      <div>
        <strong>Train</strong> RMSE {trainRMSE}
      </div>
      <div>
        <strong>CV</strong> R² {cvR2}
      </div>
      <div>
        <strong>CV</strong> RMSE {cvRMSE}
      </div>
    </div>
  );
}

function ModelStatusBadges({ m }: { m: MlModel }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      <span className={`stat-badge ${m.is_active ? "badge-green" : "badge-gray"}`}>
        {m.is_active ? "Aktif" : "Nonaktif"}
      </span>
      {m.is_default && <span className="stat-badge badge-blue">Default</span>}
      {m.is_legacy && <span className="stat-badge badge-amber">Legacy</span>}
    </div>
  );
}

export default function ModelRegistry() {
  const { notify } = useAdmin();
  const [rows, setRows] = useState<MlModel[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [dispName, setDispName] = useState("");
  const [modelType, setModelType] = useState(TYPES[0]);
  const [algo, setAlgo] = useState(ALGOS[0]);
  const [version, setVersion] = useState("");
  const [metricsRaw, setMetricsRaw] = useState("");
  const [setDefault, setSetDefault] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await listModels();
      setRows(r.models || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat models");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const validateFile = (f: File): string | null => {
    const lower = f.name.toLowerCase();
    if (!ALLOWED_EXT.some((ext) => lower.endsWith(ext))) {
      return `Ekstensi file tidak didukung (harus salah satu: ${ALLOWED_EXT.join(", ")})`;
    }
    if (f.size > MAX_FILE_BYTES) return "Ukuran file terlalu besar (maks 300 MB)";
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
      setFormError("Name wajib diisi");
      return;
    }
    if (!file) {
      setFormError("Pilih file model");
      return;
    }
    let metrics: string | undefined;
    const rawTrim = metricsRaw.trim();
    if (rawTrim) {
      try {
        JSON.parse(rawTrim);
        metrics = rawTrim;
      } catch {
        setFormError("Format metrics tidak valid (harus JSON)");
        return;
      }
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
        set_default: setDefault,
        metrics,
      });
      notify("Model berhasil diupload", "s");
      setFormOpen(false);
      setFile(null);
      setName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal upload";
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
      notify("Default model diperbarui", "s");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal", "e");
    } finally {
      setBusyId(null);
    }
  };

  const doToggleActive = async (id: number, current: boolean) => {
    setBusyId(id);
    try {
      await toggleModelActive(id, current);
      notify("Status model diperbarui", "s");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal", "e");
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async (id: number) => {
    if (!confirm("Hapus model ini? File juga akan dihapus.")) return;
    setBusyId(id);
    try {
      await deleteModel(id);
      notify("Model dihapus", "s");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal", "e");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>ML Models tersimpan</span>
        <button type="button" className="btn-sm primary" onClick={() => setFormOpen((o) => !o)}>
          <i className="bi bi-plus-lg" /> Upload model
        </button>
      </div>
      <div className="card-body-custom">
        <div className={`collapse-form ${formOpen ? "open" : ""}`}>
          <div className="three-col" style={{ marginBottom: "0.5rem" }}>
            <div className="form-field">
              <label className="form-label">Name (slug) *</label>
              <input className="form-input" placeholder="carbon_ridge_v3" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Display name</label>
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
              <label className="form-label">Metrics JSON</label>
              <input
                className="form-input"
                placeholder='{"r2":0.85,"rmse":19.2}'
                value={metricsRaw}
                onChange={(e) => setMetricsRaw(e.target.value)}
              />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">File model (.pkl, .joblib, .h5, .onnx, .pt)</label>
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
              <div style={{ fontSize: 12, color: "#64748b" }}>Klik atau drag &amp; drop file model</div>
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
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "0.75rem" }}>
            <input type="checkbox" id="ml-setdef" checked={setDefault} onChange={(e) => setSetDefault(e.target.checked)} />
            <label htmlFor="ml-setdef" style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Jadikan default untuk tipe ini
            </label>
          </div>
          {formError && <div className="alert alert-danger py-1 px-2 small">{formError}</div>}
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn-sm primary" disabled={uploading} onClick={handleUpload}>
              <i className="bi bi-upload" /> {uploading ? "Mengupload..." : "Upload"}
            </button>
            <button type="button" className="btn-sm" onClick={() => setFormOpen(false)}>
              Batal
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <colgroup>
              <col style={{ width: "20%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "28%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Model</th>
                <th>Tipe</th>
                <th>Algoritma</th>
                <th>Metrik</th>
                <th>Ukuran</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--danger-color, #e53935)", padding: "1.5rem" }}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && rows && rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    Belum ada model. Upload model ML terlebih dahulu.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                rows?.map((m) => {
                  const featureCount = m.metrics?.n_features ?? (m.metadata_json?.n_features as number) ?? m.feature_names?.length ?? 0;
                  const sampleCount = m.metrics?.n_samples ?? (m.metadata_json?.n_samples as number) ?? "—";
                  const updatedAt = m.updated_at ? new Date(m.updated_at).toLocaleDateString("id-ID") : "—";
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{m.name || "—"}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {m.display_name || "—"} • v{m.version || "—"}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {featureCount} fitur • {sampleCount} sampel • update {updatedAt}
                        </div>
                      </td>
                      <td>
                        <span className="stat-badge badge-blue">{m.model_type || "—"}</span>
                      </td>
                      <td>
                        <span className="stat-badge badge-gray">{formatAlgorithmName(m.algorithm)}</span>
                      </td>
                      <td>
                        <ModelMetricSummary m={m} />
                      </td>
                      <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {m.file_size_kb ? `${Number(m.file_size_kb).toFixed(1)} KB` : "—"}
                      </td>
                      <td>
                        <ModelStatusBadges m={m} />
                      </td>
                      <td>
                        {!m.is_default && (
                          <button type="button" className="btn-sm" disabled={busyId === m.id} onClick={() => doSetDefault(m.id)}>
                            Set default
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-sm"
                          disabled={busyId === m.id}
                          onClick={() => doToggleActive(m.id, m.is_active)}
                        >
                          {m.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          type="button"
                          className="btn-sm danger"
                          style={{ marginLeft: 3 }}
                          disabled={busyId === m.id}
                          onClick={() => doDelete(m.id)}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
