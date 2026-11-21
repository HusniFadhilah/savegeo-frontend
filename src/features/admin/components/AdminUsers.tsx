import { AdminTableNumberCell, AdminTableNumberHeader } from "@/features/admin/components/AdminTableNumber";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import TablePagination from "@/components/ui/TablePagination";
import { useServerTable } from "@/hooks/useServerTable";
import { useAdmin } from "../AdminContext";
import { createAdminUser, deleteAdminUser, getCurrentAdminUser, listRoles, updateAdminUser } from "../api";
import type { AdminRole, AdminUserRow } from "../types";
import { useI18nStore } from "@/hooks/useI18nStore";
import { hasAdminPermission } from "@/auth/access";
import { useAuthStore } from "@/hooks/useAuthStore";
import BulkTableToolbar from "./BulkTableToolbar";

interface FormState {
  fullName: string;
  id: number | null;
  username: string;
  email: string;
  password: string;
  roleId: string;
  isActive: boolean;
  isSuperuser: boolean;
  mfaRequired: boolean;
}

const EMPTY_FORM: FormState = { id: null, fullName: "", username: "", email: "", password: "", roleId: "", isActive: true, isSuperuser: false, mfaRequired: false };

function roleLabel(name: string): string {
  return name === "geospatial_expert" ? "Ahli Geospasial" : name;
}

const KNOWN_ACCOUNT_DETAILS: Record<string, { fullName: string; affiliation: string }> = {
  ilhamnugraha: {
    fullName: "Ilham Nugraha, S.T., M.M., IPM.",
    affiliation: "SGM Information System · PT Len Industri (Persero)",
  },
};

function AccountIdentity({ user, missingName }: { user: AdminUserRow; missingName: string }) {
  const knownDetails = KNOWN_ACCOUNT_DETAILS[user.username.trim().toLowerCase()];
  const fullName = user.full_name?.trim() || knownDetails?.fullName;

  return (
    <>
      <strong>{fullName || <span className="text-warning">{missingName}</span>}</strong>
      <div style={{ fontSize: 12 }}>@{user.username}</div>
      {knownDetails && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{knownDetails.affiliation}</div>}
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{user.email || "-"}</div>
    </>
  );
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
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const canAssignFullAccess = me?.is_superuser === true;
  const canManageViewerFeatures = hasAdminPermission(me, "viewer_features.manage");
  const selectedRole = roles.find((role) => String(role.id) === form.roleId);
  const selectedRoleIsPrivileged = form.isSuperuser || Boolean(selectedRole?.permissions.some((code) => code.endsWith(".write")));
  const mfaPolicyLocked = Boolean(me?.mfa_policy_locked && selectedRoleIsPrivileged);
  const currentAccountHasMfa = form.id !== null && rows.some((user) => user.id === form.id && user.mfa_enabled);

  useEffect(() => {
    listRoles()
      .then((r) => setRoles(r.roles || []))
      .catch(() => setRoles([]));
    getCurrentAdminUser()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const reload = () => setReloadKey((k) => k + 1);
  const selectableRows = me ? rows.filter((u) => me.id !== u.id && (me.is_superuser || !u.is_superuser)) : [];
  const allPageSelected = selectableRows.length > 0 && selectableRows.every((u) => selectedIds.includes(u.id));
  const toggleSelected = (id: number) => setSelectedIds((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));
  const toggleAllPage = () => setSelectedIds((ids) => (allPageSelected ? ids.filter((id) => !selectableRows.some((u) => u.id === id)) : Array.from(new Set([...ids, ...selectableRows.map((u) => u.id)]))));
  const handleBulkDelete = async () => {
    if (!selectedIds.length || !confirm(`Hapus ${selectedIds.length} pengguna terpilih?`)) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(selectedIds.map((id) => deleteAdminUser(id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    setSelectedIds([]);
    notify(failed ? `${results.length - failed} pengguna dihapus, ${failed} gagal` : `${results.length} pengguna dihapus`, failed ? "e" : "s");
    reload();
    setBulkBusy(false);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (u: AdminUserRow) => {
    const role = roles.find((r) => r.name === u.role);
    const knownDetails = KNOWN_ACCOUNT_DETAILS[u.username.trim().toLowerCase()];
    setForm({
      id: u.id,
      username: u.username,
      fullName: u.full_name || knownDetails?.fullName || "",
      email: u.email || "",
      password: "",
      roleId: role ? String(role.id) : "",
      isActive: u.is_active,
      isSuperuser: Boolean(u.is_superuser),
      mfaRequired: Boolean(u.mfa_required),
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    setFormError(null);
    if (!form.fullName.trim()) {
      setFormError(t("admin.users.nameRequired"));
      return;
    }
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
          full_name: form.fullName.trim() || null,
          username: form.username.trim(),
          password: form.password,
          email: form.email.trim() || null,
          role_id: roleId,
          is_superuser: form.isSuperuser,
          is_active: form.isActive,
          ...(me?.is_superuser ? { mfa_required: form.mfaRequired } : {}),
        });
        notify(t("admin.users.created"), "s");
      } else {
        if (form.password && form.password.length < 8) {
          setFormError(t("admin.users.passwordMin"));
          return;
        }
        const response = await updateAdminUser(form.id, {
          full_name: form.fullName.trim() || null,
          email: form.email.trim() || null,
          is_active: form.isActive,
          role_id: roleId,
          is_superuser: form.isSuperuser,
          ...(me?.is_superuser ? { mfa_required: form.mfaRequired } : {}),
          ...(form.password ? { new_password: form.password } : {}),
        });
        if (form.id === me?.id) {
          useAuthStore.setState({ user: response.user });
          setMe(response.user);
        }
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
          {canManageViewerFeatures ? (
            <Link
              to="/admin/viewer-features"
              className="btn-sm"
              style={{ textDecoration: "none" }}
            >
              <i className="bi bi-toggles" aria-hidden="true" /> {t("admin.menu.viewerFeatures")}
            </Link>
          ) : null}
          <button type="button" className="btn-sm primary" onClick={openCreate}>
            <i className="bi bi-plus-lg" /> {t("admin.users.add")}
          </button>
        </div>
      </div>
      <div className="card-body-custom">
        {formOpen && (
          <div className="collapse-form open" style={{ marginBottom: "0.875rem" }}>
            <div className="two-col" style={{ marginBottom: "0.75rem" }}>
              <div className="form-field">
                <label className="form-label" htmlFor="admin-user-full-name">{t("admin.users.fullNameLabel")} *</label>
                <input id="admin-user-full-name" className="form-input" autoComplete="name" maxLength={160} placeholder="Contoh: Ilham Nugraha, S.T., M.M., IPM." required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div className="form-field">
                <label className="form-label">{t("admin.users.username")} {form.id === null && "*"}</label>
                <input
                  className="form-input"
                  placeholder="Contoh: budi_admin"
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
                <select className="form-select" value={form.roleId} onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value, isSuperuser: !e.target.value && canAssignFullAccess }))}>
                  {canAssignFullAccess && <option value="">{t("admin.users.fullAccess")}</option>}
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {roleLabel(r.name)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="admin-user-security-settings">
              <div className="admin-user-security-settings__toggles">
                <label className="cfg-switch">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                  <span />
                  <strong>{form.isActive ? t("admin.users.active") : t("admin.users.inactive")}</strong>
                </label>
                {me?.is_superuser && <label className="cfg-switch">
                  <input
                    type="checkbox"
                    aria-label={t("admin.users.mfaRequired")}
                    checked={form.mfaRequired || mfaPolicyLocked}
                    disabled={mfaPolicyLocked}
                    onChange={(e) => setForm((f) => ({ ...f, mfaRequired: e.target.checked }))}
                  />
                  <span />
                  <strong>{t("admin.users.mfaRequired")}</strong>
                </label>}
              </div>
              {me?.is_superuser && <div className="admin-user-security-settings__help text-muted small">
                {mfaPolicyLocked
                  ? t("admin.users.mfaLocked")
                  : currentAccountHasMfa
                    ? t("admin.users.mfaEnrolledHelp")
                    : t("admin.users.mfaHelp")}
              </div>}
            </div>
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

        <BulkTableToolbar selectedCount={selectedIds.length} onClear={() => setSelectedIds([])}>
          <button type="button" className="btn-sm danger" disabled={bulkBusy} onClick={handleBulkDelete}>
            <i className="bi bi-trash3" /> {bulkBusy ? "Menghapus..." : "Hapus terpilih"}
          </button>
        </BulkTableToolbar>

        <div style={{ overflowX: "auto" }}>
          <table className="tbl tbl-wide">
            <colgroup>
              <col className="admin-table-selection-col" />
              <col className="admin-table-number-col" />
              <col span={6} />
            </colgroup>
            <thead>
              <tr>
                <th className="admin-table-selection"><input className="admin-table-check" type="checkbox" aria-label="Pilih semua pengguna di halaman" checked={allPageSelected} onChange={toggleAllPage} /></th>
                <AdminTableNumberHeader />
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
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    {t("admin.loading")}
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--danger-color, #e53935)", padding: "1.5rem" }}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    {t("admin.users.empty")}
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                rows.map((u, index) => (
                  <tr key={u.id}>
                    <td className="admin-table-selection"><input className="admin-table-check" type="checkbox" aria-label={`Pilih ${u.username}`} checked={selectedIds.includes(u.id)} disabled={me?.id === u.id || (!me?.is_superuser && u.is_superuser === true)} onChange={() => toggleSelected(u.id)} /></td>
                    <AdminTableNumberCell index={index} page={page} pageSize={pageSize} />
                    <td className="admin-user-identity">
                      <AccountIdentity user={u} missingName={t("admin.users.nameMissing")} />
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                        {u.mfa_required_effective ? t("admin.users.mfaRequired") : t("admin.users.mfaOptional")}
                        {u.mfa_enabled ? ` · ${t("admin.users.mfaEnrolled")}` : ""}
                      </div>
                    </td>
                    <td>{u.is_superuser ? t("admin.users.fullAccess") : u.role ? roleLabel(u.role) : "?"}</td>
                    <td>
                      <span className={`stat-badge ${u.is_active ? "badge-green" : "badge-gray"}`}>{u.is_active ? t("admin.users.active") : t("admin.users.inactive")}</span>
                    </td>
                    <td>{formatAdminDate(u.created_at, language)}</td>
                    <td>{formatAdminDate(u.last_login, language)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                        {(me?.is_superuser || !u.is_superuser) && <button type="button" className="btn-xs" title={t("admin.edit")} aria-label={t("admin.edit")} onClick={() => openEdit(u)}>
                          <i className="bi bi-pencil-square" />
                        </button>}
                        {(me?.is_superuser || !u.is_superuser) && <button
                          type="button"
                          className="btn-xs danger"
                          title={t("admin.delete")}
                          aria-label={t("admin.delete")}
                          disabled={busyId === u.id || me?.id === u.id || bulkBusy}
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

