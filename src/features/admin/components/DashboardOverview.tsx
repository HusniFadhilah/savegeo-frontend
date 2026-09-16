import { useEffect, useState } from "react";
import { getHealth, getGeeStatus, listModels, getConfig, reinitEE } from "../api";
import type { AdminSection } from "../types";
import { useAdmin } from "../AdminContext";
import { useAuthStore } from "@/hooks/useAuthStore";
import { hasAdminPermission } from "@/auth/access";
import { useI18nStore } from "@/hooks/useI18nStore";

interface OverviewData {
  eeOk: boolean;
  activeCredLabel: string;
  activeCredEmail: string | null;
  modelCount: number | string;
  cfgCount: number | string;
}

export default function DashboardOverview({ onNavigate }: { onNavigate: (s: AdminSection) => void }) {
  const { refreshHealth, notify } = useAdmin();
  const { user } = useAuthStore();
  const { language, t } = useI18nStore();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reiniting, setReiniting] = useState(false);
  const canCredentialRead = hasAdminPermission(user, "credential.read");
  const canModelRead = hasAdminPermission(user, "model.read");
  const canConfigRead = hasAdminPermission(user, "config.read");
  const canCredentialWrite = hasAdminPermission(user, "credential.write");
  const canModelWrite = hasAdminPermission(user, "model.write");
  const canConfigWrite = hasAdminPermission(user, "config.write");
  const today = new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const greeting = t(new Date().getHours() < 11 ? "admin.greeting.morning" : new Date().getHours() < 15 ? "admin.greeting.afternoon" : new Date().getHours() < 19 ? "admin.greeting.evening" : "admin.greeting.night");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [health, gee, models, cfg] = await Promise.all([
        getHealth(),
        canCredentialRead ? getGeeStatus() : Promise.resolve(null),
        canModelRead ? listModels("carbon") : Promise.resolve(null),
        canConfigRead ? getConfig() : Promise.resolve(null),
      ]);
      const cfgCount = cfg ? Object.values(cfg.config).reduce((s, v) => s + v.length, 0) : "—";
      setData({
        eeOk: Boolean(health.ee_initialized),
        activeCredLabel: gee?.active_credential?.label ?? t("admin.none"),
        activeCredEmail: gee?.active_credential?.client_email ?? null,
        modelCount: models?.models.length ?? "—",
        cfgCount,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.overview.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hero = (
    <div className="adm-hero">
      <div>
    <div className="adm-hero-greeting">{greeting}</div>
        <div className="adm-hero-title">{user?.username ?? t("admin.defaultUser")} 👋</div>
          <div className="adm-hero-sub">
          <i className="bi bi-calendar3 me-1" /> {today}
        </div>
      </div>
      <div className="adm-hero-icon">
        <i className="bi bi-speedometer2" />
      </div>
    </div>
  );

  if (loading) {
    return (
      <>
        {hero}
        <div className="adm-loading">{t("admin.overview.loading")}</div>
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        {hero}
        <div className="alert alert-danger py-2 px-3 small">
          {error || t("admin.overview.loadFailed")}{" "}
          <button type="button" className="btn-sm" onClick={load}>
            {t("admin.retry")}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {hero}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <i className="bi bi-cpu-fill" />
          </div>
          <div className="stat-val">{data.eeOk ? t("admin.active") : t("admin.offline")}</div>
            <div className="stat-label">{t("admin.stat.earthEngine")}</div>
          <span className={`stat-badge ${data.eeOk ? "badge-green" : "badge-red"}`}>
            {data.eeOk ? t("admin.initialized") : t("admin.notReady")}
          </span>
        </div>
        <div className="stat-card accent-blue">
          <div className="stat-icon">
            <i className="bi bi-key-fill" />
          </div>
          <div className="stat-val" style={{ fontSize: 13, paddingTop: 4 }}>
            {data.activeCredLabel}
          </div>
            <div className="stat-label">{t("admin.stat.activeCredential")}</div>
          <span className="stat-badge badge-blue">{t("admin.serviceAccount")}</span>
        </div>
        <div className="stat-card accent-blue">
          <div className="stat-icon">
            <i className="bi bi-diagram-3-fill" />
          </div>
          <div className="stat-val">{data.modelCount}</div>
            <div className="stat-label">{t("admin.stat.mlModels")}</div>
          <span className="stat-badge badge-blue">{t("admin.carbon")}</span>
        </div>
        <div className="stat-card accent-gray">
          <div className="stat-icon">
            <i className="bi bi-sliders" />
          </div>
          <div className="stat-val">{data.cfgCount}</div>
            <div className="stat-label">{t("admin.stat.configKeys")}</div>
          <span className="stat-badge badge-gray">{t("admin.category")}</span>
        </div>
      </div>
      <div className="two-col">
        <div className="card">
          <div className="card-header-custom">
            <span>{t("admin.overview.systemStatus")}</span>
          </div>
          <div className="card-body-custom">
            {[
              [t("admin.stat.earthEngine"), data.eeOk ? t("admin.initialized") : t("admin.offline"), data.eeOk ? "badge-green" : "badge-red"],
              [t("admin.stat.database"), t("admin.connected"), "badge-green"],
              [
                t("admin.stat.activeCredential"),
                data.activeCredEmail ? data.activeCredEmail.split("@")[0] : t("admin.none"),
                "badge-blue",
              ],
              [t("admin.stat.activeModels"), `${data.modelCount} ${t("admin.carbon")}`, "badge-blue"],
            ].map(([label, val, cls]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.4rem 0",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
                <span className={`stat-badge ${cls}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header-custom">
            <span>{t("admin.overview.quickActions")}</span>
          </div>
          <div className="card-body-custom" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {canCredentialWrite && <button type="button" className="btn-sm primary" onClick={() => onNavigate("ge")}>
              <i className="bi bi-key" /> {t("admin.quick.gee")}
            </button>}
            {canModelWrite && <button type="button" className="btn-sm primary" onClick={() => onNavigate("ml")}>
              <i className="bi bi-upload" /> {t("admin.quick.uploadModel")}
            </button>}
            {canConfigWrite && <button type="button" className="btn-sm primary" onClick={() => onNavigate("cf")}>
              <i className="bi bi-pencil-square" /> {t("admin.quick.config")}
            </button>}
            {canCredentialWrite && <button
              type="button"
              className="btn-sm success"
              disabled={reiniting}
              onClick={async () => {
                setReiniting(true);
                try {
                  await reinitEE();
                  notify(t("admin.reinitSuccess"), "s");
                } catch (err) {
                  notify(err instanceof Error ? err.message : t("admin.reinitFailed"), "e");
                } finally {
                  setReiniting(false);
                  refreshHealth();
                  await load();
                }
              }}
            >
              <i className="bi bi-power" /> {reiniting ? t("admin.processing") : t("admin.quick.reinit")}
            </button>}
          </div>
        </div>
      </div>
    </>
  );
}
