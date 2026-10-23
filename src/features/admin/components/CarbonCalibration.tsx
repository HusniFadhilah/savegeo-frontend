import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useAdmin, type ToastType } from "../AdminContext";
import { useI18nStore } from "@/hooks/useI18nStore";
import { ApiError } from "@/services/apiClient";
import {
  createCarbonCalibrationDataset,
  importCarbonCalibrationSources,
  extractCarbonCalibrationDataset,
  getCarbonCalibrationDataset,
  listCarbonCalibrationDatasets,
  extractCarbonCalibrationFeatures,
  validateCarbonCalibrationSpatial,
  uploadCarbonCalibrationFile,
  validateCarbonCalibrationDataset,
} from "../api";
import type { CarbonCalibrationDataset, CarbonCalibrationFile } from "../types";

const DEFAULT_DATASET = {
  dataset_id: "dahana_subang_2026",
  name: "PT Dahana Subang Rubber Carbon Survey 2026",
  site: "Ring 3 PT Dahana",
  location: "Subang, Jawa Barat",
  crs: "EPSG:32748",
  survey_year: 2026,
  ecosystem: "rubber_plantation",
  species: ["Hevea brasiliensis"],
  sampling_design: "purposive",
  plot_count: 10,
  plot_size_m: [20, 20],
  sample_area_ha: 0.4,
  mapped_area_ha: 9,
  target_pools: ["aboveground_biomass_carbon", "belowground_biomass_carbon", "living_biomass_carbon"],
  carbon_fraction: 0.47,
  field_reference_type: "allometric",
  access: "restricted",
  status: "draft",
};

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function readableApiMessage(value: unknown, fallback: string): { message: string; type: ToastType } {
  let payload = value;
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try { payload = JSON.parse(trimmed); } catch { /* Keep the original message. */ }
    }
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { message: typeof payload === "string" && payload ? payload : fallback, type: "e" };
  }

  const outer = payload as Record<string, unknown>;
  const nested = [outer.detail, outer.error].find((item) => item && typeof item === "object" && !Array.isArray(item)) as Record<string, unknown> | undefined;
  const result = { ...nested, ...outer };
  const status = typeof result.status === "string" ? result.status.toLowerCase() : "";
  const isBlocked = result.blocking === true || ["not_computed", "blocked", "failed", "error", "invalid"].includes(status);
  const statusLabel: Record<string, string> = {
    not_computed: "Belum dapat dihitung",
    blocked: "Proses terhambat",
    failed: "Proses gagal",
    error: "Terjadi kesalahan",
    invalid: "Data belum valid",
  };
  const rawReason = outer.reason ?? outer.message ?? outer.detail ?? outer.error ?? result.reason ?? result.message ?? result.detail ?? result.error;
  const reason = readableReason(rawReason);

  if (reason) {
    const label = statusLabel[status] ?? (status ? status.replace(/_/g, " ") : "");
    return { message: [label, reason].filter(Boolean).join(": "), type: isBlocked ? "e" : "i" };
  }
  if (status && statusLabel[status]) return { message: statusLabel[status], type: isBlocked ? "e" : "i" };
  return { message: fallback, type: isBlocked ? "e" : "s" };
}

function readableReason(value: unknown): string | undefined {
  if (typeof value === "string") {
    return /^no readable DEM\/DTM\/DSM raster is attached$/i.test(value.trim())
      ? "Tidak ada raster DEM/DTM/DSM yang dapat dibaca pada dataset."
      : value;
  }
  if (Array.isArray(value)) return value.map(readableReason).filter(Boolean).join("; ") || undefined;
  if (value && typeof value === "object") {
    const detail = value as Record<string, unknown>;
    return readableReason(detail.reason ?? detail.message ?? detail.detail ?? detail.error);
  }
  return undefined;
}

export default function CarbonCalibration() {
  const { notify } = useAdmin();
  const t = useI18nStore((state) => state.t);
  const [datasets, setDatasets] = useState<CarbonCalibrationDataset[]>([]);
  const [selected, setSelected] = useState<CarbonCalibrationDataset | null>(null);
  const [files, setFiles] = useState<CarbonCalibrationFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [revisedWorkbook, setRevisedWorkbook] = useState<File | null>(null);
  const [previousWorkbook, setPreviousWorkbook] = useState<File | null>(null);
  const [demFile, setDemFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => listCarbonCalibrationDatasets().then((result) => setDatasets(result.datasets ?? [])).catch((error) => {
    const outcome = readableApiMessage(error instanceof Error ? error.message : error, t("admin.calibration.loadFailed"));
    notify(outcome.message, outcome.type);
  }), [notify, t]);
  useEffect(() => { void reload(); }, [reload]);

  async function createDataset() {
    setBusy(true);
    try {
      const existing = datasets.find((dataset) => dataset.dataset_id === DEFAULT_DATASET.dataset_id);
      if (existing) {
        await selectDataset(existing);
        notify(t("admin.calibration.opened"), "s");
        return;
      }

      const created = await createCarbonCalibrationDataset(DEFAULT_DATASET);
      setSelected(created);
      setDatasets((current) => [created, ...current]);
      notify(t("admin.calibration.created"), "s");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        try {
          const latest = await listCarbonCalibrationDatasets();
          const available = latest.datasets ?? [];
          setDatasets(available);
          const existing = available.find((dataset) => dataset.dataset_id === DEFAULT_DATASET.dataset_id);
          if (existing) {
            await selectDataset(existing);
            notify(t("admin.calibration.opened"), "s");
            return;
          }
        } catch {
          // Show the original conflict below if the dataset list cannot be refreshed.
        }
      }
      const outcome = readableApiMessage(error instanceof Error ? error.message : error, t("admin.calibration.createFailed"));
      notify(outcome.message, outcome.type);
    }
    finally { setBusy(false); }
  }

  async function selectDataset(dataset: CarbonCalibrationDataset) {
    setSelected(dataset);
    try {
      const detail = await getCarbonCalibrationDataset(dataset.dataset_id);
      setFiles(detail.files ?? []);
    } catch (error) {
      const outcome = readableApiMessage(error instanceof Error ? error.message : error, t("admin.calibration.loadFailed"));
      notify(outcome.message, outcome.type);
    }
  }

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    if (!selected || !event.target.files?.length) return;
    setBusy(true);
    try {
      const uploaded: CarbonCalibrationFile[] = [];
      for (const file of Array.from(event.target.files)) uploaded.push(await uploadCarbonCalibrationFile(selected.dataset_id, file));
      setFiles((current) => [...current, ...uploaded]);
      notify(t("admin.calibration.uploaded"), "s");
    } catch (error) {
      const outcome = readableApiMessage(error instanceof Error ? error.message : error, t("admin.calibration.uploadFailed"));
      notify(outcome.message, outcome.type);
    }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  async function importSources() {
    if (!revisedWorkbook) {
      notify(t("admin.calibration.revisedRequired"), "e");
      return;
    }
    setBusy(true);
    try {
      const result = await importCarbonCalibrationSources(revisedWorkbook, previousWorkbook, demFile);
      const outcome = readableApiMessage(result, t("admin.calibration.importQueued"));
      notify(outcome.message, outcome.type);
      setRevisedWorkbook(null);
      setPreviousWorkbook(null);
      setDemFile(null);
      await reload();
    } catch (error) {
      const outcome = readableApiMessage(error instanceof Error ? error.message : error, t("admin.calibration.actionFailed"));
      notify(outcome.message, outcome.type);
    }
    finally { setBusy(false); }
  }

  async function runAction(action: "validate" | "extract" | "spatial" | "features") {
    if (!selected) return;
    setBusy(true);
    try {
      const result = action === "validate"
        ? await validateCarbonCalibrationDataset(selected.dataset_id)
        : action === "extract"
          ? await extractCarbonCalibrationDataset(selected.dataset_id)
          : action === "spatial"
            ? await validateCarbonCalibrationSpatial(selected.dataset_id)
            : await extractCarbonCalibrationFeatures(selected.dataset_id);
      const outcome = readableApiMessage(result, t("admin.calibration.actionComplete"));
      notify(outcome.message, outcome.type);
      await reload();
    } catch (error) {
      const outcome = readableApiMessage(error instanceof Error ? error.message : error, t("admin.calibration.actionFailed"));
      notify(outcome.message, outcome.type);
    }
    finally { setBusy(false); }
  }

  const totalPlots = datasets.reduce((sum, dataset) => sum + Number(dataset.manifest.plot_count ?? 0), 0);
  const selectedStatus = selected?.status ?? "Not configured";
  const statusClass = selected?.status === "validated" || selected?.status === "ready" ? "is-ready" : "is-draft";

  return (
    <section className="calibration-admin">
      <div className="calibration-header calibration-hero">
        <div>
          <div className="calibration-eyebrow">{t("admin.calibration.scope")}</div>
          <h2>{t("admin.calibration.title")} <span>{t("admin.calibration.projectExamples")}</span></h2>
          <p>{t("admin.calibration.subtitle")}</p>
          <div className="calibration-hero-meta"><span><i className="bi bi-shield-check" /> Penyimpanan terkelola</span><span><i className="bi bi-diagram-3" /> Provenans yang dapat direproduksi</span><span><i className="bi bi-lock" /> Dataset terbatas</span></div>
        </div>
        <div className="calibration-hero-actions"><span className="calibration-live-pill"><span /> Ruang kerja siap</span><button type="button" className="btn btn-primary calibration-create-btn" onClick={() => void createDataset()} disabled={busy}>
          <i className={`bi ${datasets.some((dataset) => dataset.dataset_id === DEFAULT_DATASET.dataset_id) ? "bi-folder2-open" : "bi-plus-lg"}`} /> {datasets.some((dataset) => dataset.dataset_id === DEFAULT_DATASET.dataset_id) ? t("admin.calibration.openDataset") : t("admin.calibration.create")}
        </button></div>
      </div>
      <div className="calibration-metrics" aria-label="Ringkasan ruang kerja kalibrasi">
        <div className="calibration-metric"><span className="calibration-metric-icon green"><i className="bi bi-database" /></span><div><small>Dataset</small><strong>{datasets.length}</strong><span>sumber terdaftar</span></div></div>
        <div className="calibration-metric"><span className="calibration-metric-icon blue"><i className="bi bi-folder2-open" /></span><div><small>File yang ditampilkan</small><strong>{files.length}</strong><span>{selected ? "dataset terpilih" : "pilih dataset"}</span></div></div>
        <div className="calibration-metric"><span className="calibration-metric-icon amber"><i className="bi bi-geo-alt" /></span><div><small>Plot lapangan</small><strong>{totalPlots}</strong><span>unit independen</span></div></div>
        <div className="calibration-metric"><span className={`calibration-metric-icon ${statusClass === "is-ready" ? "green" : "purple"}`}><i className="bi bi-activity" /></span><div><small>Status aktif</small><strong className="metric-status">{selectedStatus}</strong><span>{selected ? selected.dataset_id : "tidak ada dataset aktif"}</span></div></div>
      </div>
      <div className="calibration-notice">
        <span className="calibration-notice-icon"><i className="bi bi-shield-lock" /></span><div><strong>Alur sumber terlindungi</strong><p>{t("admin.calibration.warning")}</p></div><span className="calibration-notice-tag">SUMBER HANYA BACA</span>
      </div>
      <div className="admin-card calibration-import-wizard calibration-surface-card">
        <div className="admin-card-head"><div><h3>{t("admin.calibration.importWizard")}</h3><p>{t("admin.calibration.importWizardHint")}</p></div><button type="button" className="btn btn-primary" disabled={busy || !revisedWorkbook} onClick={() => void importSources()}><i className="bi bi-cloud-arrow-up" /> {t("admin.calibration.startImport")}</button></div>
        <div className="calibration-import-fields">
          <label className={`calibration-file-drop ${revisedWorkbook ? "has-file" : ""}`}><input type="file" accept=".xlsx" disabled={busy} onChange={(event) => setRevisedWorkbook(event.target.files?.[0] ?? null)} /><span className="calibration-file-icon"><i className="bi bi-file-earmark-spreadsheet" /></span><span className="calibration-file-copy"><strong>{t("admin.calibration.revisedWorkbook")}</strong><small>{revisedWorkbook?.name ?? "Wajib · .xlsx"}</small></span><i className="bi bi-arrow-up-right calibration-file-arrow" /></label>
          <label className={`calibration-file-drop ${previousWorkbook ? "has-file" : ""}`}><input type="file" accept=".xlsx" disabled={busy} onChange={(event) => setPreviousWorkbook(event.target.files?.[0] ?? null)} /><span className="calibration-file-icon"><i className="bi bi-clock-history" /></span><span className="calibration-file-copy"><strong>{t("admin.calibration.previousWorkbook")}</strong><small>{previousWorkbook?.name ?? "Opsional · .xlsx"}</small></span><i className="bi bi-arrow-up-right calibration-file-arrow" /></label>
          <label className={`calibration-file-drop ${demFile ? "has-file" : ""}`}><input type="file" accept=".tif,.tiff" disabled={busy} onChange={(event) => setDemFile(event.target.files?.[0] ?? null)} /><span className="calibration-file-icon"><i className="bi bi-globe2" /></span><span className="calibration-file-copy"><strong>{t("admin.calibration.dem")}</strong><small>{demFile?.name ?? "Opsional · .tif / .tiff"}</small></span><i className="bi bi-arrow-up-right calibration-file-arrow" /></label>
        </div>
      </div>
      <div className="calibration-grid">
        <div className="admin-card calibration-dataset-list calibration-surface-card">
          <div className="admin-card-head"><h3>{t("admin.calibration.datasets")}</h3><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void reload()}><i className="bi bi-arrow-clockwise" /></button></div>
          {!datasets.length && <div className="empty-state">{t("admin.calibration.empty")}</div>}
          {datasets.map((dataset) => <button type="button" key={dataset.dataset_id} className={`calibration-dataset-row ${selected?.dataset_id === dataset.dataset_id ? "active" : ""}`} onClick={() => void selectDataset(dataset)}><strong>{dataset.name}</strong><span>{dataset.dataset_id} · {dataset.status}</span></button>)}
        </div>
        <div className="admin-card calibration-detail calibration-surface-card">
          {!selected ? <div className="empty-state"><i className="bi bi-database-gear" /><p>{t("admin.calibration.selectHint")}</p></div> : <>
            <div className="admin-card-head"><div><h3>{selected.name}</h3><span className="stat-badge badge-amber">{selected.access}</span></div><span className="calibration-status">{selected.status}</span></div>
            <div className="calibration-metadata"><div><small>{t("admin.calibration.site")}</small><strong>{String(selected.manifest.site ?? "—")}</strong></div><div><small>CRS</small><strong>{String(selected.manifest.crs ?? "—")}</strong></div><div><small>{t("admin.calibration.plots")}</small><strong>{String(selected.manifest.plot_count ?? "—")} {t("admin.calibration.independent")}</strong></div><div><small>{t("admin.calibration.reference")}</small><strong>{t("admin.calibration.allometric")}</strong></div></div>
            <div className="calibration-actions"><button type="button" className="btn btn-outline-primary" disabled={busy} onClick={() => void runAction("validate")}><i className="bi bi-check2-circle" /> {t("admin.calibration.validate")}</button><button type="button" className="btn btn-outline-primary" disabled={busy} onClick={() => void runAction("extract")}><i className="bi bi-gear" /> {t("admin.calibration.extract")}</button><button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => void runAction("spatial")}><i className="bi bi-bounding-box" /> {t("admin.calibration.validateSpatial")}</button><button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => void runAction("features")}><i className="bi bi-bezier2" /> {t("admin.calibration.extractFeatures")}</button><button type="button" className="btn btn-primary" disabled={busy} onClick={() => fileInput.current?.click()}><i className="bi bi-upload" /> {t("admin.calibration.addFiles")}</button><input ref={fileInput} type="file" multiple hidden accept=".tif,.tiff,.zip,.obj,.csv,.xlsx,.docx,.pdf,.geojson,.json,.shp" onChange={(event) => void uploadFiles(event)} /></div>
            <h4>{t("admin.calibration.files")}</h4>
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>{t("admin.calibration.source")}</th><th>{t("admin.calibration.kind")}</th><th>{t("admin.calibration.size")}</th><th>SHA-256</th></tr></thead><tbody>{files.map((file) => <tr key={file.id}><td>{file.source_name}</td><td>{file.file_kind}</td><td>{formatBytes(file.size_bytes)}</td><td><code title={file.sha256}>{file.sha256.slice(0, 16)}…</code></td></tr>)}</tbody></table></div>
            <div className="calibration-method-note"><i className="bi bi-info-circle" /><span>{t("admin.calibration.methodNote")}</span></div>
          </>}
        </div>
      </div>
    </section>
  );
}
