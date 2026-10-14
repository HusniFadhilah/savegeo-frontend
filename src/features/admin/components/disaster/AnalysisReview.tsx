import type { ReactNode } from "react";
import SatelliteViewer from "@/features/disaster/components/SatelliteViewer";
import { useEffect, useMemo, useState } from "react";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import ResultTileLayer from "@/components/map/ResultTileLayer";
import MapLegend from "@/components/map/MapLegend";
import { getDisasterQc, publishAnalysis, runAnalysis, unpublishAnalysis } from "../../api";
import type { AnalysisRunWithResult, DisasterQcStatus } from "../../types";
import { useAdmin } from "../../AdminContext";

const RUN_STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  review_required: "Review Required",
  published: "Published",
  stale: "Stale - perlu dihitung ulang",
};

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString("id-ID", { maximumFractionDigits: 3 });
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function humanizeKey(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function exportGeoJson(features: GeoJSON.FeatureCollection | null | undefined, runId: number) {
  if (!features?.features?.length) return;
  const blob = new Blob([JSON.stringify(features, null, 2)], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `savegeo-analysis-${runId}.geojson`;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface Props {
  eventId: number;
  runs: AnalysisRunWithResult[];
  onChanged: () => void;
}

interface ReviewAccordionProps {
  title: string;
  icon: string;
  hint?: string;
  trailing?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

function ReviewAccordion({ title, icon, hint, trailing, defaultOpen = false, children }: ReviewAccordionProps) {
  return (
    <details className="analysis-review__section" open={defaultOpen}>
      <summary className="analysis-review__summary">
        <span className="analysis-review__section-icon" aria-hidden="true"><i className={`bi ${icon}`} /></span>
        <span className="analysis-review__section-heading">
          <span className="analysis-review__section-title">{title}</span>
          {hint && <span className="analysis-review__section-hint">{hint}</span>}
        </span>
        {trailing && <span className="analysis-review__section-trailing">{trailing}</span>}
        <i className="bi bi-chevron-down analysis-review__chevron" aria-hidden="true" />
      </summary>
      <div className="analysis-review__content">{children}</div>
    </details>
  );
}

function DataTable({ title, values, emptyLabel }: { title: string; values: Record<string, unknown> | null | undefined; emptyLabel: string }) {
  const entries = Object.entries(values ?? {});
  return (
    <section className="analysis-review__data-group" aria-label={title}>
      <h3 className="analysis-review__data-title">{title}</h3>
      {entries.length > 0 ? (
        <div className="analysis-review__table-wrap">
          <table className="tbl analysis-review__table">
            <tbody>
              {entries.map(([key, value]) => (
                <tr key={key}>
                  <th scope="row">{humanizeKey(key)}</th>
                  <td>{renderValue(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="analysis-review__empty-value">{emptyLabel}</p>}
    </section>
  );
}

/** QC, map review, and publishing controls for a single event analysis. */
export default function AnalysisReview({ eventId, runs, onChanged }: Props) {
  const { notify } = useAdmin();
  const reviewable = useMemo(() => runs.filter((run) => run.result && ["completed", "review_required", "published"].includes(run.run.status)), [runs]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(reviewable[0]?.run.id ?? null);
  const [qc, setQc] = useState<DisasterQcStatus | null>(null);
  const [qcLoading, setQcLoading] = useState(true);
  const [qcError, setQcError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!reviewable.some((run) => run.run.id === selectedRunId)) {
      setSelectedRunId(reviewable[0]?.run.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs]);

  const loadQc = () => {
    setQcLoading(true);
    setQcError(null);
    getDisasterQc(eventId)
      .then(setQc)
      .catch((error) => setQcError(error instanceof Error ? error.message : "Gagal memuat status QC"))
      .finally(() => setQcLoading(false));
  };

  useEffect(() => {
    loadQc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, runs]);

  const selected = reviewable.find((run) => run.run.id === selectedRunId) ?? null;

  const handlePublish = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await publishAnalysis(selected.run.id);
      notify("Hasil analisis dipublikasikan", "s");
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal mempublikasikan", "e");
    } finally {
      setBusy(false);
    }
  };

  const handleUnpublish = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await unpublishAnalysis(selected.run.id);
      notify("Publikasi hasil analisis dibatalkan", "s");
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal membatalkan publikasi", "e");
    } finally {
      setBusy(false);
    }
  };

  const handleRerun = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await runAnalysis(selected.run.id, true);
      notify("Analisis dijalankan ulang", "s");
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal menjalankan ulang analisis", "e");
    } finally {
      setBusy(false);
    }
  };

  const qcStatus = qcLoading ? "Memuat QC" : qcError ? "QC bermasalah" : qc?.ready_to_publish ? "Siap dipublikasikan" : "Perlu ditinjau";
  const qcBadgeClass = qc?.ready_to_publish && !qcLoading && !qcError ? "badge-green" : "badge-amber";

  return (
    <section className="card analysis-review" aria-label="Tinjau dan publikasikan analisis">
      <header className="analysis-review__header">
        <div className="analysis-review__title-wrap">
          <span className="analysis-review__title-icon" aria-hidden="true"><i className="bi bi-clipboard2-check" /></span>
          <div>
            <h2 className="analysis-review__title">Tinjau &amp; Publikasikan</h2>
            <p className="analysis-review__subtitle">Periksa hasil, kualitas data, dan status publikasi.</p>
          </div>
        </div>
        <label className="analysis-review__run-select">
          <span>Hasil analisis</span>
          <select
            className="form-input"
            value={selectedRunId ?? ""}
            onChange={(event) => setSelectedRunId(event.target.value ? Number(event.target.value) : null)}
            disabled={reviewable.length === 0}
          >
            <option value="">— pilih hasil analisis —</option>
            {reviewable.map(({ run }) => (
              <option key={run.id} value={run.id}>
                {run.model_id} — Run #{run.id} ({RUN_STATUS_LABEL[run.status] || run.status})
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="analysis-review__body">
        {reviewable.length === 0 && (
          <div className="analysis-review__empty" role="status">
            <i className="bi bi-inbox" aria-hidden="true" />
            <div>
              <strong>Belum ada hasil untuk ditinjau</strong>
              <p>Jalankan analisis dari tab Analisis terlebih dahulu.</p>
            </div>
          </div>
        )}

        {selected?.result && (
          <>
            <ReviewAccordion
              title="Peta dan citra hasil"
              icon="bi-map"
              hint={`${selected.run.model_id} · Run #${selected.run.id}`}
              trailing={<span className={`stat-badge ${selected.result.is_published ? "badge-green" : "badge-amber"}`}>{selected.result.is_published ? "Terpublikasi" : "Draft"}</span>}
              defaultOpen
            >
              <div className="analysis-review__map">
                {selected.result.comparison ? (
                  <SatelliteViewer key={selected.run.id}
                    aoi={null} imagery={{ pre: [], post: [] }} primaryImagery={{ pre: null, post: null }}
                    initialOutput="classes" comparisonResults={[{
                      model_id: selected.run.model_id, user_label: selected.run.model_id,
                      runId: selected.run.id, comparison: selected.result.comparison,
                    }]} />
                ) : (
                  <MapView id={`disaster-review-map-${eventId}`}>
                    <BasemapSwitcher />
                    {selected.result.tile_url && (
                      <ResultTileLayer layerKey={`review-${selected.run.id}`} tileUrl={selected.result.tile_url} opacity={0.85} />
                    )}
                  </MapView>
                )}
              </div>
            </ReviewAccordion>

            {selected.result.legend.length > 0 && (
              <ReviewAccordion title="Legenda" icon="bi-palette" hint={`${selected.result.legend.length} kelas`}>
                <MapLegend entries={selected.result.legend.map((item) => ({ color: item.color, label: item.label }))} />
              </ReviewAccordion>
            )}

            <ReviewAccordion title="Statistik dan kepercayaan" icon="bi-bar-chart-line" hint="Cakupan, hasil, dan confidence">
              {selected.result.review_reasons?.length ? (
                <div className="alert alert-warning analysis-review__notice">
                  <i className="bi bi-exclamation-triangle" aria-hidden="true" />
                  <span><strong>Perlu diperhatikan:</strong> {selected.result.review_reasons.join("; ")}</span>
                </div>
              ) : null}
              {selected.result.coverage && (
                <div className="analysis-review__coverage" aria-label="Cakupan hasil">
                  <div><span>Cakupan valid</span><strong>{renderValue(selected.result.coverage.coverage_pct)}%</strong></div>
                  <div><span>Luas valid</span><strong>{renderValue(selected.result.coverage.valid_area_ha)} ha</strong></div>
                  <div><span>No-data</span><strong>{renderValue(selected.result.coverage.no_data_area_ha)} ha</strong></div>
                </div>
              )}
              <div className="analysis-review__data-grid">
                <DataTable title="Statistik hasil" values={selected.result.statistics} emptyLabel="Statistik tidak tersedia." />
                <DataTable title="Ringkasan kepercayaan" values={selected.result.confidence_summary} emptyLabel="Ringkasan confidence tidak tersedia." />
              </div>
            </ReviewAccordion>
          </>
        )}

        <ReviewAccordion
          title="QC dan kesiapan publikasi"
          icon="bi-shield-check"
          hint="Checklist dan validasi hasil"
          trailing={<span className={`stat-badge ${qcBadgeClass}`}>{qcStatus}</span>}
        >
          {qcLoading && <p className="analysis-review__empty-value" role="status">Memuat checklist QC…</p>}
          {qcError && <div className="alert alert-danger analysis-review__notice" role="alert">{qcError}</div>}
          {qc && !qcLoading && (
            <>
              <div className="analysis-review__checklist">
                {([
                  ["aoi_configured", "AOI dikonfigurasi"],
                  ["pre_imagery_available", "Citra pra-bencana tersedia"],
                  ["post_imagery_available", "Citra pasca-bencana tersedia"],
                ] as const).map(([key, label]) => (
                  <span className={`analysis-review__check ${qc[key] ? "is-ready" : "is-missing"}`} key={key}>
                    <i className={`bi ${qc[key] ? "bi-check-circle-fill" : "bi-x-circle-fill"}`} aria-hidden="true" />
                    {label}
                  </span>
                ))}
              </div>
              <div className="analysis-review__table-wrap">
                <table className="tbl tbl-wide analysis-review__table">
                  <thead><tr><th>Model</th><th>Status</th><th>Statistik</th><th>Legenda</th><th>Kepercayaan</th></tr></thead>
                  <tbody>
                    {qc.analyses.map((analysis, index) => (
                      <tr key={`${analysis.model_id}-${index}`}>
                        <td>{analysis.model_id}</td>
                        <td>{RUN_STATUS_LABEL[analysis.status] || analysis.status}</td>
                        <td>{analysis.has_statistics ? "✓" : "—"}</td>
                        <td>{analysis.has_legend ? "✓" : "—"}</td>
                        <td>{analysis.has_confidence ? "✓" : "—"}</td>
                      </tr>
                    ))}
                    {qc.analyses.length === 0 && <tr><td colSpan={5} className="analysis-review__table-empty">Belum ada analisis.</td></tr>}
                  </tbody>
                </table>
              </div>
              {qc.readiness && (
                <section className="analysis-review__readiness" aria-label="Matriks kesiapan publikasi">
                  <h3 className="analysis-review__data-title">Kesiapan publikasi</h3>
                  <div className="analysis-review__table-wrap">
                    <table className="tbl tbl-wide analysis-review__table">
                      <thead><tr><th>Komponen</th><th>Status</th><th>Alasan</th></tr></thead>
                      <tbody>
                        {Object.entries(qc.readiness).map(([key, item]) => (
                          <tr key={key}>
                            <td>{humanizeKey(key)}</td>
                            <td><span className={`stat-badge ${["ready", "passed", "allowed"].includes(item.status) ? "badge-green" : "badge-amber"}`}>{item.status}</span></td>
                            <td>{item.reasons.length ? item.reasons.join("; ") : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </ReviewAccordion>

        <ReviewAccordion
          title="Tindakan publikasi"
          icon="bi-send-check"
          hint={selected?.result ? `Run #${selected.run.id}` : "Pilih hasil analisis"}
          defaultOpen={!!selected?.result}
        >
          {selected?.result ? (
            <div className="analysis-review__actions">
              {selected.result.features && (
                <button type="button" className="btn-sm" disabled={!selected.result.features.features.length} onClick={() => exportGeoJson(selected.result?.features, selected.run.id)}>
                  <i className="bi bi-download" aria-hidden="true" /> Export GeoJSON
                </button>
              )}
              {selected.result.is_published ? (
                <button type="button" className="btn-sm danger" disabled={busy} onClick={handleUnpublish}>
                  <i className="bi bi-eye-slash" aria-hidden="true" /> Batalkan publikasi
                </button>
              ) : (
                <button type="button" className="btn-sm primary" disabled={busy} onClick={handlePublish}>
                  <i className="bi bi-check2-circle" aria-hidden="true" /> Publikasikan
                </button>
              )}
              <button type="button" className="btn-sm" disabled={busy} onClick={handleRerun}>
                <i className="bi bi-arrow-repeat" aria-hidden="true" /> Jalankan ulang
              </button>
              {busy && <span className="analysis-review__busy" role="status"><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Memproses…</span>}
            </div>
          ) : <p className="analysis-review__empty-value">Pilih hasil analisis yang sudah selesai untuk menampilkan tindakan.</p>}
        </ReviewAccordion>
      </div>
    </section>
  );
}
