import { useEffect, useState, type FormEvent } from "react";
import { hasAdminPermission } from "@/auth/access";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import { useAdmin } from "../AdminContext";
import { getArcgisStatus, saveArcgisConfig } from "../api";
import type { ArcgisStatusInfo } from "../types";

type AuthMode = "none" | "api_key";

export default function ArcgisStatus() {
  const t = useI18nStore((state) => state.t);
  const { user } = useAuthStore();
  const { notify } = useAdmin();
  const [status, setStatus] = useState<ArcgisStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [portalUrl, setPortalUrl] = useState("https://www.arcgis.com");
  const [authMode, setAuthMode] = useState<AuthMode>("none");
  const [apiKey, setApiKey] = useState("");
  const [requestTimeout, setRequestTimeout] = useState(30);
  const canManageCredentials = hasAdminPermission(user, "secret.write");

  const applyStatus = (next: ArcgisStatusInfo) => {
    setStatus(next);
    setEnabled(next.enabled);
    setPortalUrl(next.portal_url || "https://www.arcgis.com");
    setAuthMode(next.auth_mode === "api_key" ? "api_key" : "none");
    setRequestTimeout(next.request_timeout ?? 30);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      applyStatus(await getArcgisStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.arcgis.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await saveArcgisConfig({
        enabled,
        portal_url: portalUrl.trim(),
        auth_mode: authMode,
        ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
        request_timeout: requestTimeout,
      });
      applyStatus(result.status);
      setApiKey("");
      setFormOpen(false);
      notify(t("admin.arcgis.saved"), "s");
    } catch (err) {
      notify(err instanceof Error ? err.message : t("admin.saveFailed"), "e");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>{t("admin.arcgis.title")}</span>
        <div style={{ display: "flex", gap: 6 }}>
          {canManageCredentials && (
            <button type="button" className="btn-sm primary" onClick={() => setFormOpen((open) => !open)}>
              <i className={`bi ${formOpen ? "bi-x-lg" : "bi-key"}`} /> {t(formOpen ? "admin.cancel" : "admin.arcgis.manageSettings")}
            </button>
          )}
          <button type="button" className="btn-sm" onClick={() => void load()} disabled={loading || saving}>
            <i className="bi bi-arrow-clockwise" /> {t("admin.refresh")}
          </button>
        </div>
      </div>
      <div className="card-body-custom">
        <div className="alert alert-info py-2 px-3 small">
          <strong>{t("admin.arcgis.purposeTitle")}</strong>
          <p className="mb-2 mt-1">{t("admin.arcgis.purposeDescription")}</p>
          <ul className="mb-0 ps-3">
            <li>{t("admin.arcgis.landCoverUse")}</li>
            <li>{t("admin.arcgis.carbonUse")}</li>
            <li>{t("admin.arcgis.proxyUse")}</li>
          </ul>
        </div>

        {formOpen && canManageCredentials && (
          <form onSubmit={handleSave} className="border rounded-3 p-3 mb-3" style={{ background: "var(--content-bg, #f8fafc)" }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <strong>{t("admin.arcgis.manageSettings")}</strong>
              <span className="small text-muted"><i className="bi bi-shield-lock me-1" />{t("admin.arcgis.keyAccessNotice")}</span>
            </div>
            <div className="form-check form-switch mb-3">
              <input id="arcgis-enabled" className="form-check-input" type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              <label className="form-check-label" htmlFor="arcgis-enabled">{t("admin.arcgis.enabledLabel")}</label>
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="arcgis-portal-url">{t("admin.arcgis.portalField")}</label>
                <input id="arcgis-portal-url" className="form-control" type="url" required value={portalUrl} onChange={(event) => setPortalUrl(event.target.value)} placeholder="https://www.arcgis.com" />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="arcgis-auth-mode">{t("admin.arcgis.authModeField")}</label>
                <select id="arcgis-auth-mode" className="form-select" value={authMode} onChange={(event) => setAuthMode(event.target.value as AuthMode)}>
                  <option value="none">{t("admin.arcgis.publicMode")}</option>
                  <option value="api_key">API key</option>
                </select>
              </div>
              {authMode === "api_key" && (
                <div className="col-md-8">
                  <label className="form-label" htmlFor="arcgis-api-key">{t("admin.arcgis.keyField")}</label>
                  <input id="arcgis-api-key" className="form-control" type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={status?.configured ? t("admin.arcgis.keyPlaceholderConfigured") : t("admin.arcgis.keyPlaceholder")} />
                  <div className="form-text">{t("admin.arcgis.keyHint")}</div>
                </div>
              )}
              <div className="col-md-4">
                <label className="form-label" htmlFor="arcgis-timeout">{t("admin.arcgis.timeoutField")}</label>
                <input id="arcgis-timeout" className="form-control" type="number" min={1} max={120} value={requestTimeout} onChange={(event) => setRequestTimeout(Number(event.target.value))} />
              </div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button type="submit" className="btn-sm primary" disabled={saving}>
                <i className={`bi ${saving ? "bi-hourglass-split" : "bi-save"}`} /> {saving ? t("admin.arcgis.saving") : t("admin.arcgis.saveSettings")}
              </button>
            </div>
          </form>
        )}

        {canManageCredentials && !formOpen && (
          <div className="small text-muted mb-3"><i className="bi bi-info-circle me-1" />{t("admin.arcgis.keyAccessNotice")}</div>
        )}
        {!canManageCredentials && (
          <div className="alert alert-secondary py-2 px-3 small">{t("admin.arcgis.manageAccessRequired")}</div>
        )}

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
                  <td><span className={`stat-badge ${status.enabled ? "badge-green" : "badge-gray"}`}>{status.enabled ? t("admin.enabled") : t("admin.disabled")}</span></td>
                </tr>
                <tr>
                  <td style={{ padding: "6px 0", color: "var(--text-muted)" }}>{t("admin.credential")}</td>
                  <td><span className={`stat-badge ${status.configured ? "badge-green" : "badge-amber"}`}>{status.configured ? t("admin.configured") : t("admin.notConfigured")}</span></td>
                </tr>
                <tr>
                  <td style={{ padding: "6px 0", color: "var(--text-muted)" }}>{t("admin.authMode")}</td>
                  <td><code>{status.auth_mode || "—"}</code></td>
                </tr>
                <tr>
                  <td style={{ padding: "6px 0", color: "var(--text-muted)" }}>{t("admin.portalUrl")}</td>
                  <td><code>{status.portal_url || "—"}</code></td>
                </tr>
                {status.can_reach_portal !== undefined && status.can_reach_portal !== null && (
                  <tr>
                    <td style={{ padding: "6px 0", color: "var(--text-muted)" }}>{t("admin.portalConnection")}</td>
                    <td>
                      <span className={`stat-badge ${status.can_reach_portal ? "badge-green" : "badge-red"}`}>
                        {status.can_reach_portal ? t("admin.reachable") : t("admin.unreachable")}
                      </span>{" "}
                      {status.portal_error && <span style={{ color: "var(--danger-color, #e53935)", fontSize: 11 }}>{status.portal_error}</span>}
                    </td>
                  </tr>
                )}
                {status.portal_name && (
                  <tr><td style={{ padding: "6px 0", color: "var(--text-muted)" }}>{t("admin.portalName")}</td><td>{status.portal_name}</td></tr>
                )}
                {status.message && (
                  <tr><td colSpan={2} style={{ padding: "8px 0", color: "var(--text-muted)", fontSize: 12 }}>{status.message}</td></tr>
                )}
                <tr>
                  <td style={{ padding: "6px 0", color: "var(--text-muted)" }}>{t("admin.checkedAt")}</td>
                  <td style={{ fontSize: 11 }}>{status.checked_at || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
