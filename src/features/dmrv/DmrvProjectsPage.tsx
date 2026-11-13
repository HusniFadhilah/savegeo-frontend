import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import { useI18nStore } from "@/hooks/useI18nStore";
import { ApiError } from "@/services/apiClient";
import DmrvPageHeader from "./DmrvPageHeader";
import { createProject, listProjects, newIdempotencyKey } from "./api";
import { describeDmrvError } from "./errors";
import type { Project, ProjectCreate } from "./types";
import { listOrganizations, type Organization } from "@/features/organizations/api";

const VERRA_REFERENCE_URL = "https://registry.verra.org/verra/public/program/CCBS/projects/4653";

export default function DmrvProjectsPage() {
  const t = useI18nStore((state) => state.t);
  const language = useI18nStore((state) => state.language);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
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
    listOrganizations()
      .then((rows) => {
        if (active) setOrganizations(rows);
      })
      .catch(() => {
        /* Legacy project creation remains available; organizations page surfaces connection errors. */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    listProjects()
      .then((rows) => {
        if (active) setProjects(rows);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(describeDmrvError(error, t));
          setProjects([]);
        }
      });
    return () => {
      active = false;
    };
  }, [t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setCreateError("");
    setCreated("");
    const payload: ProjectCreate = {
      name: trimmed,
      organization: organization.trim() || null,
      ...(organizationId ? { organization_id: organizationId } : {}),
      methodology_id: methodology.trim() || null,
      activity_type: activity.trim() || "ARR",
    };
    const serialised = JSON.stringify(payload);
    if (attempt.current?.payload !== serialised)
      attempt.current = { payload: serialised, key: newIdempotencyKey() };
    try {
      const project = await createProject(payload, attempt.current.key);
      attempt.current = null;
      setProjects((rows) => [project, ...(rows ?? []).filter((row) => row.id !== project.id)]);
      setCreated(t("dmrv.projects.created"));
      setName("");
      setOrganization("");
    } catch (error) {
      setCreateError(
        error instanceof ApiError && error.status === 403
          ? t("dmrv.errors.createForbidden")
          : describeDmrvError(error, t),
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const projectCount =
    projects === null
      ? "—"
      : new Intl.NumberFormat(language === "id" ? "id-ID" : "en-US").format(projects.length);
  const location =
    language === "id" ? "Kahayan Hilir, Kalimantan Tengah" : "Kahayan Hilir, Central Kalimantan";
  const area = language === "id" ? "15.873 ha" : "15,873 ha";

  return (
    <DashboardShell>
      <main className="analysis-page dmrv-page">
        <DmrvPageHeader
          breadcrumbs={[
            { label: t("dmrv.breadcrumb.home"), to: "/" },
            { label: t("dmrv.breadcrumb.projects") },
          ]}
          eyebrow={t("dmrv.header.eyebrow")}
          title={t("dmrv.projects.heading")}
          description={t("dmrv.projects.description")}
          metrics={[
            {
              icon: "bi-folder2-open",
              label: t("dmrv.header.metric.projects"),
              value: projectCount,
            },
            {
              icon: "bi-clipboard-data",
              label: t("dmrv.header.metric.source"),
              value: t("dmrv.header.value.source"),
            },
            {
              icon: "bi-person-lock",
              label: t("dmrv.header.metric.access"),
              value: t("dmrv.header.value.access"),
            },
          ]}
        />

        {loadError && (
          <div role="alert" className="alert alert-danger dmrv-project-error">
            <i className="bi bi-exclamation-circle" aria-hidden="true" />
            <span>{loadError}</span>
          </div>
        )}

        <section className="dmrv-reference-card" aria-labelledby="dmrv-public-project-title">
          <div className="dmrv-reference-head">
            <div>
              <span className="dmrv-reference-kicker">
                <i className="bi bi-patch-check" aria-hidden="true" />
                {t("dmrv.example.real.kicker")}
              </span>
              <h2 id="dmrv-public-project-title" className="dmrv-reference-title">
                {t("dmrv.example.real.title")}
              </h2>
              <p className="dmrv-reference-description">{t("dmrv.example.real.description")}</p>
            </div>
            <a
              className="dmrv-reference-link"
              href={VERRA_REFERENCE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
              {t("dmrv.example.real.openRegistry")}
            </a>
          </div>

          <div className="dmrv-reference-grid">
            <div className="dmrv-reference-fact">
              <span>{t("dmrv.example.real.location")}</span>
              <strong>{location}</strong>
            </div>
            <div className="dmrv-reference-fact">
              <span>{t("dmrv.example.real.area")}</span>
              <strong>{area}</strong>
            </div>
            <div className="dmrv-reference-fact">
              <span>{t("dmrv.example.real.type")}</span>
              <strong>ARR</strong>
            </div>
            <div className="dmrv-reference-fact">
              <span>{t("dmrv.example.real.status")}</span>
              <strong>{t("dmrv.example.real.validationApproved")}</strong>
            </div>
          </div>
          <p className="dmrv-reference-note">
            <i className="bi bi-info-circle" aria-hidden="true" />
            <span>{t("dmrv.example.real.sourceNote")}</span>
          </p>
        </section>

        <div className="dmrv-section-heading">
          <div>
            <span className="dmrv-section-kicker">{t("dmrv.header.eyebrow")}</span>
            <h2>{t("dmrv.projects.workspaceHeading")}</h2>
          </div>
          <Link
            aria-label={t("dmrv.example.heading")}
            className="dmrv-reference-link dmrv-example-action"
            to="/dmrv/examples/arr-accounting"
          >
            <i className="bi bi-calculator" aria-hidden="true" />
            {t("dmrv.projects.exampleAction")}
          </Link>
        </div>

        <div className="row g-3">
          <div className="col-lg-7">
            <section className="dmrv-panel" aria-labelledby="dmrv-project-list-heading">
              <h3 id="dmrv-project-list-heading" className="dmrv-panel-title">
                {t("dmrv.projects.listHeading")}
              </h3>
              <p className="dmrv-panel-description">{t("dmrv.projects.listDescription")}</p>
              {projects === null ? <p role="status">{t("dmrv.loading")}</p> : null}
              {projects !== null && projects.length === 0 && !loadError ? (
                <div className="dmrv-empty-state">
                  <i className="bi bi-folder2-open" aria-hidden="true" />
                  <p>{t("dmrv.projects.empty")}</p>
                </div>
              ) : null}
              {projects !== null && projects.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-hover align-middle dmrv-project-table">
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
                          <td>
                            <Link className="dmrv-project-name" to={`/dmrv/projects/${row.id}`}>
                              {row.name}
                            </Link>
                          </td>
                          <td>{row.methodology_id ?? "—"}</td>
                          <td>
                            {row.my_role ? (
                              <span className="dmrv-role-badge">
                                {t(`dmrv.role.${row.my_role}`)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            <span className="dmrv-project-status">{row.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          </div>

          <div className="col-lg-5">
            <section className="dmrv-panel" aria-labelledby="dmrv-create-heading">
              <h3 id="dmrv-create-heading" className="dmrv-panel-title">
                {t("dmrv.projects.createHeading")}
              </h3>
              <p className="dmrv-panel-description">{t("dmrv.projects.createDescription")}</p>
              {created && (
                <div role="status" className="alert alert-success py-2">
                  {created}
                </div>
              )}
              {createError && (
                <div role="alert" className="alert alert-danger py-2">
                  {createError}
                </div>
              )}
              <form className="dmrv-create-form" onSubmit={(event) => void submit(event)}>
                <div>
                  <label className="form-label" htmlFor="dmrv-workspace">
                    {language === "en" ? "Customer workspace" : "Ruang kerja pelanggan"}
                  </label>
                  <select
                    id="dmrv-workspace"
                    className="form-select"
                    value={organizationId}
                    onChange={(event) => setOrganizationId(event.target.value)}
                  >
                    <option value="">
                      {language === "en"
                        ? "Legacy private project (administrator)"
                        : "Proyek privat lama (administrator)"}
                    </option>
                    {organizations
                      .filter((org) => org.role !== "member")
                      .map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                  </select>
                  <Link className="small" to="/organizations">
                    {language === "en"
                      ? "Manage organizations and members"
                      : "Kelola organisasi dan anggota"}
                  </Link>
                </div>
                <div>
                  <label className="form-label" htmlFor="dmrv-name">
                    {t("dmrv.projects.name")}
                  </label>
                  <input
                    id="dmrv-name"
                    className="form-control"
                    required
                    maxLength={255}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="dmrv-org">
                    {t("dmrv.projects.organization")}
                  </label>
                  <input
                    id="dmrv-org"
                    className="form-control"
                    maxLength={255}
                    disabled={Boolean(organizationId)}
                    value={
                      organizationId
                        ? organizations.find((org) => org.id === organizationId)?.name || ""
                        : organization
                    }
                    onChange={(event) => setOrganization(event.target.value)}
                  />
                </div>
                <div className="row g-2">
                  <div className="col-sm-7">
                    <label className="form-label" htmlFor="dmrv-method">
                      {t("dmrv.projects.methodology")}
                    </label>
                    <input
                      id="dmrv-method"
                      className="form-control"
                      maxLength={64}
                      value={methodology}
                      onChange={(event) => setMethodology(event.target.value)}
                    />
                  </div>
                  <div className="col-sm-5">
                    <label className="form-label" htmlFor="dmrv-activity">
                      {t("dmrv.projects.activity")}
                    </label>
                    <input
                      id="dmrv-activity"
                      className="form-control"
                      maxLength={32}
                      value={activity}
                      onChange={(event) => setActivity(event.target.value)}
                    />
                  </div>
                </div>
                <button
                  className="btn btn-success dmrv-submit-button"
                  type="submit"
                  disabled={pending}
                >
                  <i className="bi bi-plus-lg me-1" aria-hidden="true" />
                  {pending ? t("dmrv.projects.creating") : t("dmrv.projects.submit")}
                </button>
              </form>
            </section>
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}
