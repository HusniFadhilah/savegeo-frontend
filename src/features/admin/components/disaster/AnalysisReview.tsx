import { AdminTableNumberCell, AdminTableNumberHeader } from "@/features/admin/components/AdminTableNumber";
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
import { useI18nStore } from "@/hooks/useI18nStore";

const RUN_STATUS_KEYS: Record<string, string> = {
  queued: "admin.disaster.queuedStatus", processing: "admin.disaster.processingStatus", completed: "admin.disaster.completedStatus",
  failed: "admin.disaster.failedStatus", review_required: "admin.disaster.reviewRequiredStatus", published: "admin.disaster.published", stale: "admin.disaster.staleStatus",
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

function DataTable({ title, values, emptyLabel, t }: { title: string; values: Record<string, unknown> | null | undefined; emptyLabel: string; t: (key: string) => string }) {
  const entries = Object.entries(values ?? {});
  return (
    <section className="analysis-review__data-group" aria-label={title}>
      <h3 className="analysis-review__data-title">{title}</h3>
      {entries.length > 0 ? (
        <div className="analysis-review__table-wrap">
          <table className="tbl analysis-review__table">
            <thead><tr><AdminTableNumberHeader /><th scope="col">{t("admin.disaster.dataLabel")}</th><th scope="col">{t("admin.disaster.valueLabel")}</th></tr></thead>
            <tbody>
              {entries.map(([key, value], index) => (
                <tr key={key}>
                  <AdminTableNumberCell index={index} />
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
  const t = useI18nStore((state) => state.t);
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
      .catch((error) => setQcError(error instanceof Error ? error.message : t("admin.disaster.loadQcFailed")))
      .finally(() => setQcLoading(false));
  };

  useEffect(() => {
    loadQc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, runs, t]);

  const selected = reviewable.find((run) => run.run.id === selectedRunId) ?? null;

  const handlePublish = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await publishAnalysis(selected.run.id);
      notify(t("admin.disaster.publishResult"), "s");
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : t("admin.disaster.publishFailed"), "e");
    } finally {
      setBusy(false);
    }
  };

  const handleUnpublish = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await unpublishAnalysis(selected.run.id);
      notify(t("admin.disaster.unpublishResult"), "s");
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : t("admin.disaster.unpublishFailed"), "e");
    } finally {
      setBusy(false);
    }
  };

  const handleRerun = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await runAnalysis(selected.run.id, true);
      notify(t("admin.disaster.rerunResult"), "s");
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : t("admin.disaster.rerunFailed"), "e");
    } finally {
      setBusy(false);
    }
  };

  const qcStatus = qcLoading ? t("admin.disaster.qcLoading") : qcError ? t("admin.disaster.qcProblem") : qc?.ready_to_publish ? t("admin.disaster.readyToPublish") : t("admin.disaster.needsReview");
  const qcBadgeClass = qc?.ready_to_publish && !qcLoading && !qcError ? "badge-green" : "badge-amber";

  return (
    <section className="card analysis-review" aria-label={t("admin.disaster.reviewAria")}>
      <header className="analysis-review__header">
        <div className="analysis-review__title-wrap">
          <span className="analysis-review__title-icon" aria-hidden="true"><i className="bi bi-clipboard2-check" /></span>
          <div>
            <h2 className="analysis-review__title">{t("admin.disaster.reviewTitle")}</h2>
            <p className="analysis-review__subtitle">{t("admin.disaster.reviewSubtitle")}</p>
          </div>
        </div>
        <label className="analysis-review__run-select">
          <span>{t("admin.disaster.analysisResults")}</span>
          <select
            className="form-input"
            value={selectedRunId ?? ""}
            onChange={(event) => setSelectedRunId(event.target.value ? Number(event.target.value) : null)}
            disabled={reviewable.length === 0}
          >
            <option value="">{t("admin.disaster.chooseAnalysisResult")}</option>
            {reviewable.map(({ run }) => (
              <option key={run.id} value={run.id}>
                {run.model_id} — Run #{run.id} ({RUN_STATUS_KEYS[run.status] ? t(RUN_STATUS_KEYS[run.status]) : run.status})
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
              <strong>{t("admin.disaster.resultEmpty")}</strong>
              <p>{t("admin.disaster.runAnalysisFirstText")}</p>
            </div>
          </div>
        )}

        {selected?.result && (
          <>
            <ReviewAccordion
              title={t("admin.disaster.mapResult")}
              icon="bi-map"
              hint={`${selected.run.model_id} · Run #${selected.run.id}`}
              trailing={<span className={`stat-badge ${selected.result.is_published ? "badge-green" : "badge-amber"}`}>{selected.result.is_published ? t("admin.disaster.resultPublished") : t("admin.disaster.resultDraft")}</span>}
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
              <ReviewAccordion title={t("admin.disaster.legend")} icon="bi-palette" hint={`${selected.result.legend.length} ${t("admin.disaster.classes")}`}>
                <MapLegend entries={selected.result.legend.map((item) => ({ color: item.color, label: item.label }))} />
              </ReviewAccordion>
            )}

            <ReviewAccordion title={t("admin.disaster.statsConfidence")} icon="bi-bar-chart-line" hint={t("admin.disaster.coverageConfidenceHint")}>
              {selected.result.review_reasons?.length ? (
                <div className="alert alert-warning analysis-review__notice">
                  <i className="bi bi-exclamation-triangle" aria-hidden="true" />
                  <span><strong>{t("admin.disaster.requiresAttention")}</strong> {selected.result.review_reasons.join("; ")}</span>
                </div>
              ) : null}
              {selected.result.coverage && (
                <div className="analysis-review__coverage" aria-label={t("admin.disaster.coverageResult")}>
                  <div><span>{t("admin.disaster.validCoverage")}</span><strong>{renderValue(selected.result.coverage.coverage_pct)}%</strong></div>
                  <div><span>{t("admin.disaster.validArea")}</span><strong>{renderValue(selected.result.coverage.valid_area_ha)} ha</strong></div>
                  <div><span>{t("admin.disaster.noData")}</span><strong>{renderValue(selected.result.coverage.no_data_area_ha)} ha</strong></div>
                </div>
              )}
              <div className="analysis-review__data-grid">
                <DataTable title={t("admin.disaster.resultStats")} values={selected.result.statistics} emptyLabel={t("admin.disaster.noStats")} t={t} />
                <DataTable title={t("admin.disaster.confidenceSummary")} values={selected.result.confidence_summary} emptyLabel={t("admin.disaster.noConfidence")} t={t} />
              </div>
            </ReviewAccordion>
          </>
        )}

        <ReviewAccordion
          title={t("admin.disaster.qcReadiness")}
          icon="bi-shield-check"
          hint={t("admin.disaster.qcChecklist")}
          trailing={<span className={`stat-badge ${qcBadgeClass}`}>{qcStatus}</span>}
        >
          {qcLoading && <p className="analysis-review__empty-value" role="status">{t("admin.disaster.loadingQc")}</p>}
          {qcError && <div className="alert alert-danger analysis-review__notice" role="alert">{qcError}</div>}
          {qc && !qcLoading && (
            <>
              <div className="analysis-review__checklist">
                {([
                  ["aoi_configured", t("admin.disaster.aoiConfigured")],
                  ["pre_imagery_available", t("admin.disaster.preImageryAvailable")],
                  ["post_imagery_available", t("admin.disaster.postImageryAvailable")],
                ] as const).map(([key, label]) => (
                  <span className={`analysis-review__check ${qc[key] ? "is-ready" : "is-missing"}`} key={key}>
                    <i className={`bi ${qc[key] ? "bi-check-circle-fill" : "bi-x-circle-fill"}`} aria-hidden="true" />
                    {label}
                  </span>
                ))}
              </div>
              <div className="analysis-review__table-wrap">
                <table className="tbl tbl-wide analysis-review__table">
                  <thead><tr><AdminTableNumberHeader /><th>{t("admin.disaster.model")}</th><th>{t("admin.disaster.status")}</th><th>{t("admin.disaster.statistics")}</th><th>{t("admin.disaster.legendColumn")}</th><th>{t("admin.disaster.confidence")}</th></tr></thead>
                  <tbody>
                    {qc.analyses.map((analysis, index) => (
                      <tr key={`${analysis.model_id}-${index}`}>
                        <AdminTableNumberCell index={index} />
                        <td>{analysis.model_id}</td>
                        <td>{RUN_STATUS_KEYS[analysis.status] ? t(RUN_STATUS_KEYS[analysis.status]) : analysis.status}</td>
                        <td>{analysis.has_statistics ? "✓" : "—"}</td>
                        <td>{analysis.has_legend ? "✓" : "—"}</td>
                        <td>{analysis.has_confidence ? "✓" : "—"}</td>
                      </tr>
                    ))}
                    {qc.analyses.length === 0 && <tr><td colSpan={6} className="analysis-review__table-empty">{t("admin.disaster.noRows")}</td></tr>}
                  </tbody>
                </table>
              </div>
              {qc.readiness && (
                <section className="analysis-review__readiness" aria-label={t("admin.disaster.publicationMatrix")}>
                  <h3 className="analysis-review__data-title">{t("admin.disaster.publicationReadiness")}</h3>
                  <div className="analysis-review__table-wrap">
                    <table className="tbl tbl-wide analysis-review__table">
                      <thead><tr><AdminTableNumberHeader /><th>{t("admin.disaster.component")}</th><th>{t("admin.disaster.status")}</th><th>{t("admin.disaster.reason")}</th></tr></thead>
                      <tbody>
                        {Object.entries(qc.readiness).map(([key, item], index) => (
                          <tr key={key}>
                            <AdminTableNumberCell index={index} />
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
          title={t("admin.disaster.publicationAction")}
          icon="bi-send-check"
          hint={selected?.result ? `Run #${selected.run.id}` : t("admin.disaster.selectAnalysisHint")}
          defaultOpen={!!selected?.result}
        >
          {selected?.result ? (
            <div className="analysis-review__actions">
              {selected.result.features && (
                <button type="button" className="btn-sm" disabled={!selected.result.features.features.length} onClick={() => exportGeoJson(selected.result?.features, selected.run.id)}>
                  <i className="bi bi-download" aria-hidden="true" /> {t("admin.disaster.exportGeoJson")}
                </button>
              )}
              {selected.result.is_published ? (
                <button type="button" className="btn-sm danger" disabled={busy} onClick={handleUnpublish}>
                  <i className="bi bi-eye-slash" aria-hidden="true" /> {t("admin.disaster.unpublish")}
                </button>
              ) : (
                <button type="button" className="btn-sm primary" disabled={busy} onClick={handlePublish}>
                  <i className="bi bi-check2-circle" aria-hidden="true" /> {t("admin.disaster.publish")}
                </button>
              )}
              <button type="button" className="btn-sm" disabled={busy} onClick={handleRerun}>
                <i className="bi bi-arrow-repeat" aria-hidden="true" /> {t("admin.disaster.runAgainButton")}
              </button>
              {busy && <span className="analysis-review__busy" role="status"><span className="spinner-border spinner-border-sm" aria-hidden="true" /> {t("admin.disaster.processing")}</span>}
            </div>
          ) : <p className="analysis-review__empty-value">{t("admin.disaster.selectAnalysis")}</p>}
        </ReviewAccordion>
      </div>
    </section>
  );
}
