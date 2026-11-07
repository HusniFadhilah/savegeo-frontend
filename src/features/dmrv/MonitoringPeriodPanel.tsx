import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useI18nStore } from "@/hooks/useI18nStore";
import { ApiError } from "@/services/apiClient";
import { createMonitoringPeriod, listBoundaries, listMonitoringPeriods, newIdempotencyKey, updateMonitoringPeriod } from "./api";
import { describeDmrvError } from "./errors";
import type { BoundaryVersion, MonitoringPeriod } from "./types";

export default function MonitoringPeriodPanel({
  projectId,
  canWrite,
}: {
  projectId: string;
  canWrite: boolean;
}) {
  const t = useI18nStore((s) => s.t);
  const [periods, setPeriods] = useState<MonitoringPeriod[] | null>(null);
  const [boundaries, setBoundaries] = useState<BoundaryVersion[]>([]);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [boundaryVersion, setBoundaryVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [nextPeriods, nextBoundaries] = await Promise.all([
        listMonitoringPeriods(projectId),
        listBoundaries(projectId),
      ]);
      setPeriods(nextPeriods);
      setBoundaries(nextBoundaries);
      setBoundaryVersion((current) => current || (nextBoundaries[nextBoundaries.length - 1]?.version.toString() ?? ""));
      setError("");
    } catch (cause) {
      setPeriods([]);
      setError(describeDmrvError(cause, t));
    }
  }, [projectId, t]);

  useEffect(() => {
    setPeriods(null);
    setBoundaries([]);
    setName("");
    setStartDate("");
    setEndDate("");
    setBoundaryVersion("");
    setError("");
    setNotice("");
    let active = true;
    void Promise.all([listMonitoringPeriods(projectId), listBoundaries(projectId)])
      .then(([nextPeriods, nextBoundaries]) => {
        if (!active) return;
        setPeriods(nextPeriods);
        setBoundaries(nextBoundaries);
        setBoundaryVersion(nextBoundaries[nextBoundaries.length - 1]?.version.toString() ?? "");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setPeriods([]);
        setError(describeDmrvError(cause, t));
      });
    return () => { active = false; };
  }, [projectId, t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await createMonitoringPeriod(projectId, {
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        boundary_version: Number(boundaryVersion),
      }, newIdempotencyKey());
      setName("");
      await refresh();
      setNotice(t("dmrv.monitoring.created"));
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 403
        ? t("dmrv.monitoring.writeForbidden")
        : describeDmrvError(cause, t));
    } finally {
      setBusy(false);
    }
  }

  async function advance(period: MonitoringPeriod, status: "in_progress" | "completed") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await updateMonitoringPeriod(projectId, period, status);
      await refresh();
      setNotice(t("dmrv.monitoring.updated"));
    } catch (cause) {
      setError(describeDmrvError(cause, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card-body" aria-labelledby="dmrv-monitoring-heading">
      <h2 id="dmrv-monitoring-heading" className="h5">{t("dmrv.monitoring.heading")}</h2>
      <p className="text-muted small">{t("dmrv.monitoring.caveat")}</p>
      {error ? <div role="alert" className="alert alert-danger">{error}</div> : null}
      {notice ? <div role="status" className="alert alert-success">{notice}</div> : null}
      {!canWrite ? <p className="text-muted small">{t("dmrv.monitoring.readOnly")}</p> : null}

      {canWrite ? (
        <form className="row g-2 mb-3" onSubmit={(event) => void submit(event)}>
          <div className="col-12">
            <label className="form-label" htmlFor="dmrv-period-name">{t("dmrv.monitoring.name")}</label>
            <input id="dmrv-period-name" className="form-control" value={name} onChange={(event) => setName(event.target.value)} required maxLength={128} />
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="dmrv-period-start">{t("dmrv.monitoring.start")}</label>
            <input id="dmrv-period-start" className="form-control" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="dmrv-period-end">{t("dmrv.monitoring.end")}</label>
            <input id="dmrv-period-end" className="form-control" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} min={startDate || undefined} required />
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="dmrv-period-boundary">{t("dmrv.monitoring.boundary")}</label>
            <select id="dmrv-period-boundary" className="form-select" value={boundaryVersion} onChange={(event) => setBoundaryVersion(event.target.value)} required disabled={boundaries.length === 0}>
              {boundaries.map((boundary) => <option key={boundary.id} value={boundary.version}>{t("dmrv.boundary.version")} {boundary.version} · {boundary.checksum.slice(0, 10)}</option>)}
            </select>
          </div>
          <div className="col-12">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || boundaries.length === 0}>
              {busy ? t("dmrv.monitoring.saving") : t("dmrv.monitoring.create")}
            </button>
            {boundaries.length === 0 ? <span className="text-muted small ms-2">{t("dmrv.monitoring.boundaryRequired")}</span> : null}
          </div>
        </form>
      ) : null}

      {periods === null ? <p role="status">{t("dmrv.loading")}</p> : null}
      {periods?.length === 0 && !error ? <p className="text-muted">{t("dmrv.monitoring.empty")}</p> : null}
      {periods && periods.length > 0 ? (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead><tr>
              <th scope="col">{t("dmrv.monitoring.name")}</th>
              <th scope="col">{t("dmrv.monitoring.dates")}</th>
              <th scope="col">{t("dmrv.monitoring.boundary")}</th>
              <th scope="col">{t("dmrv.monitoring.statusHeading")}</th>
              <th scope="col">{t("dmrv.monitoring.actions")}</th>
            </tr></thead>
            <tbody>{periods.map((period) => (
              <tr key={period.id}>
                <td>{period.name}</td>
                <td>{period.start_date} – {period.end_date}</td>
                <td>v{period.boundary_version} · <code>{period.boundary_checksum.slice(0, 10)}</code></td>
                <td>{t(`dmrv.monitoring.status.${period.status}`)}</td>
                <td className="d-flex gap-2">
                  {canWrite && period.status === "planned" ? <button type="button" className="btn btn-outline-primary btn-sm" disabled={busy} onClick={() => void advance(period, "in_progress")}>{t("dmrv.monitoring.startAction")}</button> : null}
                  {canWrite && period.status === "in_progress" ? <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => void advance(period, "completed")}>{t("dmrv.monitoring.completeAction")}</button> : null}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
