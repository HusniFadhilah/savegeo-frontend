import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import DmrvPageHeader from "../DmrvPageHeader";
import { getProject, listBoundaries, listMonitoringPeriods } from "../api";
import type { BoundaryVersion, MonitoringPeriod, Project } from "../types";
import AccountingPanel from "./AccountingPanel";
import { CreditLedgerPanel, MethodologyPanel, SatelliteProvenancePanel } from "./AdvancedPanels";
import ChecklistPanel from "./ChecklistPanel";
import { RegistryPanel, ValidationPanel } from "./DataPanels";
import DocumentsPanel from "./DocumentsPanel";
import CarbonOperationsPanel, { AutomaticImageProvenance } from "./CarbonOperationsPanel";
import RisksPanel, { IssueForm } from "./RisksPanel";
import SettingsPanel from "./SettingsPanel";
import { downloadWorkspace, getWorkspace } from "./api";
import { errorMessage, number, useCopy } from "./helpers";
import type { IntegrityWorkspace } from "./types";
import "./integrity.css";

const SECTIONS = [
  ["readiness", "bi-clipboard-check", "Kesiapan", "Readiness"],
  ["risks", "bi-shield-exclamation", "Risiko", "Risks"],
  ["accounting", "bi-calculator", "Mitigasi", "Mitigation"],
  ["carbon", "bi-tree", "MRV karbon", "Carbon MRV"],
  ["methodology", "bi-journal-check", "Metodologi & data", "Methodology & data"],
  ["registry", "bi-intersect", "Registry", "Registry"],
  ["credits", "bi-arrow-left-right", "Siklus kredit", "Credit lifecycle"],
  ["validation", "bi-graph-up", "Validasi", "Validation"],
  ["safeguards", "bi-people", "Safeguards", "Safeguards"],
  ["documents", "bi-folder2-open", "Dokumen", "Documents"],
  ["settings", "bi-gear", "Pengaturan", "Settings"],
] as const;
type Section = (typeof SECTIONS)[number][0];

export default function IntegrityPage() {
  const { projectId = "" } = useParams();
  const currentProjectId = useRef(projectId);
  currentProjectId.current = projectId;
  const c = useCopy();
  const [project, setProject] = useState<Project | null>(null);
  const [workspace, setWorkspace] = useState<IntegrityWorkspace | null>(null);
  const [periods, setPeriods] = useState<MonitoringPeriod[]>([]);
  const [boundaries, setBoundaries] = useState<BoundaryVersion[]>([]);
  const [section, setSection] = useState<Section>("readiness");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    setWorkspace(null);
    setProject(null);
    void Promise.all([
      getProject(projectId),
      getWorkspace(projectId),
      listMonitoringPeriods(projectId),
      listBoundaries(projectId),
    ])
      .then(([nextProject, nextWorkspace, nextPeriods, nextBoundaries]) => {
        if (active) {
          setProject(nextProject);
          setWorkspace(nextWorkspace);
          setPeriods(nextPeriods);
          setBoundaries(nextBoundaries);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [projectId, retry]);
  const refresh = useCallback(async () => {
    const next = await getWorkspace(projectId);
    if (next.project_id === currentProjectId.current) setWorkspace(next);
  }, [projectId]);
  async function exportAll() {
    setExporting(true);
    setError("");
    try {
      await downloadWorkspace(projectId);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setExporting(false);
    }
  }
  const canWrite = project?.my_role === "project_owner" || project?.my_role === "analyst";
  const canReview = project?.my_role === "reviewer" || project?.my_role === "verifier";
  const props = {
    projectId,
    records: workspace?.records || [],
    canWrite,
    canReview,
    onChanged: refresh,
  };
  const riskCount =
    workspace?.records.filter(
      (r) => r.category === "risk" && ["open", "acknowledged"].includes(r.status),
    ).length || 0;
  const sectionSpec = SECTIONS.find(([key]) => key === section) || SECTIONS[0];
  return (
    <DashboardShell>
      <main className="analysis-page dmrv-page integrity-page">
        <DmrvPageHeader
          breadcrumbs={[
            { label: c("Beranda", "Home"), to: "/" },
            { label: c("Proyek dMRV", "dMRV projects"), to: "/dmrv/projects" },
            { label: project?.name || c("Proyek", "Project"), to: `/dmrv/projects/${projectId}` },
            { label: c("Integritas proyek", "Project integrity") },
          ]}
          eyebrow="MRV DIGITAL"
          title={project?.name || c("Integritas proyek", "Project integrity")}
          description={c(
            "Tinjau kesiapan, bukti, risiko, dan perhitungan proyek dalam satu ruang kerja.",
            "Review project readiness, evidence, risks and calculations in one workspace.",
          )}
          metrics={[
            {
              icon: "bi-clipboard-check",
              label: c("Kesiapan bukti", "Evidence readiness"),
              value: workspace ? `${number(workspace.readiness.score_pct, 1)}%` : "—",
            },
            {
              icon: "bi-shield-exclamation",
              label: c("Risiko terbuka", "Open risks"),
              value: String(riskCount),
            },
            {
              icon: "bi-folder2-open",
              label: c("Dokumen bukti", "Evidence documents"),
              value: workspace ? String(workspace.documents.length) : "—",
            },
          ]}
        />
        <div className="integrity-toolbar">
          <Link to="/dmrv/portfolio" className="dmrv-reference-link">
            <i className="bi bi-grid" aria-hidden="true" />
            {c("Portofolio proyek", "Project portfolio")}
          </Link>
          <Link to={`/dmrv/projects/${projectId}`} className="integrity-text-link">
            {c("Batas, lapangan, dan monitoring", "Boundary, field data and monitoring")}{" "}
            <i className="bi bi-arrow-up-right" aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="dmrv-reference-link"
            disabled={!workspace || exporting}
            onClick={() => void exportAll()}
          >
            <i className="bi bi-download" aria-hidden="true" />
            {exporting
              ? c("Menyiapkan…", "Preparing…")
              : c("Ekspor paket telaah", "Export review package")}
          </button>
        </div>
        {error ? (
          <div role="alert" className="alert alert-danger">
            {error}{" "}
            <button
              className="btn btn-sm btn-outline-danger"
              type="button"
              onClick={() => setRetry((n) => n + 1)}
            >
              {c("Muat ulang", "Reload")}
            </button>
          </div>
        ) : null}
        {!workspace && !error ? (
          <p role="status" className="integrity-empty">
            {c("Memuat ruang kerja…", "Loading workspace…")}
          </p>
        ) : null}
        {workspace && project ? (
          <>
            <section
              className="integrity-progress-card"
              aria-label={c("Ringkasan kesiapan", "Readiness summary")}
            >
              <div>
                <span className="dmrv-section-kicker">
                  {c("KESIAPAN BUKTI INTERNAL", "INTERNAL EVIDENCE READINESS")}
                </span>
                <h2>
                  {workspace.readiness.accepted} / {workspace.readiness.total}{" "}
                  {c("butir diterima reviewer", "criteria accepted by reviewers")}
                </h2>
                <p>
                  {workspace.readiness.submitted}{" "}
                  {c(
                    "menunggu review. Kelayakan metodologi, sertifikasi, dan penerbitan kredit memerlukan keputusan tersendiri.",
                    "pending review. Methodology eligibility, certification and credit issuance require separate decisions.",
                  )}
                </p>
              </div>
              <div
                className="integrity-progress-track"
                role="progressbar"
                aria-label={c("Kesiapan bukti", "Evidence readiness")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={workspace.readiness.score_pct}
              >
                <span style={{ width: `${workspace.readiness.score_pct}%` }} />
              </div>
            </section>
            <nav
              className="integrity-tabs"
              aria-label={c("Bagian integritas proyek", "Project integrity sections")}
            >
              {SECTIONS.filter(
                ([key]) => key !== "settings" || project.my_role === "project_owner",
              ).map(([key, icon, id, en]) => (
                <button
                  type="button"
                  key={key}
                  aria-current={section === key ? "page" : undefined}
                  className={section === key ? "is-active" : ""}
                  onClick={() => setSection(key)}
                >
                  <i className={`bi ${icon}`} aria-hidden="true" />
                  {c(id, en)}
                  {key === "risks" && riskCount ? (
                    <span className="integrity-count">{riskCount}</span>
                  ) : null}
                </button>
              ))}
            </nav>
            <section
              className="dmrv-panel integrity-section"
              aria-label={c("Isi penilaian", "Assessment content")}
            >
              <div className="integrity-section-title">
                <h2>{c(sectionSpec[2], sectionSpec[3])}</h2>
                <span className="integrity-note">
                  {canReview
                    ? c("Mode reviewer", "Reviewer mode")
                    : canWrite
                      ? c("Mode pengembang proyek", "Project developer mode")
                      : c("Baca saja", "Read only")}
                </span>
              </div>
              {section === "readiness" ? (
                <ChecklistPanel
                  {...props}
                  records={workspace.records}
                  catalog={workspace.catalog.filter((item) => item.category === "readiness")}
                />
              ) : null}
              {section === "risks" ? (
                <RisksPanel
                  key={`${projectId}-${workspace.risk_policy.revision}`}
                  {...props}
                  policy={workspace.risk_policy}
                />
              ) : null}
              {section === "accounting" ? (
                <AccountingPanel
                  {...props}
                  project={project}
                  periods={periods}
                  records={workspace.records.filter((r) => r.category === "accounting")}
                />
              ) : null}
              {section === "carbon" ? <CarbonOperationsPanel {...props} periods={periods} boundaries={boundaries} /> : null}
              {section === "methodology" ? (
                <>
                  <MethodologyPanel {...props} />
                  <h3 className="integrity-subheading">
                    {c("Provenance otomatis dari citra", "Automatic image provenance")}
                  </h3>
                  <AutomaticImageProvenance projectId={projectId} />
                  <h3 className="integrity-subheading">
                    {c("Jejak mutu citra satelit", "Satellite data quality trail")}
                  </h3>
                  <SatelliteProvenancePanel {...props} />
                </>
              ) : null}
              {section === "registry" ? (
                <RegistryPanel
                  {...props}
                  check={workspace.registry_check}
                  records={workspace.records.filter((r) => r.category === "registry")}
                />
              ) : null}
              {section === "credits" ? (
                <CreditLedgerPanel projectId={projectId} canWrite={canWrite} />
              ) : null}
              {section === "validation" ? (
                <ValidationPanel
                  {...props}
                  records={workspace.records.filter((r) => r.category === "validation")}
                />
              ) : null}
              {section === "safeguards" ? (
                <>
                  <ChecklistPanel
                    {...props}
                    catalog={workspace.catalog.filter((item) => item.category === "safeguard")}
                  />
                  <h3 className="integrity-subheading">
                    {c("Register pengaduan", "Grievance register")}
                  </h3>
                  <IssueForm {...props} category="grievance" />
                </>
              ) : null}
              {section === "documents" ? (
                <DocumentsPanel
                  projectId={projectId}
                  documents={workspace.documents}
                  canWrite={canWrite}
                  onChanged={refresh}
                />
              ) : null}
              {section === "settings" && project.my_role === "project_owner" ? (
                <SettingsPanel
                  key={project.id}
                  project={project}
                  onProjectChanged={(next) => {
                    if (next.id === currentProjectId.current) setProject(next);
                  }}
                />
              ) : null}
            </section>
          </>
        ) : null}
      </main>
    </DashboardShell>
  );
}
