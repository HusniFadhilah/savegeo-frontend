import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiClient } from "@/services/apiClient";
import type { Project, ProjectRole } from "../types";
import { Field } from "./shared";
import { errorMessage, useCopy } from "./helpers";

type Member = {
  principal_type: "admin" | "user";
  principal_id: number;
  username: string;
  role: ProjectRole;
};
export default function SettingsPanel({
  project,
  onProjectChanged,
}: {
  project: Project;
  onProjectChanged: (project: Project) => void;
}) {
  const c = useCopy();
  const [form, setForm] = useState({
    name: project.name,
    organization: project.organization || "",
    jurisdiction: project.jurisdiction || "",
    methodology_id: project.methodology_id || "",
    methodology_version: project.methodology_version || "",
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [invite, setInvite] = useState({ username: "", principal_type: "admin", role: "reviewer" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState<Member | null>(null);
  const base = `/dmrv/projects/${encodeURIComponent(project.id)}`;
  const load = useCallback(
    () => apiClient.get<Member[]>(`${base}/integrity/members`, { auth: "app" }).then(setMembers),
    [base],
  );
  useEffect(() => {
    let active = true;
    void apiClient
      .get<Member[]>(`${base}/integrity/members`, { auth: "app" })
      .then((rows) => {
        if (active) setMembers(rows);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [base]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await apiClient.patch<Project>(base, form, {
        auth: "app",
        headers: { "If-Match": `"${project.revision}"` },
      });
      onProjectChanged(result);
      setNotice(c("Identitas proyek tersimpan.", "Project details saved."));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function add(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiClient.post(`${base}/members`, invite, { auth: "app" });
      await load();
      setInvite((old) => ({ ...old, username: "" }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!removing) return;
    setBusy(true);
    setError("");
    try {
      await apiClient.delete(
        `${base}/integrity/members/${removing.principal_type}/${removing.principal_id}`,
        { auth: "app" },
      );
      await load();
      setRemoving(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form className="integrity-editor" onSubmit={(e) => void save(e)}>
        <h3>{c("Identitas dan metodologi proyek", "Project identity and methodology")}</h3>
        <div className="integrity-form-grid">
          {(
            [
              ["name", c("Nama proyek", "Project name")],
              ["organization", c("Organisasi", "Organization")],
              ["jurisdiction", c("Wilayah", "Jurisdiction")],
              ["methodology_id", c("Metodologi", "Methodology")],
              ["methodology_version", c("Versi metodologi", "Methodology version")],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                required={key === "name"}
                maxLength={
                  key === "methodology_version"
                    ? 32
                    : key === "methodology_id"
                      ? 64
                      : key === "jurisdiction"
                        ? 128
                        : 255
                }
                className="form-control"
                value={form[key]}
                onChange={(e) => setForm((old) => ({ ...old, [key]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
        <button type="submit" className="btn btn-success" disabled={busy}>
          {c("Simpan identitas", "Save details")}
        </button>
      </form>
      <section className="integrity-editor">
        <h3>{c("Anggota dan reviewer proyek", "Project members and reviewers")}</h3>
        <p className="integrity-note">
          {c(
            "Berikan akses portofolio melalui keanggotaan proyek secara eksplisit. Reviewer harus menggunakan akun berbeda dari penulis penilaian.",
            "Grant portfolio access through explicit project membership. Reviewers must use a different account from the assessment author.",
          )}
        </p>
        <form onSubmit={(e) => void add(e)}>
          <div className="integrity-form-grid">
            <Field label="Username">
              <input
                required
                maxLength={64}
                className="form-control"
                value={invite.username}
                onChange={(e) => setInvite((old) => ({ ...old, username: e.target.value }))}
              />
            </Field>
            <Field label={c("Jenis akun", "Account type")}>
              <select
                className="form-select"
                value={invite.principal_type}
                onChange={(e) => setInvite((old) => ({ ...old, principal_type: e.target.value }))}
              >
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </Field>
            <Field label={c("Peran", "Role")}>
              <select
                className="form-select"
                value={invite.role}
                onChange={(e) => setInvite((old) => ({ ...old, role: e.target.value }))}
              >
                {["analyst", "reviewer", "verifier", "field_operator", "project_owner"].map(
                  (role) => (
                    <option value={role} key={role}>
                      {role}
                    </option>
                  ),
                )}
              </select>
            </Field>
          </div>
          <button type="submit" className="btn btn-outline-success" disabled={busy}>
            {c("Berikan akses", "Grant access")}
          </button>
        </form>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Username</th>
                <th>{c("Peran", "Role")}</th>
                <th>{c("Akses", "Access")}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={`${member.principal_type}:${member.principal_id}`}>
                  <td>
                    {member.username} <small>({member.principal_type})</small>
                  </td>
                  <td>{member.role}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-link btn-sm text-danger"
                      onClick={() => setRemoving(member)}
                    >
                      {c("Cabut akses", "Revoke access")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {removing ? (
          <div
            role="group"
            aria-label={c("Konfirmasi pencabutan akses", "Confirm access revocation")}
          >
            <p>
              {c("Cabut akses untuk", "Revoke access for")} <strong>{removing.username}</strong>?
            </p>
            <div className="integrity-actions">
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={busy}
                onClick={() => void remove()}
              >
                {c("Ya, cabut akses", "Revoke access")}
              </button>
              <button
                type="button"
                className="btn btn-light btn-sm"
                onClick={() => setRemoving(null)}
              >
                {c("Batal", "Cancel")}
              </button>
            </div>
          </div>
        ) : null}
      </section>
      {notice ? (
        <p role="status" className="alert alert-success">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}
