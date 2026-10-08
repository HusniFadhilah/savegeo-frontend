import { useEffect, useState } from "react";
import { hasAdminPermission } from "@/auth/access";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import type { LandCoverDatasetOption } from "@/features/landcover/types";
import { fetchLandCoverModels, fetchLandCoverTraining, saveLandCoverModels, trainLandCoverModel, type LandCoverModelConfig, type TrainingJob } from "../landcoverModelsApi";

const EXAMPLE = { TerraMind_LULC: { enabled: true, annual_asset_template: "projects/YOUR_PROJECT/assets/terramind_lulc_v1_{year}",
  model_version: "terramind-indonesia-v1", supported_years: [2024, 2025], class_band: "landcover", confidence_band: "confidence",
  native_scale: 10, validation_kind: "independent_holdout", accuracy_note: "Isi hasil evaluasi independen AOI/kelas dan periode yang sebenarnya.",
  classes: { "1": { label: "Forest", color: "#006400" }, "2": { label: "Cropland", color: "#ffff00" }, "3": { label: "Built-up", color: "#ff0000" } } } };

/** Versioned LULC assets and persistent EE classifier training share the existing model permission. */
export default function LandCoverModels() {
  const user = useAuthStore((state) => state.user);
  const language = useI18nStore((state) => state.language);
  const text = (id: string, en: string) => language === "id" ? id : en;
  const canWrite = hasAdminPermission(user, "model.write");
  const [models, setModels] = useState<LandCoverDatasetOption[]>([]);
  const [configText, setConfigText] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [model, setModel] = useState("AlphaEarth_RF");
  const [asset, setAsset] = useState("");
  const [version, setVersion] = useState("");
  const [aoi, setAoi] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<TrainingJob | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchLandCoverModels().then((result) => { if (!cancelled) { setModels(result.models); setConfigText(JSON.stringify(result.config, null, 2)); } })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load models"); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await fetchLandCoverTraining(jobId);
        if (cancelled) return;
        setJob(result);
        if (!["completed", "failed"].includes(result.status)) timer = setTimeout(poll, 5000);
      } catch (err: unknown) { if (!cancelled) setError(err instanceof Error ? err.message : "Training status unavailable"); }
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [jobId]);
  const save = async (value?: LandCoverModelConfig) => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await saveLandCoverModels(value ?? JSON.parse(configText) as LandCoverModelConfig);
      setConfigText(JSON.stringify(result.config, null, 2));
      const refreshed = await fetchLandCoverModels(); setModels(refreshed.models);
      setMessage(text("Konfigurasi disimpan. Katalog pengguna sudah diperbarui.", "Configuration saved. The user catalog is updated."));
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to save configuration"); }
    finally { setBusy(false); }
  };
  const train = async () => {
    setBusy(true); setError(null); setJob(null);
    try {
      const result = await trainLandCoverModel({ model, asset_id: asset.trim(), model_version: version.trim(),
        ...(aoi.trim() ? { aoi: { geojson: JSON.parse(aoi) as GeoJSON.GeoJSON } } : {}) });
      setJobId(result.job_id);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Training failed"); }
    finally { setBusy(false); }
  };
  return <section className="card p-3 mt-4" aria-labelledby="landcover-models-title">
    <h3 id="landcover-models-title">{text("Model Land Cover & Perubahan", "Land Cover & Change Models")}</h3>
    <p className="text-muted">{text("Classifier referensi AlphaEarth dan Sentinel-1/2 tersedia. TerraMind, TESSERA, Prithvi, dan LCFM menggunakan raster hasil model terlatih yang dipublikasikan ke Earth Engine.", "Reference classifiers for AlphaEarth and Sentinel-1/2 are available. TerraMind, TESSERA, Prithvi, and LCFM use trained prediction rasters published to Earth Engine.")}</p>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {message && <p className="alert alert-success" role="status">{message}</p>}
    <div className="row g-2 mb-3">{models.map((item) => <div className="col-md-6" key={item.key}><div className="border rounded p-2 h-100">
      <strong>{item.name}</strong> <span className={`badge ${item.available ? "bg-success" : "bg-secondary"}`}>{item.available ? text("Tersedia", "Available") : text("Perlu konfigurasi", "Needs configuration")}</span>
      <div className="small text-muted">{item.class_count} {text("kelas", "classes")} · {item.resolution} · {item.year_min ?? "—"}–{item.year_max ?? "—"}</div>
      <small>{item.accuracy}</small>
    </div></div>)}</div>
    <label htmlFor="landcover-model-config" className="form-label fw-bold">{text("Konfigurasi model (JSON)", "Model configuration (JSON)")}</label>
    <textarea id="landcover-model-config" className="form-control font-monospace" rows={16} value={configText} readOnly={!canWrite} onChange={(event) => setConfigText(event.target.value)} spellCheck={false} />
    <p className="small text-muted mt-1">{text("Atur enabled, supported_years, model_version, classes, native_scale, classifier_asset atau annual_asset_template. Confidence harus 0–1. Schema dan versi classifier harus sama pada kedua periode.", "Configure enabled, supported_years, model_version, classes, native_scale, classifier_asset or annual_asset_template. Confidence must be 0–1. Both periods must use the same classifier version and schema.")}</p>
    <button type="button" className="btn btn-success align-self-start" disabled={busy || !canWrite} onClick={() => void save()}>{text("Simpan konfigurasi", "Save configuration")}</button>
    <details className="mt-2"><summary>{text("Contoh aset prediksi", "Prediction asset example")}</summary><pre className="small mt-2">{JSON.stringify(EXAMPLE, null, 2)}</pre></details>
    <hr />
    <h4>{text("Training classifier Earth Engine", "Train an Earth Engine classifier")}</h4>
    <p className="small">{text("Training menggunakan label MapBiomas 4.1 yang homogen. Label referensi 30 m belum membuktikan akurasi independen 10 m. Aset diekspor ke proyek EE Anda; aktifkan setelah ekspor selesai.", "Training uses homogeneous MapBiomas 4.1 labels. The 30 m reference does not establish independent 10 m accuracy. The classifier is exported to your EE project; activate it after export completes.")}</p>
    <label htmlFor="lulc-training-model" className="form-label">Model</label>
    <select id="lulc-training-model" className="form-select mb-2" value={model} onChange={(event) => setModel(event.target.value)}><option value="AlphaEarth_RF">AlphaEarth + Random Forest</option><option value="Sentinel1_2_RF">Sentinel-1/2 + Random Forest</option></select>
    <label htmlFor="lulc-training-asset" className="form-label">{text("Asset classifier tujuan", "Destination classifier asset")}</label>
    <input id="lulc-training-asset" className="form-control mb-2" placeholder="projects/YOUR_PROJECT/assets/lulc_rf_v1" value={asset} onChange={(event) => setAsset(event.target.value)} />
    <label htmlFor="lulc-training-version" className="form-label">{text("Versi model", "Model version")}</label>
    <input id="lulc-training-version" className="form-control mb-2" value={version} onChange={(event) => setVersion(event.target.value)} />
    <label htmlFor="lulc-training-aoi" className="form-label">{text("AOI training GeoJSON (opsional; kosong = 12 wilayah Indonesia)", "Training AOI GeoJSON (optional; empty = 12 Indonesian regions)")}</label>
    <textarea id="lulc-training-aoi" className="form-control mb-2" rows={3} value={aoi} onChange={(event) => setAoi(event.target.value)} />
    <button type="button" className="btn btn-outline-success align-self-start" disabled={!canWrite || busy || !asset.trim() || !version.trim() || Boolean(job && !["completed", "failed"].includes(job.status))} onClick={() => void train()}>{text("Latih dan ekspor classifier", "Train and export classifier")}</button>
    {job && <div className="border rounded p-2 mt-2" role="status"><strong>{job.model}: {job.status}</strong>{job.task_id && <div className="small">EE task: {job.task_id}</div>}{job.error && <div className="text-danger">{job.error}</div>}
      {job.training_metadata && <p className="small mb-1">{job.training_metadata.training_sample_count} {text("sampel", "samples")} · {text("Kelas tanpa sampel", "Classes without samples")}: {job.training_metadata.missing_training_classes.join(", ") || "—"}</p>}
      {job.status === "completed" && job.config_entry && <button type="button" className="btn btn-success btn-sm" disabled={busy || !canWrite} onClick={() => {
        try { const config = JSON.parse(configText) as LandCoverModelConfig; void save({ ...config, [job.model]: { ...config[job.model], ...job.config_entry, enabled: true } }); }
        catch (err: unknown) { setError(err instanceof Error ? err.message : "Invalid JSON"); }
      }}>{text("Aktifkan classifier ini", "Activate this classifier")}</button>}
    </div>}
  </section>;
}
