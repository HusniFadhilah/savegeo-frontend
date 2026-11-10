import { useState } from "react";
import { exportGeoTiff } from "@/features/carbon/api";
import type { AoiPayload } from "@/features/carbon/lib/geo";
import type { AnalysisResultsBundle, ReportContext } from "@/features/reports/export";
import { downloadStatisticsJson, generatePdfReport } from "@/features/reports/export";
import { ApiError, apiClient } from "@/services/apiClient";
import SearchableSelect from "@/components/ui/SearchableSelect";

interface Props {
  reportContext: ReportContext;
  aoiPayload: AoiPayload;
  modelName: string | null;
}

interface ExportChoice {
  layerType: "carbon" | "vegetation" | "landcover" | "rgb";
  indexName: string | null;
  dataset: string | null;
  scale: number;
  pool?: string;
}

const SCALE_OPTIONS = [10, 20, 30, 100, 250, 500, 1000, 2000, 5000];

function buildLayerOptions(results: AnalysisResultsBundle) {
  const options: { value: string; label: string }[] = [];
  if (results.vegetation?.indices) {
    for (const idx of Object.keys(results.vegetation.indices)) {
      options.push({ value: `vegetation|${idx}`, label: `Vegetasi - ${idx}` });
    }
    if (results.vegetation.rgb_tile_url) {
      options.push({ value: "rgb|", label: "RGB Composite" });
    }
  }
  if (results.landcover) {
    for (const key of Object.keys(results.landcover)) {
      options.push({ value: `landcover|${key}`, label: `Land Cover - ${key.replace(/_/g, " ")}` });
    }
  }
  if (results.carbonPools) {
    for (const [pool, result] of Object.entries(results.carbonPools)) {
      if (result) options.push({ value: `carbon|${pool}`, label: `${pool.toUpperCase()} - ${result.carbon_reference?.name || result.model_info.reference_dataset || "Karbon"}` });
    }
  }
  if (results.carbon) {
    options.push({ value: "carbon|", label: "Carbon Stock" });
  }
  for (const [key, result] of Object.entries(results.carbonExtensions || {})) {
    options.push({ value: `carbon|extension:${key}`, label: result.carbon_reference?.name || key.toUpperCase() });
  }
  return options;
}

/** Ported from main.js exportToGoogleDrive()/showExportDialog()/downloadStatistics()/generateReport(). */
export default function ExportPanel({ reportContext, aoiPayload, modelName }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [choice, setChoice] = useState<ExportChoice | null>(null);
  const [exporting, setExporting] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [autoScale, setAutoScale] = useState(true);
  const [exportMode, setExportMode] = useState<"direct" | "batch_gcs">("direct");
  const [batchTask, setBatchTask] = useState<{ token: string; destination: string; state: string; error?: string } | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const { results, year, startMonth, endMonth, cloudThreshold } = reportContext;
  const layerOptions = buildLayerOptions(results);
  const selectedPool = choice?.pool?.startsWith("extension:") ? results.carbonExtensions?.[choice.pool.slice(10)] : choice?.pool ? results.carbonPools?.[choice.pool as keyof NonNullable<typeof results.carbonPools>] : results.carbon;
  const sourceResolution = choice?.layerType === "carbon" ? selectedPool?.carbon_reference?.resolution : undefined;

  function openModal() {
    const first = layerOptions[0];
    if (!first) return;
    const [layerType, extra] = first.value.split("|");
    setChoice({
      pool: layerType === "carbon" ? extra : undefined,
      layerType: layerType as ExportChoice["layerType"],
      indexName: layerType === "vegetation" ? extra : null,
      dataset: layerType === "landcover" ? extra : null,
      scale: layerType === "carbon" ? 10 : layerType === "landcover" ? 10 : 20,
    });
    setExportError(null);
    setModalOpen(true);
  }

  async function handleExportConfirm() {
    if (!choice) return;
    setExporting(true);
    setExportError(null);
    try {
      const selectedResult = choice.pool?.startsWith("extension:") ? results.carbonExtensions?.[choice.pool.slice(10)] : choice.pool ? results.carbonPools?.[choice.pool as keyof NonNullable<typeof results.carbonPools>] : results.carbon;
      const meta = selectedResult?.model_info;
      const res = await exportGeoTiff({
        aoi: aoiPayload,
        layerType: choice.layerType,
        indexName: choice.indexName,
        dataset: choice.dataset,
        scale: choice.scale,
        year: meta?.extension_payload ? Number(meta.analysis_year) : year,
        startMonth,
        endMonth,
        cloudThreshold,
        modelName: choice.layerType === "carbon" ? meta?.model_name || modelName : null,
        referenceDataset: meta?.reference_dataset,
        datasetYear: typeof meta?.reference_year === "number" ? meta.reference_year : typeof meta?.reference_dataset_year === "number" ? meta.reference_dataset_year : undefined,
        referenceOnly: meta?.display_mode === "reference_only" || meta?.large_aoi_baseline === true || meta?.model_name === "reference_only",
        autoScale,
        exportMode,
        extension: meta?.extension_payload?.extension,
        extensionSettings: meta?.extension_payload?.extension_settings,
        filename: `savegeo_${reportContext.aoi.name.replace(/\s+/g, "_")}_${choice.pool || choice.layerType}_${year}`,
      });
      if (res.task_token) {
        setBatchTask({ token: res.task_token, destination: res.destination || "", state: "SUBMITTED" });
        setExportNotice(res.note || "Tugas ekspor resolusi penuh telah dikirim."); setModalOpen(false);
      } else if (res.download_url) {
        const a = document.createElement("a");
        a.href = res.download_url;
        a.download = res.filename || "savegeo_export.tif";
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setExportNotice(`GeoTIFF ${choice.pool?.toUpperCase() || choice.layerType} disiapkan pada resolusi ${res.scale} m/piksel${res.scale_adjusted ? ` (diminta ${choice.scale} m; disesuaikan untuk batas unduhan langsung)` : ""}.`);
        setModalOpen(false);
      } else {
        setExportError("Export gagal");
      }
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : "Export error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <i className="bi bi-download me-1" /> Ekspor Hasil
      </div>
      <div className="card-body">
        <div className="row">
          <div className="col-md-4 mb-2">
            <button id="exportGeoTIFF" className="btn btn-primary w-100" onClick={openModal} disabled={!layerOptions.length}>
              <i className="bi bi-file-earmark-image me-1" /> Ekspor GeoTIFF
            </button>
          </div>
          <div className="col-md-4 mb-2">
            <button id="downloadStats" className="btn btn-primary w-100" onClick={() => downloadStatisticsJson(reportContext)}>
              <i className="bi bi-filetype-json me-1" /> Unduh Statistik
            </button>
          </div>
          <div className="col-md-4 mb-2">
            <button id="exportExecSummary" className="btn btn-primary w-100" disabled={reportBusy} onClick={async () => { setReportBusy(true); setExportError(null); try { await generatePdfReport(reportContext); } catch (error) { setExportError(error instanceof Error ? error.message : "Laporan PDF gagal dibuat. Coba kembali."); } finally { setReportBusy(false); } }}>
              <i className="bi bi-file-earmark-text me-1" /> {reportBusy ? "Membuat PDF..." : "Unduh Laporan PDF"}
            </button>
          </div>
        </div>
      </div>

      {exportNotice && <div className="alert alert-success mx-3" role="status">{exportNotice}</div>}
      {batchTask && <div className="border rounded p-3 m-3"><strong>Ekspor resolusi penuh: {batchTask.state}</strong><p className="small text-break">Tujuan: {batchTask.destination}</p>{batchTask.error && <p className="text-danger">{batchTask.error}</p>}<button type="button" className="btn btn-sm btn-outline-primary" onClick={async () => { try { const status = await apiClient.post<{ state: string; error?: string; destination: string }>("/download/raster-task-status", { task_token: batchTask.token }, { auth: "app" }); setBatchTask({ ...batchTask, ...status }); } catch (reason) { setExportError(reason instanceof Error ? reason.message : "Status ekspor gagal dimuat."); } }}>Periksa status ekspor</button><p className="small mb-0 mt-2">Setelah COMPLETED, unduh seluruh bagian COG dari bucket tujuan memakai akun yang memiliki izin baca. Berkas mempertahankan resolusi pilihan, tanpa penyesuaian otomatis.</p></div>}
      {exportError && !modalOpen && <div className="alert alert-danger mx-3" role="alert">{exportError}</div>}
      {modalOpen && choice && (
        <>
          <div className="modal-backdrop show" style={{ zIndex: 1050 }} onClick={() => setModalOpen(false)} />
          <div className="modal show d-block" style={{ zIndex: 1055 }} role="dialog">
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="bi bi-file-earmark-image me-1" /> Ekspor GeoTIFF
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setModalOpen(false)} />
                </div>
                <div className="modal-body">
                  <label className="form-label d-block">Metode ekspor<select className="form-select" value={exportMode} onChange={(event) => { const value = event.target.value as "direct" | "batch_gcs"; setExportMode(value); if (value === "batch_gcs" && sourceResolution) setChoice({ ...choice, scale: sourceResolution }); }}><option value="direct">Unduhan langsung (ukuran terbatas)</option><option value="batch_gcs">Resolusi penuh / AOI sangat besar (batch Cloud Storage)</option></select></label>
                  <div className="alert alert-info py-2 small">
                    {exportMode === "direct" ? "Unduhan langsung dapat menyesuaikan resolusi untuk memenuhi batas ukuran Earth Engine." : "Ekspor dijalankan di Earth Engine dan dibagi menjadi COG pada resolusi pilihan. Server memerlukan GEE_EXPORT_BUCKET beserta izin tulis. Waktu dan kapasitas penyimpanan mengikuti ukuran AOI."}
                  </div>
                  <div className="mb-3">
                    <label className="form-label">
                      <strong>Layer yang diekspor</strong>
                    </label>
                    <SearchableSelect
                      value={`${choice.layerType}|${choice.pool ?? choice.indexName ?? choice.dataset ?? ""}`}
                      onChange={(v) => {
                        const [layerType, extra] = v.split("|");
                        setChoice({
                          pool: layerType === "carbon" ? extra : undefined,
      layerType: layerType as ExportChoice["layerType"],
                          indexName: layerType === "vegetation" ? extra : null,
                          dataset: layerType === "landcover" ? extra : null,
                          scale: choice.scale,
                        });
                      }}
                      options={layerOptions}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">
                      <strong>Resolusi / Scale (meter/piksel)</strong>
                    </label>
                    <select
                      className="form-select"
                      value={choice.scale}
                      onChange={(e) => setChoice({ ...choice, scale: Number(e.target.value) })}
                    >
                      {[...new Set([...SCALE_OPTIONS, choice.scale, ...(sourceResolution ? [sourceResolution] : [])])].sort((a, b) => a - b).map((s) => (
                        <option key={s} value={s}>
                          {s}m
                        </option>
                      ))}
                    </select>
                    {sourceResolution && <small className="text-muted d-block mt-1">Resolusi sumber/referensi yang dilaporkan: {sourceResolution} m. Ekspor batch mempertahankan resolusi pilihan. Resolusi lebih halus tidak menambah detail sumber.</small>}
                  </div>
                  {exportMode === "direct" && <label className="form-check mb-3"><input type="checkbox" className="form-check-input" checked={autoScale} onChange={(event) => setAutoScale(event.target.checked)} /><span className="form-check-label">Sesuaikan resolusi otomatis untuk AOI besar. Resolusi akhir ditampilkan setelah ekspor.</span></label>}
                  {exportError && <div className="alert alert-danger py-2 small">{exportError}</div>}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                    Batal
                  </button>
                  <button className="btn btn-primary" onClick={handleExportConfirm} disabled={exporting}>
                    {exporting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" /> Mengunduh...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-download me-1" /> Unduh GeoTIFF
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
