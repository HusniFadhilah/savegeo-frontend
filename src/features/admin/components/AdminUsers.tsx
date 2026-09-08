import { useEffect, useState } from "react";
import TablePagination from "@/components/ui/TablePagination";
import { useServerTable } from "@/hooks/useServerTable";
import { useAdmin } from "../AdminContext";
import { createAdminUser, deleteAdminUser, getCurrentAdminUser, listRoles, updateAdminUser } from "../api";
import type { AdminRole, AdminUserRow } from "../types";
import PasswordChange from "./PasswordChange";

interface FormState {
  id: number | null;
  username: string;
  email: string;
  password: string;
  roleId: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = { id: null, username: "", email: "", password: "", roleId: "", isActive: true };

function formatAdminDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminUsers() {
  const { notify } = useAdmin();
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
          setFormError("Username wajib diisi");
          return;
        }
        if (form.password.length < 8) {
          setFormError("Password minimal 8 karakter");
          return;
        }
        await createAdminUser({
          username: form.username.trim(),
          password: form.password,
          email: form.email.trim() || null,
          role_id: roleId,
          is_active: form.isActive,
        });
        notify("Admin berhasil ditambahkan", "s");
      } else {
        if (form.password && form.password.length < 8) {
          setFormError("Password minimal 8 karakter");
          return;
        }
        await updateAdminUser(form.id, {
          email: form.email.trim() || null,
          is_active: form.isActive,
          role_id: roleId,
          ...(form.password ? { new_password: form.password } : {}),
        });
        notify("Admin berhasil diperbarui", "s");
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: AdminUserRow) => {
    if (!confirm(`Hapus admin "${u.username}"?`)) return;
    setBusyId(u.id);
    try {
      await deleteAdminUser(u.id);
      notify("Admin dihapus", "s");
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal menghapus admin", "e");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>Kelola Pengguna Admin</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="btn-sm" onClick={() => setPwOpen((open) => !open)}>
            <i className="bi bi-key" /> Ganti password
          </button>
          <button type="button" className="btn-sm primary" onClick={openCreate}>
            <i className="bi bi-plus-lg" /> Tambah admin
          </button>
        </div>
      </div>
      <div className="card-body-custom">
        <PasswordChange open={pwOpen} onOpenChange={setPwOpen} />

        {formOpen && (
          <div className="collapse-form open" style={{ marginBottom: "0.875rem" }}>
            <div className="two-col" style={{ marginBottom: "0.75rem" }}>
              <div className="form-field">
                <label className="form-label">Username {form.id === null && "*"}</label>
                <input
                  className="form-input"
                  placeholder="cth: budi_admin"
                  value={form.username}
                  disabled={form.id !== null}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Email</label>
                <input
                  className="form-input"
                  placeholder="budi@savegeo.id"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="form-field">
                <label className="form-label">
                  {form.id === null ? "Password (min. 8 karakter) *" : "Password baru (kosongkan jika tidak diganti)"}
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Minimal 8 karakter"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Role</label>
                <select className="form-select" value={form.roleId} onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}>
                  <option value="">Full access</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="cfg-switch" style={{ marginBottom: "0.75rem" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              <span />
              <strong>{form.isActive ? "Akun aktif" : "Akun nonaktif"}</strong>
            </label>
            {formError && <div className="alert alert-danger py-1 px-2 small">{formError}</div>}
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="btn-sm primary" disabled={saving} onClick={handleSave}>
                <i className="bi bi-save" /> {saving ? "Menyimpan..." : form.id === null ? "Simpan" : "Update"}
              </button>
              <button type="button" className="btn-sm" onClick={() => setFormOpen(false)}>
                Batal
              </button>
            </div>
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table className="tbl tbl-wide">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Dibuat</th>
                <th>Login terakhir</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    Memuat...
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
                    Belum ada admin.
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
                    <td>{u.role || "Full access"}</td>
                    <td>
                      <span className={`stat-badge ${u.is_active ? "badge-green" : "badge-gray"}`}>{u.is_active ? "Aktif" : "Nonaktif"}</span>
                    </td>
                    <td>{formatAdminDate(u.created_at)}</td>
                    <td>{formatAdminDate(u.last_login)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" className="btn-xs" title="Edit" aria-label="Edit" onClick={() => openEdit(u)}>
                          <i className="bi bi-pencil-square" />
                        </button>
                        <button
                          type="button"
                          className="btn-xs danger"
                          title="Hapus"
                          aria-label="Hapus"
                          disabled={busyId === u.id || me?.id === u.id}
                          onClick={() => handleDelete(u)}
                        >
                          <i className="bi bi-trash3" />
                        </button>
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
          searchPlaceholder="Cari username, email, role..."
        />
      </div>
    </div>
  );
}
