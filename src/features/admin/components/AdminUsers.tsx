import { useEffect, useState } from "react";
import TablePagination from "@/components/ui/TablePagination";
import { useServerTable } from "@/hooks/useServerTable";
import { useAdmin } from "../AdminContext";
import { createAdminUser, deleteAdminUser, getCurrentAdminUser, listRoles, updateAdminUser } from "../api";
import type { AdminRole, AdminUserRow } from "../types";
import PasswordChange from "./PasswordChange";
import { useI18nStore } from "@/hooks/useI18nStore";
import { hasAdminPermission } from "@/auth/access";

interface FormState {
  id: number | null;
  username: string;
  email: string;
  password: string;
  roleId: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = { id: null, username: "", email: "", password: "", roleId: "", isActive: true };

function roleLabel(name: string): string {
  return name === "geospatial_expert" ? "Ahli Geospasial" : name;
}

function formatAdminDate(value: string | null | undefined, language: "id" | "en"): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(language === "id" ? "id-ID" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminUsers() {
  const { notify } = useAdmin();
  const { language, t } = useI18nStore();
  const [me, setMe] = useState<AdminUserRow | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { rows, loading, error, page, pageCount, pageSize, recordsTotal, recordsFiltered, search, setSearch, nextPage, prevPage } =
    useServerTable<AdminUserRow>("/admin/users", { reloadKey });

  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [pwOpen, setPwOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const canAssignFullAccess = hasAdminPermission(me, "secret.write");

  useEffect(() => {
    listRoles()
      .then((r) => setRoles(r.roles || []))
      .catch(() => setRoles([]));
    getCurrentAdminUser()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const reload = () => setReloadKey((k) => k + 1);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (u: AdminUserRow) => {
    const role = roles.find((r) => r.name === u.role);
    setForm({
      id: u.id,
      username: u.username,
      email: u.email || "",
      password: "",
      roleId: role ? String(role.id) : "",
      isActive: u.is_active,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    setFormError(null);
    const roleId = form.roleId ? Number(form.roleId) : null;
    try {
      setSaving(true);
      if (form.id === null) {
        if (!form.username.trim()) {
          setFormError(t("admin.users.usernameRequired"));
          return;
        }
        if (form.password.length < 8) {
          setFormError(t("admin.users.passwordMin"));
          return;
        }
        await createAdminUser({
          username: form.username.trim(),
          password: form.password,
          email: form.email.trim() || null,
          role_id: roleId,
          is_active: form.isActive,
        });
        notify(t("admin.users.created"), "s");
      } else {
        if (form.password && form.password.length < 8) {
          setFormError(t("admin.users.passwordMin"));
          return;
        }
        await updateAdminUser(form.id, {
          email: form.email.trim() || null,
          is_active: form.isActive,
          role_id: roleId,
          ...(form.password ? { new_password: form.password } : {}),
        });
        notify(t("admin.users.updated"), "s");
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("admin.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: AdminUserRow) => {
    if (!confirm(`${t("admin.users.deleteConfirm")} "${u.username}"?`)) return;
    setBusyId(u.id);
    try {
      await deleteAdminUser(u.id);
      notify(t("admin.users.deleted"), "s");
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("admin.users.deleteFailed"), "e");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>{t("admin.users.title")}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="btn-sm" onClick={() => setPwOpen((open) => !open)}>
            <i className="bi bi-key" /> {t("admin.users.changePassword")}
          </button>
          <button type="button" className="btn-sm primary" onClick={openCreate}>
            <i className="bi bi-plus-lg" /> {t("admin.users.add")}
          </button>
        </div>
      </div>
      <div className="card-body-custom">
        <PasswordChange open={pwOpen} onOpenChange={setPwOpen} />

        {formOpen && (
          <div className="collapse-form open" style={{ marginBottom: "0.875rem" }}>
            <div className="two-col" style={{ marginBottom: "0.75rem" }}>
              <div className="form-field">
                <label className="form-label">{t("admin.users.username")} {form.id === null && "*"}</label>
                <input
                  className="form-input"
                  placeholder="cth: budi_admin"
                  value={form.username}
                  disabled={form.id !== null}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                />
              </div>
              <div className="form-field">
                <label className="form-label">{t("admin.users.email")}</label>
                <input
                  className="form-input"
                  placeholder="budi@savegeo.id"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="form-field">
                <label className="form-label">
                  {form.id === null ? t("admin.users.passwordNewRequired") : t("admin.users.passwordOptional")}
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder={t("admin.users.passwordPlaceholder")}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div className="form-field">
                <label className="form-label">{t("admin.users.role")}</label>
                <select className="form-select" value={form.roleId} onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}>
                  {canAssignFullAccess && <option value="">{t("admin.users.fullAccess")}</option>}
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {roleLabel(r.name)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="cfg-switch" style={{ marginBottom: "0.75rem" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              <span />
              <strong>{form.isActive ? t("admin.users.active") : t("admin.users.inactive")}</strong>
            </label>
            {formError && <div className="alert alert-danger py-1 px-2 small">{formError}</div>}
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="btn-sm primary" disabled={saving} onClick={handleSave}>
                <i className="bi bi-save" /> {saving ? t("admin.saving") : form.id === null ? t("admin.save") : t("admin.update")}
              </button>
              <button type="button" className="btn-sm" onClick={() => setFormOpen(false)}>
                {t("admin.cancel")}
              </button>
            </div>
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table className="tbl tbl-wide">
            <thead>
              <tr>
                <th>{t("admin.users.user")}</th>
                <th>{t("admin.users.role")}</th>
                <th>{t("admin.status")}</th>
                <th>{t("admin.users.createdAt")}</th>
                <th>{t("admin.users.lastLogin")}</th>
                <th>{t("admin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    {t("admin.loading")}
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--danger-color, #e53935)", padding: "1.5rem" }}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    {t("admin.users.empty")}
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.username}</strong>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{u.email || "-"}</div>
                    </td>
                    <td>{u.role ? roleLabel(u.role) : t("admin.users.fullAccess")}</td>
                    <td>
                      <span className={`stat-badge ${u.is_active ? "badge-green" : "badge-gray"}`}>{u.is_active ? t("admin.users.active") : t("admin.users.inactive")}</span>
                    </td>
                    <td>{formatAdminDate(u.created_at, language)}</td>
                    <td>{formatAdminDate(u.last_login, language)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                        {(!me?.role || u.role) && <button type="button" className="btn-xs" title={t("admin.edit")} aria-label={t("admin.edit")} onClick={() => openEdit(u)}>
                          <i className="bi bi-pencil-square" />
                        </button>}
                        {(!me?.role || u.role) && <button
                          type="button"
                          className="btn-xs danger"
                          title={t("admin.delete")}
                          aria-label={t("admin.delete")}
                          disabled={busyId === u.id || me?.id === u.id}
                          onClick={() => handleDelete(u)}
                        >
                          <i className="bi bi-trash3" />
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageCount={pageCount}
          recordsTotal={recordsTotal}
          recordsFiltered={recordsFiltered}
          pageSize={pageSize}
          search={search}
          onSearchChange={setSearch}
          onPrev={prevPage}
          onNext={nextPage}
          searchPlaceholder={t("admin.users.searchPlaceholder")}
        />
      </div>
    </div>
  );
}
