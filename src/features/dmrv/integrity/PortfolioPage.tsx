import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import DmrvPageHeader from "../DmrvPageHeader";
import { getPortfolio, getPortfolioDashboard, saveBlob, type PortfolioDashboard } from "./api";
import { errorMessage, number, useCopy } from "./helpers";
import type { Portfolio } from "./types";
import "./integrity.css";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${(/^[=+@-]/.test(text) ? "'" : "") + text.replace(/"/g, '""')}"`;
}
export default function PortfolioPage() {
  const c = useCopy();
  const [data, setData] = useState<Portfolio | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [year, setYear] = useState("");
  const [dashboard, setDashboard] = useState<PortfolioDashboard | null>(null);
  const [dashboardError, setDashboardError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setDashboardError("");
    void Promise.allSettled([
      getPortfolio(search, offset),
      getPortfolioDashboard(year ? Number(year) : undefined),
    ])
      .then(([portfolioResult, dashboardResult]) => {
        if (!active) return;
        if (portfolioResult.status === "fulfilled") {
          setData(portfolioResult.value);
        } else {
          setError(errorMessage(portfolioResult.reason));
          setData(null);
        }
        if (dashboardResult.status === "fulfilled") {
          setDashboard(dashboardResult.value);
        } else {
          setDashboard(null);
          setDashboardError(errorMessage(dashboardResult.reason));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search, offset, retry, year]);
  function submit(event: FormEvent) {
    event.preventDefault();
    setOffset(0);
    setSearch(draft.trim());
  }
  function exportCsv() {
    if (!data) return;
    const rows = [
      [
        "project",
        "organization",
        "area_ha",
        "readiness_pct",
        "open_risks",
        "overdue_periods",
        "open_findings",
        "data_gaps",
      ],
      ...data.items.map((item) => [
        item.name,
        item.organization,
        item.area_ha,
        item.readiness.score_pct,
        item.open_risks,
        item.overdue_periods,
        item.open_findings,
        item.data_gaps.join(";"),
      ]),
    ];
    saveBlob(
      new Blob(["\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
      "savegeo-portfolio-current-page.csv",
    );
  }
  return (
    <DashboardShell>
      <main className="analysis-page dmrv-page integrity-page">
        <DmrvPageHeader
          breadcrumbs={[
            { label: c("Beranda", "Home"), to: "/" },
            { label: c("Proyek dMRV", "dMRV projects"), to: "/dmrv/projects" },
            { label: c("Portofolio", "Portfolio") },
          ]}
          eyebrow="MRV DIGITAL"
          title={c("Portofolio proyek karbon", "Carbon project portfolio")}
          description={c(
            "Lihat kesiapan bukti dan pekerjaan yang perlu ditindaklanjuti pada proyek yang dibagikan kepada Anda.",
            "Review evidence readiness and follow-up work for projects shared with you.",
          )}
          metrics={[
            {
              icon: "bi-folder2-open",
              label: c("Proyek ditemukan", "Matching projects"),
              value: data ? String(data.total) : "—",
            },
            {
              icon: "bi-shield-exclamation",
              label: c("Risiko di halaman ini", "Risks on this page"),
              value: data ? String(data.summary.open_risks) : "—",
            },
            {
              icon: "bi-calendar-event",
              label: c("Periode lewat tenggat", "Overdue periods on page"),
              value: data ? String(data.summary.overdue_periods) : "—",
            },
          ]}
        />
        <section className="dmrv-panel integrity-section">
          <div className="integrity-toolbar">
            <form onSubmit={submit} className="integrity-search">
              <label className="visually-hidden" htmlFor="portfolio-search">
                {c("Cari proyek", "Search projects")}
              </label>
              <input
                id="portfolio-search"
                className="form-control"
                maxLength={200}
                placeholder={c("Cari nama proyek…", "Search project name…")}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button className="btn btn-success" type="submit">
                {c("Cari", "Search")}
              </button>
            </form>
            <label className="d-flex align-items-center gap-2">
              <span>{c("Periode", "Period")}</span>
              <select className="form-select" value={year} onChange={(event) => setYear(event.target.value)}>
                <option value="">{c("Semua tahun", "All years")}</option>
                {[2026, 2025, 2024, 2023].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <button
              type="button"
              className="dmrv-reference-link"
              onClick={exportCsv}
              disabled={!data?.items.length || loading}
            >
              <i className="bi bi-download" aria-hidden="true" />
              {c("Ekspor halaman CSV", "Export page as CSV")}
            </button>
          </div>
          <p className="integrity-note">
            {c(
              "Portofolio mengikuti keanggotaan proyek. Skor adalah kesiapan bukti internal. Ringkasan risiko dan tenggat dihitung untuk halaman yang ditampilkan.",
              "Portfolio visibility follows project membership. Scores reflect internal evidence readiness. Risk and deadline totals cover the displayed page.",
            )}
          </p>
          {dashboard ? (
            <div className="dmrv-overview-grid mb-4" aria-label={c("Ringkasan lintas proyek", "Cross-project summary")}>
              {[
                [c("Pekerjaan analisis", "Analysis jobs"), dashboard.summary.job_count, "bi-cpu"],
                [c("Periode monitoring", "Monitoring periods"), dashboard.summary.period_count, "bi-calendar3"],
                [c("Laporan dan paket bukti", "Reports and evidence packages"), dashboard.summary.report_count, "bi-file-earmark-check"],
                [c("Pengajuan", "Submissions"), dashboard.summary.submission_count, "bi-send-check"],
                [c("Risiko tercatat", "Recorded risks"), dashboard.summary.risk_count, "bi-shield-exclamation"],
              ].map(([label, value, icon]) => (
                <div className="dmrv-overview-item" key={String(label)}>
                  <i className={`bi ${String(icon)}`} aria-hidden="true" />
                  <span>{label}</span><strong>{value}</strong>
                </div>
              ))}
              {dashboard.recent_jobs.length ? (
                <div className="dmrv-overview-item dmrv-overview-wide">
                  <span>{c("Pekerjaan terbaru", "Recent jobs")}</span>
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    {dashboard.recent_jobs.slice(0, 6).map((job) => {
                      const project = dashboard.projects.find((item) => item.id === job.project_id);
                      return <Link className="integrity-gap" key={job.id} to={`/dmrv/projects/${job.project_id}?tab=analysis`}>
                        {project?.name ?? job.project_id} · {job.kind.replace("analysis.", "")} · {job.status}
                      </Link>;
                    })}
                  </div>
                </div>
              ) : null}
              {dashboard.recent_periods.length ? (
                <div className="dmrv-overview-item dmrv-overview-wide">
                  <span>{c("Periode monitoring terbaru", "Recent monitoring periods")}</span>
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    {dashboard.recent_periods.slice(0, 6).map((period) => {
                      const project = dashboard.projects.find((item) => item.id === period.project_id);
                      return <Link className="integrity-gap" key={period.id} to={`/dmrv/projects/${period.project_id}`}>
                        {project?.name ?? period.project_id} · {period.name} · {period.start_date} - {period.end_date} · {period.status}
                      </Link>;
                    })}
                  </div>
                </div>
              ) : null}
              {dashboard.recent_reports.length ? (
                <div className="dmrv-overview-item dmrv-overview-wide">
                  <span>{c("Laporan terbaru", "Recent reports")}</span>
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    {dashboard.recent_reports.slice(0, 6).map((report) => {
                      const project = dashboard.projects.find((item) => item.id === report.project_id);
                      return <Link className="integrity-gap" key={report.id} to={`/dmrv/projects/${report.project_id}/integrity`}>
                        {project?.name ?? report.project_id} · {report.readiness}
                      </Link>;
                    })}
                  </div>
                </div>
              ) : null}
              {dashboard.recent_risks.length ? (
                <div className="dmrv-overview-item dmrv-overview-wide">
                  <span>{c("Risiko terbaru", "Recent risks")}</span>
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    {dashboard.recent_risks.slice(0, 6).map((risk) => {
                      const project = dashboard.projects.find((item) => item.id === risk.project_id);
                      return <Link className="integrity-gap" key={risk.id} to={`/dmrv/projects/${risk.project_id}/integrity`}>
                        {project?.name ?? risk.project_id} · {risk.title} · {risk.status}
                      </Link>;
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {dashboardError ? (
            <p className="integrity-note" role="status">
              {c("Ringkasan lintas proyek sementara tidak tersedia.", "Cross-project summary is temporarily unavailable.")}
            </p>
          ) : null}
          {error ? (
            <div role="alert" className="alert alert-danger">
              {error}{" "}
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => setRetry((n) => n + 1)}
              >
                {c("Coba lagi", "Retry")}
              </button>
            </div>
          ) : null}
          {loading ? <p role="status">{c("Memuat portofolio…", "Loading portfolio…")}</p> : null}
          {!loading && data?.items.length === 0 ? (
            <div className="integrity-empty">
              <i className="bi bi-folder2-open" aria-hidden="true" />
              <p>
                {c(
                  "Belum ada proyek yang dapat ditampilkan. Pemilik proyek dapat membagikan akses melalui Pengaturan di ruang integritas.",
                  "No matching projects. Project owners can share access through Settings in the integrity workspace.",
                )}
              </p>
              <Link to="/dmrv/projects">{c("Buka proyek dMRV", "Open dMRV projects")}</Link>
            </div>
          ) : null}
          {data?.items.length ? (
            <div className="table-responsive">
              <table className="table integrity-portfolio-table">
                <thead>
                  <tr>
                    <th>{c("Proyek / organisasi", "Project / organization")}</th>
                    <th>{c("Kesiapan bukti", "Evidence readiness")}</th>
                    <th>{c("Perlu tindak lanjut", "Follow-up")}</th>
                    <th>{c("Kelengkapan data", "Data completeness")}</th>
                    <th>{c("Ruang kerja", "Workspace")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link
                          className="dmrv-project-name"
                          to={`/dmrv/projects/${item.id}/integrity`}
                        >
                          {item.name}
                        </Link>
                        <small>
                          {item.organization || "—"} · {number(item.area_ha)} ha
                        </small>
                      </td>
                      <td>
                        <strong>{number(item.readiness.score_pct, 1)}%</strong>
                        <div className="integrity-mini-progress">
                          <span style={{ width: `${item.readiness.score_pct}%` }} />
                        </div>
                        <small>
                          {item.readiness.accepted}/{item.readiness.total} ·{" "}
                          {item.readiness.submitted} {c("menunggu", "pending")}
                        </small>
                      </td>
                      <td>
                        <span className={item.open_risks ? "text-danger" : ""}>
                          {item.open_risks} {c("risiko", "risks")}
                        </span>
                        <small>
                          {item.overdue_periods} {c("periode lewat tenggat", "overdue periods")} ·{" "}
                          {item.open_findings} {c("temuan", "findings")}
                        </small>
                      </td>
                      <td>
                        {item.data_gaps.length
                          ? item.data_gaps.map((gap) => (
                              <span className="integrity-gap" key={gap}>
                                {(
                                  {
                                    boundary: c("Batas", "Boundary"),
                                    methodology_version: c("Metode / versi", "Method / version"),
                                    field_data: c("Data lapangan", "Field data"),
                                    evidence_package: c("Paket bukti", "Evidence package"),
                                  } as Record<string, string>
                                )[gap] || gap}
                              </span>
                            ))
                          : c("Dasar tersedia", "Basics available")}
                      </td>
                      <td>
                        <Link
                          className="btn btn-outline-success btn-sm"
                          to={`/dmrv/projects/${item.id}/integrity`}
                        >
                          {c("Buka", "Open")}{" "}
                          <i className="bi bi-arrow-up-right" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {data && data.total > 50 ? (
            <div className="integrity-pagination">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={loading || offset === 0}
                onClick={() => setOffset((n) => Math.max(0, n - 50))}
              >
                {c("Sebelumnya", "Previous")}
              </button>
              <span>
                {offset + 1}–{Math.min(offset + data.items.length, data.total)} / {data.total}
              </span>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={loading || offset + 50 >= data.total}
                onClick={() => setOffset((n) => n + 50)}
              >
                {c("Berikutnya", "Next")}
              </button>
            </div>
          ) : null}
        </section>
      </main>
    </DashboardShell>
  );
}
