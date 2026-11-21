import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import { useI18nStore } from "@/hooks/useI18nStore";
import { ApiError } from "@/services/apiClient";
import { newIdempotencyKey } from "@/features/dmrv/api";
import * as api from "./api";
import "./organizations.css";

export default function OrganizationsPage() {
  const english = useI18nStore((s) => s.language === "en");
  const tr = (id: string, en: string) => (english ? en : id);
  const [organizations, setOrganizations] = useState<api.Organization[]>([]);
  const [selected, setSelected] = useState("");
  const [members, setMembers] = useState<api.OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<api.Invitation[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [acceptToken, setAcceptToken] = useState("");
  const [deliveryToken, setDeliveryToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const attempt = useRef<{ name: string; key: string } | null>(null);
  const organization = organizations.find((org) => org.id === selected);
  const manage = organization?.role === "owner" || organization?.role === "admin";

  useEffect(() => {
    let active = true;
    api
      .listOrganizations()
      .then((rows) => {
        if (active) {
          setOrganizations(rows);
          setSelected(rows[0]?.id || "");
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load workspaces");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setMembers([]);
    setInvitations([]);
    setDeliveryToken("");
    setRole("member");
    if (selected && manage) {
      Promise.all([api.listOrganizationMembers(selected), api.listInvitations(selected)])
        .then(([rows, invites]) => {
          if (active) {
            setMembers(rows);
            setInvitations(invites);
          }
        })
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : "Unable to load members");
        });
    }
    return () => {
      active = false;
    };
  }, [selected, manage]);

  async function run(action: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : tr("Tindakan gagal.", "Operation failed."),
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  async function refreshMembers() {
    const workspaces = await api.listOrganizations();
    setOrganizations(workspaces);
    const current = workspaces.find((org) => org.id === selected);
    if (!current) {
      setMembers([]);
      setInvitations([]);
      setDeliveryToken("");
      setSelected(workspaces[0]?.id || "");
      return;
    }
    if (current.role !== "owner" && current.role !== "admin") {
      setMembers([]);
      setInvitations([]);
      setDeliveryToken("");
      return;
    }
    const [rows, invites] = await Promise.all([
      api.listOrganizationMembers(selected),
      api.listInvitations(selected),
    ]);
    setMembers(rows);
    setInvitations(invites);
  }

  function create(event: FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    if (attempt.current?.name !== value)
      attempt.current = { name: value, key: newIdempotencyKey() };
    const key = attempt.current.key;
    void run(async () => {
      const org = await api.createOrganization(value, key);
      attempt.current = null;
      setOrganizations((rows) => [...rows.filter((r) => r.id !== org.id), org]);
      setSelected(org.id);
      setName("");
    });
  }

  return (
    <DashboardShell>
      <main className="analysis-page organizations-page">
        <div className="organizations-page__heading">
          <h1>
            <i className="bi bi-buildings me-2" aria-hidden="true" />
            {tr("Organisasi dan ruang kerja", "Organizations and workspaces")}
          </h1>
          <Link className="btn btn-outline-success" to="/dmrv/projects">
            {tr("Buka proyek", "Open projects")}
          </Link>
        </div>
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        {loading && <p role="status">{tr("Memuat ruang kerja…", "Loading workspaces…")}</p>}
        <div className="row g-3 organizations-page__grid">
          <div className="col-lg-4">
            <section className="card organizations-page__card mb-3">
              <div className="card-header organizations-page__card-header">
                <i className="bi bi-building-add me-2" />
                {tr("Buat organisasi", "Create organization")}
              </div>
              <form className="card-body organizations-page__card-body" onSubmit={create}>
                <label htmlFor="org-name" className="form-label">
                  {tr("Nama organisasi", "Organization name")}
                </label>
                <input
                  id="org-name"
                  required
                  maxLength={255}
                  className="form-control mb-3"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button className="btn btn-success" disabled={busy || loading}>
                  {tr("Buat ruang kerja", "Create workspace")}
                </button>
              </form>
            </section>
            <section className="card organizations-page__card">
              <div className="card-header organizations-page__card-header">
                <i className="bi bi-envelope-check me-2" />
                {tr("Terima undangan", "Accept invitation")}
              </div>
              <form
                className="card-body organizations-page__card-body"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const org = await api.acceptInvitation(acceptToken.trim());
                    setAcceptToken("");
                    const rows = await api.listOrganizations();
                    setOrganizations(rows);
                    setSelected(org.id);
                  });
                }}
              >
                <label htmlFor="org-token" className="form-label">
                  {tr("Kode undangan", "Invitation code")}
                </label>
                <input
                  id="org-token"
                  required
                  autoComplete="off"
                  type="password"
                  className="form-control mb-3"
                  value={acceptToken}
                  onChange={(e) => setAcceptToken(e.target.value)}
                />
                <p className="small text-body-secondary">
                  {tr(
                    "Gunakan akun dengan email yang menerima undangan.",
                    "Use the account with the invited email address.",
                  )}
                </p>
                <button className="btn btn-outline-success" disabled={busy}>
                  {tr("Terima", "Accept")}
                </button>
              </form>
            </section>
          </div>
          <div className="col-lg-8">
            <section className="card organizations-page__card">
              <div className="card-header organizations-page__card-header">
                <i className="bi bi-people me-2" />
                {tr("Keanggotaan organisasi", "Organization membership")}
              </div>
              <div className="card-body organizations-page__card-body">
                <label htmlFor="org-select" className="form-label">
                  {tr("Ruang kerja aktif", "Active workspace")}
                </label>
                <select
                  id="org-select"
                  className="form-select mb-3"
                  value={selected}
                  disabled={busy || loading}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setError("");
                  }}
                >
                  <option value="">{tr("Pilih organisasi", "Choose organization")}</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} · {org.role}
                    </option>
                  ))}
                </select>
                {!loading && organizations.length === 0 && (
                  <p className="text-body-secondary">
                    {tr(
                      "Belum ada organisasi. Buat ruang kerja atau terima undangan.",
                      "No organizations yet. Create a workspace or accept an invitation.",
                    )}
                  </p>
                )}
                {organization && !manage && (
                  <p>
                    {tr(
                      "Anda anggota organisasi ini. Hak atas setiap proyek tetap mengikuti keanggotaan proyek.",
                      "You are a member. Access to each project still requires project membership.",
                    )}
                  </p>
                )}
                {organization && manage && (
                  <>
                    <form
                      className="row g-2 align-items-end mb-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        setDeliveryToken("");
                        void run(async () => {
                          const result = await api.inviteMember(selected, email, role);
                          setDeliveryToken(result.token);
                          setEmail("");
                          await refreshMembers();
                        });
                      }}
                    >
                      <div className="col-sm-6">
                        <label htmlFor="org-email" className="form-label">
                          Email
                        </label>
                        <input
                          id="org-email"
                          type="email"
                          required
                          maxLength={128}
                          className="form-control"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <div className="col-sm-3">
                        <label htmlFor="org-invite-role" className="form-label">
                          {tr("Peran", "Role")}
                        </label>
                        <select
                          id="org-invite-role"
                          className="form-select"
                          value={role}
                          onChange={(e) => setRole(e.target.value as "admin" | "member")}
                        >
                          <option value="member">{tr("Anggota", "Member")}</option>
                          {organization.role === "owner" && <option value="admin">Admin</option>}
                        </select>
                      </div>
                      <div className="col-sm-3">
                        <button className="btn btn-success w-100" disabled={busy}>
                          {tr("Undang", "Invite")}
                        </button>
                      </div>
                    </form>
                    {deliveryToken && (
                      <div className="alert alert-info" role="status">
                        <label htmlFor="org-delivery" className="form-label">
                          {tr(
                            "Kode ditampilkan sekali. Sampaikan secara privat kepada penerima; berlaku 72 jam.",
                            "Shown once. Deliver privately to the recipient; expires in 72 hours.",
                          )}
                        </label>
                        <input
                          id="org-delivery"
                          className="form-control"
                          readOnly
                          value={deliveryToken}
                          onFocus={(e) => e.currentTarget.select()}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary mt-2"
                          onClick={() => setDeliveryToken("")}
                        >
                          {tr("Sembunyikan", "Hide")}
                        </button>
                      </div>
                    )}
                    <div className="table-responsive">
                      <table className="table align-middle">
                        <thead>
                          <tr>
                            <th style={{ width: "4rem" }}>No</th>
                            <th>{tr("Nama dan akun", "Name and account")}</th>
                            <th>{tr("Peran", "Role")}</th>
                            <th>Status</th>
                            <th>{tr("Aksi", "Action")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((member, index) => (
                            <tr key={member.id}>
                              <td>{index + 1}</td>
                              <td>
                                <strong>{member.full_name || member.username}</strong>
                                <div className="small text-body-secondary">
                                  {member.username} · {member.principal_type}
                                </div>
                              </td>
                              <td>
                                <select
                                  aria-label={`${tr("Peran", "Role")} ${member.username}`}
                                  className="form-select form-select-sm"
                                  value={member.role}
                                  disabled={busy || organization.role !== "owner"}
                                  onChange={(e) => {
                                    const value = e.target.value as api.Organization["role"];
                                    void run(async () => {
                                      await api.changeOrganizationMember(
                                        selected,
                                        member.id,
                                        value,
                                        member.is_active,
                                      );
                                      await refreshMembers();
                                    });
                                  }}
                                >
                                  <option value="owner">{tr("Pemilik", "Owner")}</option>
                                  <option value="admin">Admin</option>
                                  <option value="member">{tr("Anggota", "Member")}</option>
                                </select>
                              </td>
                              <td>
                                {member.is_active
                                  ? tr("Aktif", "Active")
                                  : tr("Nonaktif", "Inactive")}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary"
                                  disabled={
                                    busy ||
                                    (organization.role !== "owner" && member.role !== "member")
                                  }
                                  onClick={() =>
                                    void run(async () => {
                                      await api.changeOrganizationMember(
                                        selected,
                                        member.id,
                                        member.role,
                                        !member.is_active,
                                      );
                                      await refreshMembers();
                                    })
                                  }
                                >
                                  {member.is_active
                                    ? tr("Nonaktifkan", "Deactivate")
                                    : tr("Aktifkan", "Activate")}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {invitations.length > 0 && (
                      <details className="mt-3">
                        <summary>{tr("Riwayat undangan", "Invitation history")}</summary>
                        <div className="table-responsive">
                          <table className="table table-sm mt-2">
                            <thead>
                              <tr>
                                <th>No</th>
                                <th>Email</th>
                                <th>{tr("Berlaku sampai", "Expires")}</th>
                                <th>Status</th>
                                <th>{tr("Aksi", "Action")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {invitations.map((invite, i) => (
                                <tr key={invite.id}>
                                  <td>{i + 1}</td>
                                  <td>{invite.email}</td>
                                  <td>
                                    {new Date(invite.expires_at).toLocaleString(
                                      english ? "en-GB" : "id-ID",
                                    )}
                                  </td>
                                  <td>
                                    {invite.revoked_at
                                      ? tr("Dicabut", "Revoked")
                                      : invite.accepted_at
                                        ? tr("Diterima", "Accepted")
                                        : new Date(invite.expires_at).getTime() < Date.now()
                                          ? tr("Kedaluwarsa", "Expired")
                                          : tr("Menunggu", "Pending")}
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger"
                                      disabled={
                                        busy || Boolean(invite.revoked_at || invite.accepted_at)
                                      }
                                      onClick={() =>
                                        void run(async () => {
                                          await api.revokeInvitation(selected, invite.id);
                                          await refreshMembers();
                                        })
                                      }
                                    >
                                      {tr("Cabut", "Revoke")}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}
