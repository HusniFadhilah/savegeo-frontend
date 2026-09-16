import { useEffect, useState } from "react";
import { getArcgisStatus } from "../api";
import type { ArcgisStatusInfo } from "../types";
import { useI18nStore } from "@/hooks/useI18nStore";

export default function ArcgisStatus() {
  const t = useI18nStore((state) => state.t);
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
      setError(err instanceof Error ? err.message : t("admin.arcgis.loadFailed"));
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
        <span>{t("admin.arcgis.title")}</span>
        <button type="button" className="btn-sm" onClick={load} disabled={loading}>
          <i className="bi bi-arrow-clockwise" /> {t("admin.refresh")}
        </button>
      </div>
      <div className="card-body-custom">
        {loading && <div style={{ color: "var(--text-muted)", padding: "12px 0" }}>{t("admin.loadingStatus")}</div>}
        {!loading && error && (
          <div style={{ color: "var(--danger-color, #e53935)" }}>{t("admin.arcgis.loadFailed")}: {error}</div>
        )}
        {!loading && !error && status && (
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              <tr>
                <td style={{ padding: "6px 0", color: "var(--text-muted)", width: 160 }}>{t("admin.status")}</td>
                <td>
                  <span className={`stat-badge ${status.enabled ? "badge-green" : "badge-gray"}`}>
                    {status.enabled ? t("admin.enabled") : t("admin.disabled")}
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: "6px 0", color: "var(--text-muted)" }}>{t("admin.credential")}</td>
                <td>
                  <span className={`stat-badge ${status.configured ? "badge-green" : "badge-amber"}`}>
                    {status.configured ? t("admin.configured") : t("admin.notConfigured")}
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: "6px 0", color: "var(--text-muted)" }}>{t("admin.authMode")}</td>
                <td>
                  <code>{status.auth_mode || "—"}</code>
                </td>
              </tr>
              <tr>
                <td style={{ padding: "6px 0", color: "var(--text-muted)" }}>{t("admin.portalUrl")}</td>
                <td>
                  <code>{status.portal_url || "—"}</code>
                </td>
              </tr>
              {status.can_reach_portal !== undefined && status.can_reach_portal !== null && (
                <tr>
                  <td style={{ padding: "6px 0", color: "var(--text-muted)" }}>{t("admin.portalConnection")}</td>
                  <td>
                    <span className={`stat-badge ${status.can_reach_portal ? "badge-green" : "badge-red"}`}>
                      {status.can_reach_portal ? t("admin.reachable") : t("admin.unreachable")}
                    </span>{" "}
                    {status.portal_error && (
                      <span style={{ color: "var(--danger-color, #e53935)", fontSize: 11 }}>{status.portal_error}</span>
                    )}
                  </td>
                </tr>
              )}
              {status.portal_name && (
                <tr>
                  <td style={{ padding: "6px 0", color: "var(--text-muted)" }}>{t("admin.portalName")}</td>
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
                <td style={{ padding: "6px 0", color: "var(--text-muted)" }}>{t("admin.checkedAt")}</td>
                <td style={{ fontSize: 11 }}>{status.checked_at || "—"}</td>
              </tr>
            </tbody>
          </table>
          </div>
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
          <strong>{t("admin.arcgis.enableGuide")}</strong>
          <br />
          {t("admin.arcgis.envGuide")} <code>.env</code> backend:
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
          {t("admin.arcgis.secretNotice")}
        </div>
      </div>
    </div>
  );
}
