import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import { useI18nStore } from "@/hooks/useI18nStore";
import { ApiError } from "@/services/apiClient";
import BoundaryPanel from "./BoundaryPanel";
import DmrvPageHeader from "./DmrvPageHeader";
import EvidencePackagePanel from "./EvidencePackagePanel";
import FieldDataPanel from "./FieldDataPanel";
import MonitoringPeriodPanel from "./MonitoringPeriodPanel";
import SubmissionReviewPanel from "./SubmissionReviewPanel";
import { getProject } from "./api";
import { describeDmrvError } from "./errors";
import type { Project, ProjectRole } from "./types";

type Tab = "overview" | "boundary" | "monitoring" | "field" | "evidence";
const TABS: Tab[] = ["overview", "boundary", "monitoring", "field", "evidence"];
// Mirrors backend ROLE_ACTIONS (boundary.write / field.write). The backend remains the authority.
const BOUNDARY_WRITERS: ProjectRole[] = ["project_owner", "analyst"];
const FIELD_WRITERS: ProjectRole[] = ["project_owner", "field_operator"];
const FIELD_SUMMARY_RUNNERS: ProjectRole[] = ["project_owner", "analyst"];
const MONITORING_WRITERS: ProjectRole[] = ["project_owner", "analyst"];
const EVIDENCE_WRITERS: ProjectRole[] = ["project_owner", "analyst"];
const REVIEWERS: ProjectRole[] = ["reviewer", "verifier"];

export default function DmrvProjectPage() {
  const { projectId = "" } = useParams();
  const t = useI18nStore((state) => state.t);
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [evidenceRevision, setEvidenceRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setProject(null); setError("");
    getProject(projectId)
      .then((row) => { if (active) setProject(row); })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof ApiError && cause.status === 404 ? t("dmrv.errors.notFound") : describeDmrvError(cause, t));
      });
    return () => { active = false; };
  }, [projectId, t]);

  const role = project?.my_role ?? null;
  const currentHeading = project?.name ?? (error ? t("dmrv.project.unavailable") : t("dmrv.loading"));
  const metricValue = (value: string | null | undefined) => value?.trim() || t("dmrv.example.missing");

  return (
    <DashboardShell>
      <main className="analysis-page dmrv-page">
        <DmrvPageHeader
          breadcrumbs={[
            { label: t("dmrv.breadcrumb.home"), to: "/" },
            { label: t("dmrv.breadcrumb.projects"), to: "/dmrv/projects" },
            { label: currentHeading },
          ]}
          eyebrow={t("dmrv.header.eyebrow")}
          title={currentHeading}
          description={project ? t("dmrv.project.description") : t("dmrv.project.loadingDescription")}
          metrics={project ? [
            { icon: "bi-journal-check", label: t("dmrv.projects.methodology"), value: [project.methodology_id, project.methodology_version].filter(Boolean).join(" ") || t("dmrv.example.missing") },
            { icon: "bi-tree", label: t("dmrv.projects.activity"), value: project.activity_type },
            { icon: "bi-person-check", label: t("dmrv.project.myRole"), value: role ? t(`dmrv.role.${role}`) : t("dmrv.example.missing") },
          ] : []}
        />

        {error ? <div role="alert" className="alert alert-danger dmrv-project-error">{error}</div> : null}
        {!project && !error ? <p role="status">{t("dmrv.loading")}</p> : null}

        {project ? (
          <section className="dmrv-panel">
            <div role="tablist" aria-label={t("dmrv.project.tabs")} className="nav nav-tabs dmrv-tabs">
              {TABS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`dmrv-tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls="dmrv-tabpanel"
                  className={`nav-link ${tab === id ? "active" : ""}`}
                  onClick={() => setTab(id)}
                >
                  {t(`dmrv.project.tab.${id}`)}
                </button>
              ))}
            </div>
            <div role="tabpanel" id="dmrv-tabpanel" aria-labelledby={`dmrv-tab-${tab}`} className="dmrv-tab-panel">
              {tab === "overview" ? (
                <div className="dmrv-overview-grid">
                  <div className="dmrv-overview-item">
                    <span>{t("dmrv.project.methodology")}</span>
                    <strong>{[project.methodology_id, project.methodology_version].filter(Boolean).join(" ") || "—"}</strong>
                  </div>
                  <div className="dmrv-overview-item">
                    <span>{t("dmrv.projects.organization")}</span>
                    <strong>{metricValue(project.organization)}</strong>
                  </div>
                  <div className="dmrv-overview-item">
                    <span>{t("dmrv.projects.activity")}</span>
                    <strong>{project.activity_type}</strong>
                  </div>
                  <div className="dmrv-overview-item">
                    <span>{t("dmrv.project.revision")}</span>
                    <strong>v{project.revision}</strong>
                  </div>
                </div>
              ) : null}
              {tab === "boundary" ? <BoundaryPanel projectId={project.id} canWrite={role !== null && BOUNDARY_WRITERS.includes(role)} /> : null}
              {tab === "monitoring" ? <MonitoringPeriodPanel projectId={project.id} canWrite={role !== null && MONITORING_WRITERS.includes(role)} /> : null}
              {tab === "field" ? <FieldDataPanel projectId={project.id} canWrite={role !== null && FIELD_WRITERS.includes(role)} canRunSummary={role !== null && FIELD_SUMMARY_RUNNERS.includes(role)} /> : null}
              {tab === "evidence" ? (
                <>
                  <EvidencePackagePanel projectId={project.id} canWrite={role !== null && EVIDENCE_WRITERS.includes(role)} onChanged={() => setEvidenceRevision((value) => value + 1)} />
                  <SubmissionReviewPanel projectId={project.id} canSubmit={role !== null && EVIDENCE_WRITERS.includes(role)} canReview={role !== null && REVIEWERS.includes(role)} refreshToken={evidenceRevision} />
                </>
              ) : null}
            </div>
          </section>
        ) : null}
      </main>
    </DashboardShell>
  );
}
