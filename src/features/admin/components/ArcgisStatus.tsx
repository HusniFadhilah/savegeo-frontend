import { useEffect, useState } from "react";
import { getArcgisStatus } from "../api";
import type { ArcgisStatusInfo } from "../types";

export default function ArcgisStatus() {
  const [status, setStatus] = useState<ArcgisStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getArcgisStatus();
      setStatus(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat status ArcGIS");
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
        <span>ArcGIS Integration Status</span>
        <button type="button" className="btn-sm" onClick={load} disabled={loading}>
          <i className="bi bi-arrow-clockwise" /> Refresh
        </button>
      </div>
      <div className="card-body-custom">
        {loading && <div style={{ color: "var(--text-muted)", padding: "12px 0" }}>Memuat status...</div>}
        {!loading && error && (
          <div style={{ color: "var(--danger-color, #e53935)" }}>Gagal memuat status ArcGIS: {error}</div>
        )}
        {!loading && !error && status && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              <tr>
                <td style={{ padding: "6px 0", color: "var(--text-muted)", width: 160 }}>Status</td>
                <td>
                  <span className={`stat-badge ${status.enabled ? "badge-green" : "badge-gray"}`}>
                    {status.enabled ? "Enabled" : "Disabled"}
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: "6px 0", color: "var(--text-muted)" }}>Credential</td>
                <td>
                  <span className={`stat-badge ${status.configured ? "badge-green" : "badge-amber"}`}>
                    {status.configured ? "Configured" : "Not configured"}
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: "6px 0", color: "var(--text-muted)" }}>Auth mode</td>
                <td>
                  <code>{status.auth_mode || "—"}</code>
                </td>
              </tr>
              <tr>
                <td style={{ padding: "6px 0", color: "var(--text-muted)" }}>Portal URL</td>
                <td>
                  <code>{status.portal_url || "—"}</code>
                </td>
              </tr>
              {status.can_reach_portal !== undefined && status.can_reach_portal !== null && (
                <tr>
                  <td style={{ padding: "6px 0", color: "var(--text-muted)" }}>Koneksi portal</td>
                  <td>
                    <span className={`stat-badge ${status.can_reach_portal ? "badge-green" : "badge-red"}`}>
                      {status.can_reach_portal ? "Reachable" : "Unreachable"}
                    </span>{" "}
                    {status.portal_error && (
                      <span style={{ color: "var(--danger-color, #e53935)", fontSize: 11 }}>{status.portal_error}</span>
                    )}
                  </td>
                </tr>
              )}
              {status.portal_name && (
                <tr>
                  <td style={{ padding: "6px 0", color: "var(--text-muted)" }}>Nama portal</td>
                  <td>{status.portal_name}</td>
                </tr>
              )}
              {status.message && (
                <tr>
                  <td colSpan={2} style={{ padding: "8px 0", color: "var(--text-muted)", fontSize: 12 }}>
                    {status.message}
                  </td>
                </tr>
              )}
              <tr>
                <td style={{ padding: "6px 0", color: "var(--text-muted)" }}>Dicek pada</td>
                <td style={{ fontSize: 11 }}>{status.checked_at || "—"}</td>
              </tr>
            </tbody>
          </table>
        )}
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: "var(--content-bg, #f8fafc)",
            borderRadius: 6,
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          <strong>Cara mengaktifkan ArcGIS:</strong>
          <br />
          Tambahkan env var berikut ke file <code>.env</code> backend:
          <br />
          <br />
          <code>ARCGIS_ENABLED=true</code>
          <br />
          <code>ARCGIS_PORTAL_URL=https://www.arcgis.com</code>
          <br />
          <code>ARCGIS_AUTH_MODE=api_key</code>
          <br />
          <code>ARCGIS_API_KEY=&lt;api-key-anda&gt;</code>
          <br />
          <code>ARCGIS_REQUEST_TIMEOUT=30</code>
          <br />
          <br />
          Token/API key <strong>tidak pernah</strong> dikembalikan ke halaman ini.
        </div>
      </div>
    </div>
  );
}
