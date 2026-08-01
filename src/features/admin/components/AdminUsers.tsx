import { useEffect, useState } from "react";
import { getCurrentAdminUser } from "../api";
import type { AdminUserRow } from "../types";
import PasswordChange from "./PasswordChange";

export default function AdminUsers() {
  const [user, setUser] = useState<AdminUserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pwOpen, setPwOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getCurrentAdminUser();
      setUser(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data admin");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>Administrator terdaftar</span>
      </div>
      <div className="card-body-custom">
        <table className="tbl">
          <colgroup>
            <col style={{ width: "35%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "15%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>User</th>
              <th>Status</th>
              <th>Dibuat</th>
              <th>Login terakhir</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--danger-color, #e53935)", padding: "1.5rem" }}>
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && user && (
              <tr>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "#1d4ed8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        color: "#fff",
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {user.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{user.username}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{user.email || "—"}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`stat-badge ${user.is_active ? "badge-green" : "badge-red"}`}>
                    {user.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {user.created_at ? new Date(user.created_at).toLocaleDateString("id-ID") : "—"}
                </td>
                <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {user.last_login ? new Date(user.last_login).toLocaleString("id-ID") : "—"}
                </td>
                <td>
                  <button type="button" className="btn-sm" onClick={() => setPwOpen(true)}>
                    Ganti password
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <PasswordChange open={pwOpen} onOpenChange={setPwOpen} />
      </div>
    </div>
  );
}
