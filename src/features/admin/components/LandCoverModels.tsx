import { useEffect, useState } from "react";
import { hasAdminPermission } from "@/auth/access";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import InfoTip from "@/components/ui/InfoTip";
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
  return <section className="admin-lc-models card mt-4" aria-labelledby="landcover-models-title">
    <header className="admin-lc-heading">
      <div className="admin-lc-heading__title">
        <span className="admin-lc-heading__icon"><i className="bi bi-map" aria-hidden="true" /></span>
        <div><h3 id="landcover-models-title">{text("Model Land Cover & Perubahan", "Land Cover & Change Models")}</h3><span>{text("Katalog, konfigurasi, dan classifier", "Catalog, configuration, and classifiers")}</span></div>
        <InfoTip label={text("Tentang model land cover", "About land cover models")} content={text("Model referensi AlphaEarth dan Sentinel-1/2 memakai label MapBiomas. TerraMind, TESSERA, Prithvi, dan LCFM memerlukan raster prediksi nyata di Earth Engine. Akurasi lokal hanya ditampilkan jika telah divalidasi.", "AlphaEarth and Sentinel-1/2 reference models use MapBiomas labels. TerraMind, TESSERA, Prithvi, and LCFM require actual prediction rasters in Earth Engine. Local accuracy is shown only when validated.")} />
      </div>
    </header>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {message && <p className="alert alert-success" role="status">{message}</p>}
    <div className="admin-lc-catalog">{models.map((item) => <article className="admin-lc-model-card" key={item.key}>
      <div className="admin-lc-model-card__top"><strong>{item.name}</strong><span className={`admin-lc-status ${item.available ? "is-ready" : "is-pending"}`}><i className={`bi ${item.available ? "bi-check-circle-fill" : "bi-sliders2"}`} aria-hidden="true" />{item.available ? text("Aktif", "Ready") : text("Konfigurasi", "Configure")}</span></div>
      <div className="admin-lc-model-card__meta">{item.class_count} {text("kelas", "classes")} <span /> {item.resolution} <span /> {item.year_min ?? "—"}–{item.year_max ?? "—"}<InfoTip label={text(`Info ${item.name}`, `${item.name} information`)} content={<><strong>{item.name}</strong><br />{item.accuracy || text("Belum ada evaluasi akurasi.", "No accuracy evaluation provided.")}<br />{!item.available && item.availability_reason}</>} /></div>
    </article>)}</div>
    <details className="admin-lc-advanced">
      <summary><span><i className="bi bi-braces-asterisk" aria-hidden="true" /> {text("Konfigurasi lanjutan", "Advanced configuration")}</span><i className="bi bi-chevron-down" aria-hidden="true" /></summary>
      <div className="admin-lc-advanced__body">
        <div className="admin-lc-label-row"><label htmlFor="landcover-model-config" className="form-label">JSON</label><InfoTip label={text("Bantuan konfigurasi model", "Model configuration help")} content={text("Atur versi, tahun, kelas, skala, dan asset classifier atau template raster prediksi. Gunakan skema serta versi yang sama untuk kedua tahun change detection.", "Set the version, years, classes, scale, and classifier asset or prediction raster template. Use the same schema and version for both change detection years.")} /></div>
        <textarea id="landcover-model-config" className="form-control font-monospace" rows={12} value={configText} readOnly={!canWrite} onChange={(event) => setConfigText(event.target.value)} spellCheck={false} />
        <div className="admin-lc-advanced__actions"><button type="button" className="btn btn-success" disabled={busy || !canWrite} onClick={() => void save()}>{text("Simpan konfigurasi", "Save configuration")}</button><details><summary>{text("Contoh prediksi", "Prediction example")}</summary><pre>{JSON.stringify(EXAMPLE, null, 2)}</pre></details></div>
      </div>
    </details>
    <div className="admin-lc-training">
      <header className="admin-lc-heading admin-lc-heading--training">
        <div className="admin-lc-heading__title"><span className="admin-lc-heading__icon"><i className="bi bi-cpu" aria-hidden="true" /></span><div><h4>{text("Training classifier Earth Engine", "Train Earth Engine classifier")}</h4><span>{text("Latih dan ekspor ke asset", "Train and export to an asset")}</span></div>
          <InfoTip label={text("Tentang training classifier", "About classifier training")} content={text("Training memakai sampel label MapBiomas 4.1 homogen. Label 30 m tidak membuktikan akurasi independen untuk keluaran 10 m. Setelah ekspor berhasil, aktifkan classifier agar masuk ke katalog.", "Training uses homogeneous MapBiomas 4.1 label samples. 30 m labels do not prove independent accuracy for 10 m outputs. After export succeeds, activate the classifier to add it to the catalog.")} />
        </div>
      </header>
      <div className="admin-lc-training__grid">
        <div><div className="admin-lc-label-row"><label htmlFor="lulc-training-model" className="form-label">{text("Model sumber", "Source model")}</label><InfoTip label={text("Model sumber training", "Training source model")} content={text("AlphaEarth memakai embedding tahunan. Sentinel-1/2 memakai citra radar dan optik.", "AlphaEarth uses annual embeddings. Sentinel-1/2 uses radar and optical imagery.")} /></div>
          <select id="lulc-training-model" className="form-select" value={model} onChange={(event) => setModel(event.target.value)}><option value="AlphaEarth_RF">AlphaEarth + Random Forest</option><option value="Sentinel1_2_RF">Sentinel-1/2 + Random Forest</option></select></div>
        <div><div className="admin-lc-label-row"><label htmlFor="lulc-training-version" className="form-label">{text("Versi", "Version")}</label><InfoTip label={text("Versi model", "Model version")} content={text("Pakai ID versi baru untuk setiap perubahan data atau parameter training.", "Use a new version ID for each change to training data or parameters.")} /></div>
          <input id="lulc-training-version" className="form-control" placeholder="lulc-rf-v1" value={version} onChange={(event) => setVersion(event.target.value)} /></div>
        <div className="admin-lc-training__asset"><div className="admin-lc-label-row"><label htmlFor="lulc-training-asset" className="form-label">{text("Asset tujuan", "Destination asset")}</label><InfoTip label={text("Asset classifier tujuan", "Destination classifier asset")} content={text("ID asset Earth Engine di project Anda, misalnya projects/nama-project/assets/lulc_rf_v1.", "Earth Engine asset ID in your project, for example projects/project-name/assets/lulc_rf_v1.")} /></div>
          <input id="lulc-training-asset" className="form-control" placeholder="projects/project/assets/lulc_rf_v1" value={asset} onChange={(event) => setAsset(event.target.value)} /></div>
      </div>
      <details className="admin-lc-aoi"><summary>{text("AOI khusus (opsional)", "Custom AOI (optional)")}</summary>
        <div className="admin-lc-label-row admin-lc-aoi__hint"><span>{text("Unggah batas training sendiri", "Provide a custom training boundary")}</span><InfoTip label={text("Tentang AOI training", "About training AOI")} content={text("Kosongkan untuk memakai sampel referensi dari 12 wilayah di Indonesia.", "Leave empty to use reference samples from 12 regions in Indonesia.")} /></div>
        <textarea id="lulc-training-aoi" className="form-control font-monospace mt-2" rows={3} aria-label="Training AOI GeoJSON" placeholder="GeoJSON" value={aoi} onChange={(event) => setAoi(event.target.value)} />
      </details>
      <button type="button" className="btn btn-success admin-lc-train-btn" disabled={!canWrite || busy || !asset.trim() || !version.trim() || Boolean(job && !["completed", "failed"].includes(job.status))} onClick={() => void train()}>
        <i className={`bi ${busy ? "bi-arrow-repeat" : "bi-play-fill"}`} aria-hidden="true" /> {busy ? text("Memproses…", "Working…") : text("Latih classifier", "Train classifier")}
      </button>
      {job && <div className={`admin-lc-job is-${job.status}`} role="status"><div className="admin-lc-job__top"><strong>{job.model}</strong><span>{job.status}</span></div>{job.task_id && <div className="admin-lc-job__task">EE task: <code>{job.task_id}</code></div>}{job.error && <div className="text-danger">{job.error}</div>}
        {job.training_metadata && <div className="admin-lc-job__meta">{job.training_metadata.training_sample_count} {text("sampel", "samples")} · {text("Kelas tanpa sampel", "Missing classes")}: {job.training_metadata.missing_training_classes.join(", ") || "—"}</div>}
      {job.status === "completed" && job.config_entry && <button type="button" className="btn btn-success btn-sm" disabled={busy || !canWrite} onClick={() => {
        try { const config = JSON.parse(configText) as LandCoverModelConfig; void save({ ...config, [job.model]: { ...config[job.model], ...job.config_entry, enabled: true } }); }
        catch (err: unknown) { setError(err instanceof Error ? err.message : "Invalid JSON"); }
      }}>{text("Aktifkan classifier", "Activate classifier")}</button>}
      </div>}
    </div>
  </section>;
}
