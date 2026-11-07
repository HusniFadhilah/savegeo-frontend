import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import { useI18nStore } from "@/hooks/useI18nStore";
import { ApiError } from "@/services/apiClient";
import BoundaryPanel from "./BoundaryPanel";
import FieldDataPanel from "./FieldDataPanel";
import MonitoringPeriodPanel from "./MonitoringPeriodPanel";
import EvidencePackagePanel from "./EvidencePackagePanel";
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
  const t = useI18nStore((s) => s.t);
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

  return (
    <DashboardShell>
      <section className="mx-auto px-3 pt-3" style={{ maxWidth: 960 }}>
        <p><Link to="/dmrv/projects">{t("dmrv.project.back")}</Link></p>
        {error && <div role="alert" className="alert alert-danger">{error}</div>}
        {!project && !error && <p role="status">{t("dmrv.loading")}</p>}
        {project && (
          <>
            <h1 className="h4">{project.name}</h1>
            <p className="text-muted">
              {t("dmrv.project.myRole")}: <strong>{role ? t(`dmrv.role.${role}`) : "-"}</strong> · {t("dmrv.projects.status")}: {project.status}
            </p>
            <div role="tablist" aria-label={t("dmrv.project.tabs")} className="nav nav-tabs mb-3">
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
            <div role="tabpanel" id="dmrv-tabpanel" aria-labelledby={`dmrv-tab-${tab}`}>
              {tab === "overview" && (
                <dl className="row">
                  <dt className="col-sm-3">{t("dmrv.project.methodology")}</dt>
                  <dd className="col-sm-9">{[project.methodology_id, project.methodology_version].filter(Boolean).join(" ") || "-"}</dd>
                  <dt className="col-sm-3">{t("dmrv.projects.organization")}</dt>
                  <dd className="col-sm-9">{project.organization ?? "-"}</dd>
                  <dt className="col-sm-3">{t("dmrv.projects.activity")}</dt>
                  <dd className="col-sm-9">{project.activity_type}</dd>
                  <dt className="col-sm-3">{t("dmrv.project.revision")}</dt>
                  <dd className="col-sm-9">{project.revision}</dd>
                </dl>
              )}
              {tab === "boundary" && <BoundaryPanel projectId={project.id} canWrite={role !== null && BOUNDARY_WRITERS.includes(role)} />}
              {tab === "monitoring" && <MonitoringPeriodPanel projectId={project.id} canWrite={role !== null && MONITORING_WRITERS.includes(role)} />}
              {tab === "field" && <FieldDataPanel projectId={project.id} canWrite={role !== null && FIELD_WRITERS.includes(role)} canRunSummary={role !== null && FIELD_SUMMARY_RUNNERS.includes(role)} />}
              {tab === "evidence" && (
                <>
                  <EvidencePackagePanel projectId={project.id} canWrite={role !== null && EVIDENCE_WRITERS.includes(role)} onChanged={() => setEvidenceRevision((value) => value + 1)} />
                  <SubmissionReviewPanel projectId={project.id} canSubmit={role !== null && EVIDENCE_WRITERS.includes(role)} canReview={role !== null && REVIEWERS.includes(role)} refreshToken={evidenceRevision} />
                </>
              )}
            </div>
          </>
        )}
      </section>
    </DashboardShell>
  );
}
