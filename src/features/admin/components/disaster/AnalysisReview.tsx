import { useEffect, useMemo, useState } from "react";
import MapView from "@/components/map/MapView";
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
};

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString("id-ID", { maximumFractionDigits: 3 });
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

interface Props {
  eventId: number;
  runs: AnalysisRunWithResult[];
  onChanged: () => void;
}

/** Statistics/QC/publish workspace for a single event's analysis runs. Admin
 * sees every run (published or not) - `AnalysisResult.to_dict()` already
 * omits `features` unless explicitly requested, so this never renders a
 * per-feature UI (MVP has none of that data anyway). */
export default function AnalysisReview({ eventId, runs, onChanged }: Props) {
  const { notify } = useAdmin();
  const reviewable = useMemo(() => runs.filter((r) => r.result), [runs]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(reviewable[0]?.run.id ?? null);
  const [qc, setQc] = useState<DisasterQcStatus | null>(null);
  const [qcLoading, setQcLoading] = useState(true);
  const [qcError, setQcError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!reviewable.some((r) => r.run.id === selectedRunId)) {
      setSelectedRunId(reviewable[0]?.run.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs]);

  const loadQc = () => {
    setQcLoading(true);
    setQcError(null);
    getDisasterQc(eventId)
      .then(setQc)
      .catch((err) => setQcError(err instanceof Error ? err.message : "Gagal memuat status QC"))
      .finally(() => setQcLoading(false));
  };

  useEffect(() => {
    loadQc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, runs]);

  const selected = reviewable.find((r) => r.run.id === selectedRunId) ?? null;

  const handlePublish = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await publishAnalysis(selected.run.id);
      notify("Hasil analisis dipublikasikan", "s");
      onChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal mempublikasikan", "e");
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
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal membatalkan publikasi", "e");
    } finally {
      setBusy(false);
    }
  };

  const handleRerun = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await runAnalysis(selected.run.id);
      notify("Analisis dijalankan ulang", "s");
      onChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal menjalankan ulang analisis", "e");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>Analysis Review</span>
        <select
          className="form-input"
          style={{ maxWidth: 260 }}
          value={selectedRunId ?? ""}
          onChange={(e) => setSelectedRunId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— pilih hasil analisis —</option>
          {reviewable.map(({ run }) => (
            <option key={run.id} value={run.id}>
              {run.model_id} — Run #{run.id} ({RUN_STATUS_LABEL[run.status] || run.status})
            </option>
          ))}
        </select>
      </div>
      <div className="card-body-custom">
        {reviewable.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 8 }}>
            Belum ada hasil analisis untuk ditinjau. Jalankan analisis di tab Analysis terlebih dahulu.
          </div>
        )}

        {selected && selected.result && (
          <>
            <div style={{ marginBottom: 10 }}>
              <MapView id={`disaster-review-map-${eventId}`}>
                {selected.result.tile_url && (
                  <ResultTileLayer
                    layerKey={`review-${selected.run.id}`}
                    tileUrl={selected.result.tile_url}
                    opacity={0.85}
                  />
                )}
              </MapView>
              {selected.result.legend.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <MapLegend title="Legenda" entries={selected.result.legend.map((l) => ({ color: l.color, label: l.label }))} />
                </div>
              )}
            </div>

            <div className="two-col" style={{ marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Statistik</div>
                {selected.result.statistics && Object.keys(selected.result.statistics).length > 0 ? (
                  <table className="tbl">
                    <tbody>
                      {Object.entries(selected.result.statistics).map(([k, v]) => (
                        <tr key={k}>
                          <td style={{ fontWeight: 500, width: "45%" }}>{k}</td>
                          <td>{renderValue(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Tidak ada statistik.</div>
                )}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Ringkasan Kepercayaan</div>
                {selected.result.confidence_summary && Object.keys(selected.result.confidence_summary).length > 0 ? (
                  <table className="tbl">
                    <tbody>
                      {Object.entries(selected.result.confidence_summary).map(([k, v]) => (
                        <tr key={k}>
                          <td style={{ fontWeight: 500, width: "45%" }}>{k}</td>
                          <td>{renderValue(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Tidak tersedia.</div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              {selected.result.is_published ? (
                <button type="button" className="btn-sm danger" disabled={busy} onClick={handleUnpublish}>
                  <i className="bi bi-eye-slash" /> Unpublish
                </button>
              ) : (
                <button type="button" className="btn-sm primary" disabled={busy} onClick={handlePublish}>
                  <i className="bi bi-check2-circle" /> Publish
                </button>
              )}
              <button type="button" className="btn-sm" disabled={busy} onClick={handleRerun}>
                <i className="bi bi-arrow-repeat" /> Jalankan Ulang
              </button>
            </div>
          </>
        )}

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>QC Checklist</div>
          {qcLoading && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Memuat...</div>}
          {qcError && <div className="alert alert-danger py-1 px-2 small">{qcError}</div>}
          {qc && !qcLoading && (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8, fontSize: 12 }}>
                <span>
                  <i className={`bi ${qc.aoi_configured ? "bi-check-circle-fill text-success" : "bi-x-circle-fill text-danger"}`} /> AOI dikonfigurasi
                </span>
                <span>
                  <i className={`bi ${qc.pre_imagery_available ? "bi-check-circle-fill text-success" : "bi-x-circle-fill text-danger"}`} /> Citra pra-bencana tersedia
                </span>
                <span>
                  <i className={`bi ${qc.post_imagery_available ? "bi-check-circle-fill text-success" : "bi-x-circle-fill text-danger"}`} /> Citra pasca-bencana tersedia
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="tbl tbl-wide" style={{ marginBottom: 8 }}>
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Status</th>
                      <th>Statistik</th>
                      <th>Legenda</th>
                      <th>Kepercayaan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qc.analyses.map((a, i) => (
                      <tr key={`${a.model_id}-${i}`}>
                        <td>{a.model_id}</td>
                        <td>{RUN_STATUS_LABEL[a.status] || a.status}</td>
                        <td>{a.has_statistics ? "✓" : "—"}</td>
                        <td>{a.has_legend ? "✓" : "—"}</td>
                        <td>{a.has_confidence ? "✓" : "—"}</td>
                      </tr>
                    ))}
                    {qc.analyses.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                          Belum ada analisis.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
              <span className={`stat-badge ${qc.ready_to_publish ? "badge-green" : "badge-amber"}`}>
                {qc.ready_to_publish ? "Siap dipublikasikan" : "Belum siap dipublikasikan"}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
