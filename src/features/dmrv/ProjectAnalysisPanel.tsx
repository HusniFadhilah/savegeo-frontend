import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { formatNumber, useI18nStore } from "@/hooks/useI18nStore";
import { listMonitoringPeriods, newIdempotencyKey } from "./api";
import * as api from "./analysisApi";
import type { MonitoringPeriod } from "./types";
import SnapshotResultPanel from "./SnapshotResultPanel";

const PAGE_SIZE = 20;
const STATUS_LABELS = {
  queued: ["Mengantre", "Queued"],
  running: ["Berjalan", "Running"],
  succeeded: ["Selesai", "Completed"],
  failed: ["Gagal", "Failed"],
  cancelled: ["Dibatalkan", "Cancelled"],
} as const;

const KIND_LABELS: Record<api.AnalysisKind, [string, string]> = {
  carbon: ["Stok karbon", "Carbon stock"],
  landcover: ["Tutupan lahan", "Land cover"],
  landcover_transition: ["Perubahan tutupan lahan", "Land cover change"],
  vegetation: ["Indeks vegetasi", "Vegetation indices"],
};

export default function ProjectAnalysisPanel({
  projectId,
  organizationId,
  canRun,
}: {
  projectId: string;
  organizationId?: string | null;
  canRun: boolean;
}) {
  const language = useI18nStore((s) => s.language);
  const en = language === "en";
  const tr = (id: string, english: string) => (en ? english : id);
  const [query, setQuery] = useSearchParams();
  const periodId = query.get("period") || "";
  const snapshotId = query.get("snapshot") || "";
  const [periods, setPeriods] = useState<MonitoringPeriod[]>([]);
  const requestedKind = query.get("analysis_kind") || "carbon";
  const kind: api.AnalysisKind = Object.prototype.hasOwnProperty.call(KIND_LABELS, requestedKind)
    ? (requestedKind as api.AnalysisKind)
    : "carbon";
  const baseline = query.get("baseline_period") || "";
  const pageValue = Number(query.get("analysis_page") || "1");
  const page =
    Number.isSafeInteger(pageValue) && pageValue > 0 && pageValue <= 100000 ? pageValue : 1;
  const availablePeriods = periods.filter((p) => p.status !== "planned");
  const selectedPeriod = availablePeriods.find((p) => p.id === periodId);
  const baselinePeriods = availablePeriods.filter((p) => p.id !== periodId);
  const validBaseline = baselinePeriods.some((p) => p.id === baseline);
  function updateQuery(values: Record<string, string | null>, resetPage = true) {
    setQuery((previous) => {
      const next = new URLSearchParams(previous);
      if (resetPage) next.delete("analysis_page");
      for (const [key, value] of Object.entries(values)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  }
  const [rows, setRows] = useState<api.AnalysisRun[] | null>(null);
  const [usage, setUsage] = useState<api.UsageSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const guard = useRef(false);
  const attempt = useRef<{ body: string; key: string } | null>(null);

  useEffect(() => {
    let active = true;
    setPeriods([]);
    setRows(null);
    setUsage(null);
    setError("");
    listMonitoringPeriods(projectId)
      .then((result) => {
        if (active) setPeriods(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load periods");
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const [runs, quota] = await Promise.all([
          api.listAnalysisRuns(projectId, periodId, PAGE_SIZE, (page - 1) * PAGE_SIZE),
          organizationId ? api.getWorkspaceUsage(organizationId) : Promise.resolve(null),
        ]);
        if (!active) return;
        setRows(runs);
        setUsage(quota);
        setError("");
        if (runs.some(({ job }) => job.status === "queued" || job.status === "running"))
          timer = setTimeout(() => void poll(), 3000);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load analyses");
      }
    }
    setRows(null);
    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [projectId, organizationId, periodId, page, refresh]);

  async function run(action: () => Promise<void>) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      setRefresh((n) => n + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr("Tindakan gagal.", "Operation failed."));
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }

  function submit() {
    if (!canRun || !selectedPeriod || (kind === "landcover_transition" && !validBaseline)) return;
    const request: api.AnalysisRequest = {
      kind,
      monitoring_period_id: periodId,
      ...(kind === "landcover_transition" ? { baseline_period_id: baseline } : {}),
      parameters: {},
    };
    const body = JSON.stringify({ projectId, request });
    if (attempt.current?.body !== body) attempt.current = { body, key: newIdempotencyKey() };
    const key = attempt.current.key;
    void run(async () => {
      await api.createAnalysisRun(projectId, request, key);
      attempt.current = null;
    });
  }

  if (!organizationId)
    return (
      <div className="alert alert-info">
        {tr(
          "Analisis proyek dengan kuota memerlukan ruang kerja organisasi.",
          "Metered project analysis requires an organization workspace.",
        )}{" "}
        <Link to="/organizations">{tr("Kelola organisasi", "Manage organizations")}</Link>
      </div>
    );
  return (
    <section className="card">
      <div className="card-header text-white d-flex align-items-center justify-content-between gap-2">
        <span>
          <i className="bi bi-cpu me-2" aria-hidden="true" />
          {tr("Analisis proyek", "Project analyses")}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-outline-light"
          disabled={busy}
          onClick={() => setRefresh((n) => n + 1)}
          aria-label={tr("Muat ulang analisis", "Refresh analyses")}
        >
          <i className="bi bi-arrow-clockwise" aria-hidden="true" />
        </button>
      </div>
      <div className="card-body">
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        {usage && (
          <div className="d-flex flex-wrap gap-3 small mb-3" role="status">
            <span>
              <i className="bi bi-speedometer2 me-1" aria-hidden="true" />
              {tr("Terpakai", "Used")}: <strong>{usage.used}</strong> / {usage.limit}
            </span>
            <span>
              {tr("Dalam antrean/proses", "Reserved")}: <strong>{usage.reserved}</strong>
            </span>
            <span>
              {tr("Tersisa", "Remaining")}: <strong>{usage.remaining}</strong>
            </span>
            <span className="text-body-secondary">
              {tr(
                "Satuan: pekerjaan analisis • siklus bulanan UTC",
                "Unit: analysis run • monthly UTC cycle",
              )}
            </span>
          </div>
        )}
        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <label className="form-label" htmlFor="analysis-period">
              {tr("Periode monitoring", "Monitoring period")}
            </label>
            <select
              className="form-select"
              id="analysis-period"
              value={periodId}
              disabled={busy}
              onChange={(e) => updateQuery({ period: e.target.value, baseline_period: null })}
            >
              <option value="">{tr("Pilih periode", "Choose period")}</option>
              {periods
                .filter((p) => p.status !== "planned")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.start_date} – {p.end_date}
                  </option>
                ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="project-analysis-kind">
              {tr("Jenis analisis", "Analysis type")}
            </label>
            <select
              className="form-select"
              id="project-analysis-kind"
              value={kind}
              disabled={busy}
              onChange={(e) =>
                updateQuery({ analysis_kind: e.target.value, baseline_period: null })
              }
            >
              {Object.entries(KIND_LABELS).map(([value, labels]) => (
                <option key={value} value={value}>
                  {labels[en ? 1 : 0]}
                </option>
              ))}
            </select>
          </div>
          {kind === "landcover_transition" && (
            <div className="col-md-4">
              <label className="form-label" htmlFor="analysis-baseline">
                {tr("Tahun dasar", "Baseline")}
              </label>
              <select
                id="analysis-baseline"
                className="form-select"
                value={baseline}
                disabled={busy}
                onChange={(e) => updateQuery({ baseline_period: e.target.value })}
              >
                <option value="">{tr("Pilih baseline", "Choose baseline")}</option>
                {periods
                  .filter((p) => p.status !== "planned" && p.id !== periodId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
        <p className="small text-body-secondary">
          {tr(
            "AOI mengikuti versi batas pada periode. Karbon, vegetasi, dan perubahan lahan memakai bulan penuh dalam satu tahun. Hasil tersimpan sebagai snapshot; kegagalan atau pembatalan melepas kuota.",
            "AOI follows the period boundary version. Carbon, vegetation, and change analyses require full months in one year. Results are saved as snapshots; failed or cancelled runs release quota.",
          )}
        </p>
        {canRun && (
          <button
            type="button"
            className="btn btn-success mb-3"
            disabled={
              busy ||
              !selectedPeriod ||
              (kind === "landcover_transition" && !validBaseline) ||
              usage?.remaining === 0
            }
            onClick={submit}
          >
            <i className="bi bi-play-fill me-1" aria-hidden="true" />
            {busy ? tr("Memproses…", "Processing…") : tr("Jalankan analisis", "Run analysis")}
          </button>
        )}
        {rows === null ? (
          <p role="status">{tr("Memuat analisis…", "Loading analyses…")}</p>
        ) : rows.length === 0 ? (
          <p>{tr("Belum ada pekerjaan untuk filter ini.", "No analysis runs for this filter.")}</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>No</th>
                  <th>{tr("Analisis", "Analysis")}</th>
                  <th>{tr("Periode dan batas", "Period and boundary")}</th>
                  <th>Status</th>
                  <th>{tr("Aksi", "Action")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ job, context }, i) => (
                  <tr key={job.id}>
                    <td>{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td>
                      {KIND_LABELS[job.kind.replace("analysis.", "") as api.AnalysisKind]?.[
                        en ? 1 : 0
                      ] || job.kind}
                      <div className="small text-body-secondary">
                        {new Date(job.created_at || "").toLocaleString(en ? "en-GB" : "id-ID")}
                      </div>
                    </td>
                    <td>
                      {context.period.start} – {context.period.end}
                      <div className="small text-body-secondary">
                        v{context.boundary.version} ·{" "}
                        {formatNumber(context.boundary.area_ha, language, {
                          maximumFractionDigits: 2,
                        })}{" "}
                        ha
                      </div>
                    </td>
                    <td>
                      {STATUS_LABELS[job.status][en ? 1 : 0]}
                      <div className="small text-danger">
                        {typeof job.error?.message === "string" ? job.error.message : ""}
                      </div>
                    </td>
                    <td>
                      {canRun && ["queued", "running"].includes(job.status) && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          disabled={busy || job.cancel_requested}
                          onClick={() =>
                            void run(async () => {
                              await api.cancelAnalysisRun(projectId, job.id);
                            })
                          }
                        >
                          {job.cancel_requested
                            ? tr("Membatalkan…", "Cancelling…")
                            : tr("Batalkan", "Cancel")}
                        </button>
                      )}
                      {job.status === "succeeded" &&
                        typeof job.result?.snapshot_id === "string" && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success"
                            onClick={() =>
                              updateQuery({ snapshot: String(job.result?.snapshot_id) }, false)
                            }
                          >
                            <i className="bi bi-journal-check me-1" aria-hidden="true" />
                            {tr("Lihat hasil", "View result")}
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows !== null && (page > 1 || rows.length === PAGE_SIZE) && (
          <nav
            className="d-flex align-items-center justify-content-between gap-2 mt-3"
            aria-label={tr("Halaman riwayat analisis", "Analysis history pages")}
          >
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={busy || page === 1}
              onClick={() => updateQuery({ analysis_page: String(page - 1) }, false)}
            >
              {tr("Sebelumnya", "Previous")}
            </button>
            <span role="status">
              {tr("Halaman", "Page")} {page}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={busy || rows.length < PAGE_SIZE}
              onClick={() => updateQuery({ analysis_page: String(page + 1) }, false)}
            >
              {tr("Berikutnya", "Next")}
            </button>
          </nav>
        )}
        {snapshotId && (
          <SnapshotResultPanel
            key={`${projectId}:${snapshotId}`}
            projectId={projectId}
            snapshotId={snapshotId}
            onClose={() => updateQuery({ snapshot: null }, false)}
          />
        )}
      </div>
    </section>
  );
}
