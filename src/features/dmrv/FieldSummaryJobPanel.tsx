import { useCallback, useEffect, useRef, useState } from "react";
import { formatNumber, useI18nStore } from "@/hooks/useI18nStore";
import { ApiError } from "@/services/apiClient";
import {
  cancelDmrvJob,
  createFieldSummaryJob,
  getDmrvSnapshot,
  listDmrvJobs,
  listMonitoringPeriods,
  newIdempotencyKey,
} from "./api";
import { describeDmrvError } from "./errors";
import type { DmrvJob, DmrvSnapshot, MonitoringPeriod } from "./types";

function stringField(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

export default function FieldSummaryJobPanel({
  projectId,
  canRun,
}: {
  projectId: string;
  canRun: boolean;
}) {
  const t = useI18nStore((s) => s.t);
  const language = useI18nStore((s) => s.language);
  const [jobs, setJobs] = useState<DmrvJob[] | null>(null);
  const [periods, setPeriods] = useState<MonitoringPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [snapshot, setSnapshot] = useState<DmrvSnapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState("");
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const inFlight = useRef(false);
  const attempt = useRef<{ projectId: string; periodId: string; key: string } | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      return { rows: await listDmrvJobs(projectId), error: "" };
    } catch (cause) {
      return { rows: [], error: describeDmrvError(cause, t) };
    }
  }, [projectId, t]);

  useEffect(() => {
    setJobs(null);
    setError("");
    setSnapshot(null);
    setSnapshotError("");
    setSnapshotLoading(false);
  }, [projectId]);

  useEffect(() => {
    let active = true;
    setPeriods([]);
    setSelectedPeriodId("");
    void listMonitoringPeriods(projectId)
      .then((rows) => { if (active) setPeriods(rows); })
      .catch(() => { if (active) setPeriods([]); });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      const result = await loadJobs();
      if (!active) return;
      setJobs(result.rows);
      setError(result.error);
      if (result.rows.some((job) => job.status === "queued" || job.status === "running")) {
        timer = setTimeout(() => void poll(), 2000);
      }
    }
    void poll();
    return () => {
      active = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [loadJobs, refreshKey]);

  async function submit() {
    if (!canRun || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    if (attempt.current?.projectId !== projectId || attempt.current.periodId !== selectedPeriodId) {
      attempt.current = { projectId, periodId: selectedPeriodId, key: newIdempotencyKey() };
    }
    try {
      await createFieldSummaryJob(projectId, attempt.current.key, selectedPeriodId || undefined);
      attempt.current = null;
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 403
        ? t("dmrv.jobs.runForbidden")
        : describeDmrvError(cause, t));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  async function cancel(jobId: string) {
    setError("");
    try {
      await cancelDmrvJob(projectId, jobId);
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(describeDmrvError(cause, t));
    }
  }

  async function showSnapshot(job: DmrvJob) {
    const snapshotId = stringField(job.result, "snapshot_id");
    if (!snapshotId) return;
    setSnapshot(null);
    setSnapshotError("");
    setSnapshotLoading(true);
    try {
      setSnapshot(await getDmrvSnapshot(projectId, snapshotId));
    } catch (cause) {
      setSnapshotError(describeDmrvError(cause, t));
    } finally {
      setSnapshotLoading(false);
    }
  }

  return (
    <section className="card card-body mb-3" aria-labelledby="dmrv-field-summary-heading">
      <h3 id="dmrv-field-summary-heading" className="h6">{t("dmrv.jobs.heading")}</h3>
      <p className="text-muted small">{t("dmrv.jobs.description")}</p>
      {error ? <div role="alert" className="alert alert-danger">{error}</div> : null}
      {!canRun ? <p className="text-muted small">{t("dmrv.jobs.readOnly")}</p> : null}
      {canRun ? (
        <div className="row g-2 align-items-end mb-3">
          {periods.length > 0 ? (
            <div className="col-md-7">
              <label className="form-label" htmlFor="dmrv-summary-period">{t("dmrv.jobs.periodLabel")}</label>
              <select id="dmrv-summary-period" className="form-select form-select-sm" value={selectedPeriodId} onChange={(event) => setSelectedPeriodId(event.target.value)}>
                <option value="">{t("dmrv.jobs.allPeriods")}</option>
                {periods.map((period) => (
                  <option key={period.id} value={period.id} disabled={period.status === "planned"}>
                    {period.name} · {t(`dmrv.monitoring.status.${period.status}`)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="col-auto">
            <button type="button" className="btn btn-outline-primary btn-sm" disabled={pending} onClick={() => void submit()}>
              {pending ? t("dmrv.jobs.submitting") : t("dmrv.jobs.submit")}
            </button>
          </div>
        </div>
      ) : null}

      {jobs === null ? <p role="status">{t("dmrv.loading")}</p> : null}
      {jobs?.length === 0 && !error ? <p className="text-muted small">{t("dmrv.jobs.empty")}</p> : null}
      {jobs && jobs.length > 0 ? (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th scope="col">{t("dmrv.jobs.created")}</th>
                <th scope="col">{t("dmrv.jobs.statusHeading")}</th>
                <th scope="col">{t("dmrv.jobs.progress")}</th>
                <th scope="col">{t("dmrv.jobs.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const stage = typeof job.progress.stage === "string" ? job.progress.stage : null;
                const timestamp = job.created_at
                  ? new Date(job.created_at).toLocaleString(language === "id" ? "id-ID" : "en-US")
                  : "-";
                const canCancel = canRun && (job.status === "queued" || job.status === "running") && !job.cancel_requested;
                return (
                  <tr key={job.id}>
                    <td><code>{job.id.slice(0, 8)}</code><br /><small>{timestamp}</small></td>
                    <td>{t(`dmrv.jobs.status.${job.status}`)}</td>
                    <td>
                      {stage ? `${t("dmrv.jobs.stage")}: ${stage}` : "-"}
                      {typeof job.error?.message === "string" ? <small className="text-danger d-block">{job.error.message}</small> : null}
                      {job.cancel_requested && job.status === "running" ? <small className="d-block">{t("dmrv.jobs.cancelling")}</small> : null}
                    </td>
                    <td className="d-flex gap-2">
                      {canCancel ? <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void cancel(job.id)}>{t("dmrv.jobs.cancel")}</button> : null}
                      {job.status === "succeeded" && stringField(job.result, "snapshot_id") ? (
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void showSnapshot(job)}>{t("dmrv.jobs.viewSnapshot")}</button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {snapshotLoading ? <p role="status" className="mt-3">{t("dmrv.loading")}</p> : null}
      {snapshotError ? <div role="alert" className="alert alert-danger mt-3">{snapshotError}</div> : null}
      {snapshot ? (
        <div className="alert alert-info mt-3 mb-0">
          <strong>{t("dmrv.jobs.snapshotTitle")}</strong>
          <p className="small mb-2">{t("dmrv.jobs.snapshotCaveat")}</p>
          <dl className="row mb-0">
            <dt className="col-sm-4">{t("dmrv.jobs.snapshotHash")}</dt>
            <dd className="col-sm-8"><code>{snapshot.snapshot_hash}</code></dd>
            <dt className="col-sm-4">{t("dmrv.jobs.plotsTotal")}</dt>
            <dd className="col-sm-8">{formatNumber(Number((snapshot.outputs.counts as Record<string, unknown> | undefined)?.plots_total ?? 0), language)}</dd>
            <dt className="col-sm-4">{t("dmrv.jobs.plotsWithDensity")}</dt>
            <dd className="col-sm-8">{formatNumber(Number((snapshot.outputs.counts as Record<string, unknown> | undefined)?.plots_with_density ?? 0), language)}</dd>
            <dt className="col-sm-4">{t("dmrv.jobs.plotsBlocked")}</dt>
            <dd className="col-sm-8">{formatNumber(Number((snapshot.outputs.counts as Record<string, unknown> | undefined)?.plots_blocked ?? 0), language)}</dd>
            <dt className="col-sm-4">{t("dmrv.jobs.plotsWithoutPeriodMeasurements")}</dt>
            <dd className="col-sm-8">{formatNumber(Number((snapshot.outputs.counts as Record<string, unknown> | undefined)?.plots_without_period_measurements ?? 0), language)}</dd>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
