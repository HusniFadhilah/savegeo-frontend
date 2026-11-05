import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import { useI18nStore } from "@/hooks/useI18nStore";
import { ApiError } from "@/services/apiClient";
import { createProject, listProjects, newIdempotencyKey } from "./api";
import { describeDmrvError } from "./errors";
import type { Project, ProjectCreate } from "./types";

export default function DmrvProjectsPage() {
  const t = useI18nStore((s) => s.t);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [methodology, setMethodology] = useState("VM0047");
  const [activity, setActivity] = useState("ARR");
  const [pending, setPending] = useState(false);
  const [createError, setCreateError] = useState("");
  const [created, setCreated] = useState("");
  const inFlight = useRef(false);
  // A retry of the same payload reuses its key so a lost response cannot create a second project.
  const attempt = useRef<{ payload: string; key: string } | null>(null);

  useEffect(() => {
    let active = true;
    listProjects()
      .then((rows) => { if (active) setProjects(rows); })
      .catch((error: unknown) => { if (active) { setLoadError(describeDmrvError(error, t)); setProjects([]); } });
    return () => { active = false; };
  }, [t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || inFlight.current) return;
    inFlight.current = true;
    setPending(true); setCreateError(""); setCreated("");
    const payload: ProjectCreate = {
      name: trimmed,
      organization: organization.trim() || null,
      methodology_id: methodology.trim() || null,
      activity_type: activity.trim() || "ARR",
    };
    const serialised = JSON.stringify(payload);
    if (attempt.current?.payload !== serialised) attempt.current = { payload: serialised, key: newIdempotencyKey() };
    try {
      const project = await createProject(payload, attempt.current.key);
      attempt.current = null;
      setProjects((rows) => [project, ...(rows ?? []).filter((row) => row.id !== project.id)]);
      setCreated(t("dmrv.projects.created"));
      setName(""); setOrganization("");
    } catch (error) {
      setCreateError(error instanceof ApiError && error.status === 403 ? t("dmrv.errors.createForbidden") : describeDmrvError(error, t));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <DashboardShell>
      <section className="mx-auto px-3 pt-3" style={{ maxWidth: 960 }}>
        <h1 className="h4 mb-3">{t("dmrv.projects.heading")}</h1>
        {loadError && <div role="alert" className="alert alert-danger">{loadError}</div>}
        {projects === null && <p role="status">{t("dmrv.loading")}</p>}
        {projects !== null && projects.length === 0 && !loadError && <p>{t("dmrv.projects.empty")}</p>}
        {projects !== null && projects.length > 0 && (
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th scope="col">{t("dmrv.projects.name")}</th>
                <th scope="col">{t("dmrv.projects.methodology")}</th>
                <th scope="col">{t("dmrv.projects.role")}</th>
                <th scope="col">{t("dmrv.projects.status")}</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((row) => (
                <tr key={row.id}>
                  <td><Link to={`/dmrv/projects/${row.id}`}>{row.name}</Link></td>
                  <td>{row.methodology_id ?? "-"}</td>
                  <td>{row.my_role ? t(`dmrv.role.${row.my_role}`) : "-"}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form className="card card-body mt-4" onSubmit={(event) => void submit(event)} aria-labelledby="dmrv-create-heading">
          <h2 id="dmrv-create-heading" className="h5">{t("dmrv.projects.createHeading")}</h2>
          <div className="mb-3">
            <label className="form-label" htmlFor="dmrv-name">{t("dmrv.projects.name")}</label>
            <input id="dmrv-name" className="form-control" required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="row">
            <div className="col-md-4 mb-3">
              <label className="form-label" htmlFor="dmrv-org">{t("dmrv.projects.organization")}</label>
              <input id="dmrv-org" className="form-control" maxLength={255} value={organization} onChange={(e) => setOrganization(e.target.value)} />
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label" htmlFor="dmrv-method">{t("dmrv.projects.methodology")}</label>
              <input id="dmrv-method" className="form-control" maxLength={64} value={methodology} onChange={(e) => setMethodology(e.target.value)} />
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label" htmlFor="dmrv-activity">{t("dmrv.projects.activity")}</label>
              <input id="dmrv-activity" className="form-control" maxLength={32} value={activity} onChange={(e) => setActivity(e.target.value)} />
            </div>
          </div>
          {createError && <div role="alert" className="alert alert-danger">{createError}</div>}
          {created && <div role="status" className="alert alert-success">{created}</div>}
          <div>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? t("dmrv.projects.creating") : t("dmrv.projects.submit")}
            </button>
          </div>
        </form>
      </section>
    </DashboardShell>
  );
}
