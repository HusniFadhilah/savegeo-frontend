import { useEffect, useState } from "react";
import { exportGeoTiff } from "@/features/carbon/api";
import type { AoiPayload } from "@/features/carbon/lib/geo";
import type { AnalysisResultsBundle, ReportContext } from "@/features/reports/export";
import { downloadStatisticsJson, generateMarkdownReport } from "@/features/reports/export";
import { ApiError } from "@/services/apiClient";
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
}

const SCALE_OPTIONS = [10, 20, 30, 100, 250, 500];

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
  if (results.carbon) {
    options.push({ value: "carbon|", label: "Carbon Stock" });
  }
  return options;
}

/** Ported from main.js exportToGoogleDrive()/showExportDialog()/downloadStatistics()/generateReport(). */
export default function ExportPanel({ reportContext, aoiPayload, modelName }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [choice, setChoice] = useState<ExportChoice | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { results, year, startMonth, endMonth, cloudThreshold } = reportContext;
  const layerOptions = buildLayerOptions(results);

  useEffect(() => {
    window.downloadStatistics = () => downloadStatisticsJson(reportContext);
    window.downloadExecutiveSummary = () => generateMarkdownReport(reportContext);
    window.exportToGoogleDrive = openModal;
    return () => {
      delete window.downloadStatistics;
      delete window.downloadExecutiveSummary;
      delete window.exportToGoogleDrive;
    };
    // openModal intentionally uses latest render state and is only called from the active panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportContext, layerOptions.length]);

  function openModal() {
    const first = layerOptions[0];
    if (!first) return;
    const [layerType, extra] = first.value.split("|");
    setChoice({
      layerType: layerType as ExportChoice["layerType"],
      indexName: layerType === "vegetation" ? extra : null,
      dataset: layerType === "landcover" ? extra : null,
      scale: layerType === "carbon" ? 100 : layerType === "landcover" ? 10 : 20,
    });
    setExportError(null);
    setModalOpen(true);
  }

  async function handleExportConfirm() {
    if (!choice) return;
    setExporting(true);
    setExportError(null);
    try {
      const res = await exportGeoTiff({
        aoi: aoiPayload,
        layerType: choice.layerType,
        indexName: choice.indexName,
        dataset: choice.dataset,
        scale: choice.scale,
        year,
        startMonth,
        endMonth,
        cloudThreshold,
        modelName: choice.layerType === "carbon" ? modelName : null,
        filename: `savegeo_${reportContext.aoi.name.replace(/\s+/g, "_")}_${choice.layerType}_${year}`,
      });
      if (res.download_url) {
        const a = document.createElement("a");
        a.href = res.download_url;
        a.download = res.filename || "savegeo_export.tif";
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
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
            <button id="exportExecSummary" className="btn btn-primary w-100" onClick={() => generateMarkdownReport(reportContext)}>
              <i className="bi bi-file-earmark-text me-1" /> Buat Laporan
            </button>
          </div>
        </div>
      </div>

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
                  <div className="alert alert-info py-2 small">
                    File GeoTIFF akan diunduh langsung. Area besar memerlukan scale lebih besar.
                  </div>
                  <div className="mb-3">
                    <label className="form-label">
                      <strong>Layer yang diekspor</strong>
                    </label>
                    <SearchableSelect
                      value={`${choice.layerType}|${choice.indexName ?? choice.dataset ?? ""}`}
                      onChange={(v) => {
                        const [layerType, extra] = v.split("|");
                        setChoice({
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
                      {SCALE_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}m
                        </option>
                      ))}
                    </select>
                  </div>
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
