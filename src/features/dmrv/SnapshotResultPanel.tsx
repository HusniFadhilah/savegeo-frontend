import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { formatNumber, useI18nStore } from "@/hooks/useI18nStore";
import { getDmrvSnapshot } from "./api";
import { asRecord, snapshotAoi, snapshotLayers, snapshotMetrics } from "./snapshotPresentation";
import SnapshotValues from "./SnapshotValues";
import type { DmrvSnapshot } from "./types";

const SnapshotRasterMap = lazy(() => import("./SnapshotRasterMap"));
const LABELS: Record<string, [string, string]> = {
  mean: ["Rata-rata", "Mean"],
  min: ["Minimum", "Minimum"],
  max: ["Maksimum", "Maximum"],
  std_dev: ["Simpangan baku", "Standard deviation"],
  total_carbon_tons: ["Stok karbon total", "Total carbon stock"],
  calculation_area_ha: ["Luas perhitungan", "Calculation area"],
  carbon_estimated: ["Hasil karbon", "Carbon result"],
  carbon_reference: ["Referensi karbon", "Carbon reference"],
  area_info: ["Luas dan stok", "Area and stock"],
  model_info: ["Model dan periode", "Model and period"],
  data_quality: ["Mutu data", "Data quality"],
  indices: ["Indeks vegetasi", "Vegetation indices"],
  results: ["Hasil per dataset", "Results by dataset"],
  pairs: ["Perubahan antarperiode", "Changes between periods"],
  net_changes: ["Perubahan bersih", "Net changes"],
};
export default function SnapshotResultPanel({
  projectId,
  snapshotId,
  onClose,
}: {
  projectId: string;
  snapshotId: string;
  onClose: () => void;
}) {
  const language = useI18nStore((s) => s.language);
  const en = language === "en";
  const tr = (id: string, english: string) => (en ? english : id);
  const label = (key: string) =>
    key
      .split(" / ")
      .map((part) => LABELS[part]?.[en ? 1 : 0] || part.replace(/_/g, " "))
      .join(" / ");
  const [snapshot, setSnapshot] = useState<DmrvSnapshot | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [layerKey, setLayerKey] = useState("");
  useEffect(() => {
    let active = true;
    setSnapshot(null);
    setError("");
    setLayerKey("");
    getDmrvSnapshot(projectId, snapshotId)
      .then((row) => {
        if (active) setSnapshot(row);
      })
      .catch(() => {
        if (active)
          setError(
            en
              ? "Result unavailable or access no longer permitted."
              : "Hasil tidak tersedia atau akses sudah tidak diizinkan.",
          );
      });
    return () => {
      active = false;
    };
  }, [projectId, snapshotId, revision, en]);
  const layers = useMemo(() => (snapshot ? snapshotLayers(snapshot.outputs) : []), [snapshot]);
  const aoi = useMemo(() => (snapshot ? snapshotAoi(snapshot) : null), [snapshot]);
  const layer = layers.find((item) => item.key === layerKey) || layers[0];
  const metrics = snapshot ? snapshotMetrics(snapshot) : [];
  const context = asRecord(snapshot?.inputs.context);
  const period = asRecord(context.period);
  const boundary = asRecord(context.boundary);
  function download() {
    if (!snapshot) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `savegeo-snapshot-${snapshot.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section
      className="card mt-3"
      aria-label={tr("Hasil analisis tersimpan", "Saved analysis result")}
    >
      <div className="card-header text-white d-flex justify-content-between align-items-center gap-2">
        <span>
          <i className="bi bi-journal-check me-2" aria-hidden="true" />
          {tr("Hasil analisis tersimpan", "Saved analysis result")}
        </span>
        <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>
          {tr("Tutup hasil", "Close result")}
        </button>
      </div>
      <div className="card-body">
        {error ? (
          <div role="alert" className="alert alert-danger">
            {error}{" "}
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => setRevision((v) => v + 1)}
            >
              {tr("Coba lagi", "Retry")}
            </button>
          </div>
        ) : !snapshot ? (
          <p role="status">{tr("Memuat hasil tersimpan...", "Loading saved result...")}</p>
        ) : (
          <>
            <div className="d-flex flex-wrap gap-3 mb-3 small text-body-secondary">
              <span>
                <i className="bi bi-calendar3 me-1" aria-hidden="true" />
                {String(period.start || "")} - {String(period.end || "")}
              </span>
              <span>
                {tr("Versi batas", "Boundary version")}: {String(boundary.version || "-")}
              </span>
              <span>
                {tr("Disimpan", "Saved")}:{" "}
                {snapshot.created_at
                  ? new Date(snapshot.created_at).toLocaleString(en ? "en-GB" : "id-ID")
                  : "-"}
              </span>
            </div>
            {metrics.length > 0 && (
              <div className="row g-2 mb-3">
                {metrics.map((metric) => (
                  <div className="col-sm-6 col-lg-4" key={metric.key}>
                    <div className="border rounded p-3 h-100 bg-body-tertiary">
                      <div className="small text-body-secondary">{label(metric.key)}</div>
                      <strong>
                        {formatNumber(metric.value, language, { maximumFractionDigits: 4 })}{" "}
                        {metric.unit}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {layer ? (
              <>
                <label className="form-label" htmlFor="snapshot-raster">
                  {tr("Layer hasil", "Result layer")}
                </label>
                <select
                  id="snapshot-raster"
                  className="form-select mb-3"
                  value={layer.key}
                  onChange={(e) => setLayerKey(e.target.value)}
                >
                  {layers.map((item) => (
                    <option key={item.key} value={item.key}>
                      {label(item.key)}
                    </option>
                  ))}
                </select>
                <Suspense fallback={<p role="status">{tr("Memuat peta...", "Loading map...")}</p>}>
                  <SnapshotRasterMap
                    key={snapshot.id}
                    snapshotId={snapshot.id}
                    layer={layer}
                    aoi={aoi}
                  />
                </Suspense>
                <p className="small text-body-secondary mt-2">
                  {tr(
                    "Peta memakai alamat layer yang tersimpan. Alamat penyedia dapat kedaluwarsa; statistik snapshot tetap tersimpan.",
                    "The map uses its stored layer address. Provider addresses may expire; snapshot statistics remain saved.",
                  )}
                </p>
              </>
            ) : (
              <p className="small text-body-secondary">
                {tr(
                  "Snapshot ini tidak memiliki layer raster tersimpan.",
                  "This snapshot has no saved raster layer.",
                )}
              </p>
            )}
            <div className="d-grid gap-2 mt-3">
              {Object.entries(snapshot.outputs).map(([key, value]) => (
                <details className="border rounded p-3" key={key}>
                  <summary className="fw-semibold">{label(key)}</summary>
                  <SnapshotValues value={value} />
                </details>
              ))}
            </div>
            <details className="mt-3 small">
              <summary>
                {tr("Identitas dan konteks snapshot", "Snapshot identity and context")}
              </summary>
              <dl className="mt-2">
                <dt>ID</dt>
                <dd className="text-break">{snapshot.id}</dd>
                <dt>SHA-256</dt>
                <dd className="text-break">{snapshot.snapshot_hash}</dd>
              </dl>
              <pre className="overflow-auto text-body" style={{ maxHeight: 280 }}>
                {JSON.stringify(snapshot.inputs, null, 2)}
              </pre>
            </details>
            <button type="button" className="btn btn-outline-success mt-3" onClick={download}>
              <i className="bi bi-download me-2" aria-hidden="true" />
              {tr("Unduh snapshot JSON", "Download snapshot JSON")}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
