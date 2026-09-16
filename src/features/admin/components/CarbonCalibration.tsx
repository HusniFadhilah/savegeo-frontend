import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useAdmin } from "../AdminContext";
import { useI18nStore } from "@/hooks/useI18nStore";
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

export default function CarbonCalibration() {
  const { notify } = useAdmin();
  const t = useI18nStore((state) => state.t);
  const [datasets, setDatasets] = useState<CarbonCalibrationDataset[]>([]);
  const [selected, setSelected] = useState<CarbonCalibrationDataset | null>(null);
  const [files, setFiles] = useState<CarbonCalibrationFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [revisedWorkbook, setRevisedWorkbook] = useState<File | null>(null);
  const [previousWorkbook, setPreviousWorkbook] = useState<File | null>(null);
  const [demFile, setDemFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => listCarbonCalibrationDatasets().then((result) => setDatasets(result.datasets ?? [])).catch((error) => setMessage(error instanceof Error ? error.message : t("admin.calibration.loadFailed"))), [t]);
  useEffect(() => { void reload(); }, [reload]);

  async function createDataset() {
    setBusy(true);
    try {
      const created = await createCarbonCalibrationDataset(DEFAULT_DATASET);
      setSelected(created);
      setDatasets((current) => [created, ...current]);
      notify(t("admin.calibration.created"), "s");
    } catch (error) { notify(error instanceof Error ? error.message : t("admin.calibration.createFailed"), "e"); }
    finally { setBusy(false); }
  }

  async function selectDataset(dataset: CarbonCalibrationDataset) {
    setSelected(dataset);
    try {
      const detail = await getCarbonCalibrationDataset(dataset.dataset_id);
      setFiles(detail.files ?? []);
    } catch (error) { setMessage(error instanceof Error ? error.message : t("admin.calibration.loadFailed")); }
  }

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    if (!selected || !event.target.files?.length) return;
    setBusy(true);
    try {
      const uploaded: CarbonCalibrationFile[] = [];
      for (const file of Array.from(event.target.files)) uploaded.push(await uploadCarbonCalibrationFile(selected.dataset_id, file));
      setFiles((current) => [...current, ...uploaded]);
      notify(t("admin.calibration.uploaded"), "s");
    } catch (error) { notify(error instanceof Error ? error.message : t("admin.calibration.uploadFailed"), "e"); }
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
      setMessage(JSON.stringify(result));
      notify(t("admin.calibration.importQueued"), "s");
      setRevisedWorkbook(null);
      setPreviousWorkbook(null);
      setDemFile(null);
      await reload();
    } catch (error) { notify(error instanceof Error ? error.message : t("admin.calibration.actionFailed"), "e"); }
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
      setMessage(JSON.stringify(result));
      notify(t("admin.calibration.actionComplete"), "s");
      await reload();
    } catch (error) { notify(error instanceof Error ? error.message : t("admin.calibration.actionFailed"), "e"); }
    finally { setBusy(false); }
  }

  return (
    <section className="calibration-admin">
      <div className="calibration-header">
        <div>
          <div className="calibration-eyebrow">PT DAHANA · SUBANG · 2026</div>
          <h2>{t("admin.calibration.title")}</h2>
          <p>{t("admin.calibration.subtitle")}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => void createDataset()} disabled={busy}>
          <i className="bi bi-plus-lg" /> {t("admin.calibration.create")}
        </button>
      </div>
      <div className="alert alert-warning d-flex gap-2 align-items-start">
        <i className="bi bi-shield-exclamation" />
        <span>{t("admin.calibration.warning")}</span>
      </div>
      <div className="admin-card calibration-import-wizard">
        <div className="admin-card-head"><div><h3>{t("admin.calibration.importWizard")}</h3><p>{t("admin.calibration.importWizardHint")}</p></div><button type="button" className="btn btn-primary" disabled={busy || !revisedWorkbook} onClick={() => void importSources()}><i className="bi bi-cloud-arrow-up" /> {t("admin.calibration.startImport")}</button></div>
        <div className="calibration-import-fields">
          <label><span>{t("admin.calibration.revisedWorkbook")}</span><input type="file" accept=".xlsx" disabled={busy} onChange={(event) => setRevisedWorkbook(event.target.files?.[0] ?? null)} /></label>
          <label><span>{t("admin.calibration.previousWorkbook")}</span><input type="file" accept=".xlsx" disabled={busy} onChange={(event) => setPreviousWorkbook(event.target.files?.[0] ?? null)} /></label>
          <label><span>{t("admin.calibration.dem")}</span><input type="file" accept=".tif,.tiff" disabled={busy} onChange={(event) => setDemFile(event.target.files?.[0] ?? null)} /></label>
        </div>
      </div>
      <div className="calibration-grid">
        <div className="admin-card calibration-dataset-list">
          <div className="admin-card-head"><h3>{t("admin.calibration.datasets")}</h3><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void reload()}><i className="bi bi-arrow-clockwise" /></button></div>
          {!datasets.length && <div className="empty-state">{t("admin.calibration.empty")}</div>}
          {datasets.map((dataset) => <button type="button" key={dataset.dataset_id} className={`calibration-dataset-row ${selected?.dataset_id === dataset.dataset_id ? "active" : ""}`} onClick={() => void selectDataset(dataset)}><strong>{dataset.name}</strong><span>{dataset.dataset_id} · {dataset.status}</span></button>)}
        </div>
        <div className="admin-card calibration-detail">
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
      {message && <pre className="calibration-message">{message}</pre>}
    </section>
  );
}
