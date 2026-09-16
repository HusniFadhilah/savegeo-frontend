import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/hooks/useAuthStore";
import { hasAdminPermission } from "@/auth/access";
import { useI18nStore } from "@/hooks/useI18nStore";
import "@/styles/admin.css";
import { AdminContext, type ToastType } from "./AdminContext";
import type { AdminSection } from "./types";
import { DEFAULT_ADMIN_SECTION, getAdminSectionPath, getAdminSectionSeo } from "@/routes/adminSectionRoutes";
import { getHealth, reinitEE } from "./api";
import DashboardOverview from "./components/DashboardOverview";
import GeeCredentials from "./components/GeeCredentials";
import ArcgisStatus from "./components/ArcgisStatus";
import ModelRegistry from "./components/ModelRegistry";
import CarbonCalibration from "./components/CarbonCalibration";
import ConfigEditor from "./components/ConfigEditor";
import AdminUsers from "./components/AdminUsers";
import CompanyBoundaries from "./components/CompanyBoundaries";
import SatelliteProviders from "./components/SatelliteProviders";
import DisasterManagement from "./components/disaster/DisasterManagement";
import CloudDatasetPanel from "@/features/geospatial/CloudDatasetPanel";
import { lazy, Suspense } from "react";

const ResearchInformation = lazy(() => import("./components/ResearchInformation"));

const NAV_SECTIONS: { sectionKey: string; items: { id: AdminSection; icon: string; labelKey: string; permission: string }[] }[] = [
  { sectionKey: "admin.nav.main", items: [{ id: "ov", icon: "bi-grid-1x2-fill", labelKey: "admin.menu.overview", permission: "config.read" }] },
  {
    sectionKey: "admin.nav.configuration",
    items: [
      { id: "ge", icon: "bi-broadcast-pin", labelKey: "admin.menu.gee", permission: "credential.read" },
      { id: "ag", icon: "bi-geo-alt-fill", labelKey: "admin.menu.arcgis", permission: "credential.read" },
      { id: "ml", icon: "bi-cpu-fill", labelKey: "admin.menu.models", permission: "model.read" },
      { id: "cc", icon: "bi-tree-fill", labelKey: "admin.menu.calibration", permission: "calibration.read" },
      { id: "cf", icon: "bi-sliders", labelKey: "admin.menu.config", permission: "config.read" },
      { id: "us", icon: "bi-shield-lock-fill", labelKey: "admin.menu.users", permission: "users.read" },
      { id: "sp", icon: "bi-camera-fill", labelKey: "admin.menu.satellites", permission: "satellite.read" },
    ],
  },
  {
    sectionKey: "admin.nav.spatialData",
    items: [
      { id: "co", icon: "bi-building-fill", labelKey: "admin.menu.companies", permission: "company.read" },
      { id: "ds", icon: "bi-exclamation-triangle-fill", labelKey: "admin.menu.disasters", permission: "disaster.read" },
      { id: "gd", icon: "bi-database-fill-gear", labelKey: "admin.menu.geospatial", permission: "geospatial.read" },
    ],
  },
  // {
  //   section: "Internal",
  //   items: [{ id: "ri", icon: "bi-lock-fill", label: "Informasi Riset" }],
  // },
];

const TITLES: Record<AdminSection, [string, string]> = {
  ov: ["admin.title.overview", "admin.subtitle.overview"],
  ge: ["admin.title.gee", "admin.subtitle.gee"],
  ag: ["admin.title.arcgis", "admin.subtitle.arcgis"],
  ml: ["admin.title.models", "admin.subtitle.models"],
  cc: ["admin.title.calibration", "admin.subtitle.calibration"],
  cf: ["admin.title.config", "admin.subtitle.config"],
  us: ["admin.title.users", "admin.subtitle.users"],
  sp: ["admin.title.satellites", "admin.subtitle.satellites"],
  co: ["admin.title.companies", "admin.subtitle.companies"],
  ds: ["admin.title.disasters", "admin.subtitle.disasters"],
  gd: ["admin.title.geospatial", "admin.subtitle.geospatial"],
  ri: ["admin.title.research", "admin.subtitle.research"],
};

export default function AdminDashboard({ section: routeSection = DEFAULT_ADMIN_SECTION }: { section?: AdminSection }) {
  const { user, logout } = useAuthStore();
  const { language, setLanguage, t } = useI18nStore();
  const navigate = useNavigate();
  const [section, setSection] = useState<AdminSection>(routeSection);
  const [eeInitialized, setEeInitialized] = useState<boolean | null>(null);
  const [reiniting, setReiniting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mobile off-canvas drawer - the sidebar used to just go `position: static;
  // width: 100%` below 560px, dumping the entire nav (all sections) inline
  // above the topbar/content instead of collapsing, so a phone visitor had
  // to scroll past the whole green menu before seeing anything else. Local
  // state (not shared useUiStore - admin has its own section nav, not the
  // main app's DashboardModule) mirrors the main app's Sidebar/Navbar pattern.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const selectSection = (id: AdminSection, event?: ReactMouseEvent<HTMLAnchorElement>) => {
    event?.preventDefault();
    setSection(id);
    navigate(getAdminSectionPath(id));
    setMobileNavOpen(false);
  };

  const notify = useCallback((message: string, type: ToastType = "s") => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const refreshHealth = useCallback(() => {
    getHealth()
      .then((h) => setEeInitialized(Boolean(h.ee_initialized)))
      .catch(() => setEeInitialized(false));
  }, []);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  useEffect(() => {
    setSection(routeSection);
  }, [routeSection]);

  useEffect(() => {
    const seo = getAdminSectionSeo(routeSection);
    document.title = seo.title;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = seo.description;
  }, [routeSection]);

  const handleReinit = async () => {
    setReiniting(true);
    try {
      await reinitEE();
      notify(t("admin.reinitSuccess"), "s");
    } catch (err) {
      notify(err instanceof Error ? err.message : t("admin.reinitFailed"), "e");
    } finally {
      setReiniting(false);
      refreshHealth();
    }
  };

  const [titleKey, subtitleKey] = TITLES[section];
  const initials = (user?.username ?? "AD").slice(0, 2).toUpperCase();
  const canReinitializeEe = hasAdminPermission(user, "credential.write");

  return (
    <AdminContext.Provider value={{ notify, refreshHealth, eeInitialized }}>
      <div className="admin-panel">
        <div className="layout">
          {mobileNavOpen && <div className="sb-backdrop" onClick={() => setMobileNavOpen(false)} />}

          <div className={`sidebar ${mobileNavOpen ? "mobile-open" : ""}`}>
            <Link to="/carbon-estimation" className="sb-logo" style={{ textDecoration: "none" }}>
              <img src="/logo.jpg" alt={t("home.brand")} className="sb-logo-img" />
              <div className="sb-logo-text">
                SAVEGEO <small>{t("admin.panelVersion")}</small>
              </div>
            </Link>
            <div className="sb-nav">
              {NAV_SECTIONS.map((grp) => {
                const items = grp.items.filter((item) => hasAdminPermission(user, item.permission));
                if (!items.length) return null;
                return (
                  <div key={grp.sectionKey}>
                    <div className="sb-section">{t(grp.sectionKey)}</div>
                    {items.map((item) => (
                      <a
                        key={item.id}
                        className={`sb-item ${section === item.id ? "active" : ""}`}
                        href={getAdminSectionPath(item.id)}
                        onClick={(event) => selectSection(item.id, event)}
                      >
                        <i className={`bi ${item.icon}`} />
                        <span>{t(item.labelKey)}</span>
                      </a>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="sb-foot">
              <div className="sb-avatar">{initials}</div>
              <span className="sb-foot-name">{user?.username ?? t("admin.defaultUser")}</span>
              <span className="sb-foot-logout" onClick={logout} title={t("auth.logout")}>
                <i className="bi bi-box-arrow-right" />
              </span>
            </div>
          </div>

          <div className="main">
            <div className="topbar">
              <div className="topbar-left">
                <button
                  type="button"
                  className="sb-mobile-toggle"
                  onClick={() => setMobileNavOpen((v) => !v)}
                  aria-label={mobileNavOpen ? t("nav.closeMenu") : t("nav.openMenu")}
                  aria-expanded={mobileNavOpen}
                >
                  <i className={`bi ${mobileNavOpen ? "bi-x-lg" : "bi-list"}`} />
                </button>
                <div>
              <div className="topbar-title">{t(titleKey)}</div>
              <div className="topbar-sub">{t(subtitleKey)}</div>
                </div>
              </div>
              <div className="topbar-right">
                <div className="admin-language-switch" role="group" aria-label={t("language.label")}>
                  <button type="button" className={`btn-sm ${language === "id" ? "active" : ""}`} onClick={() => setLanguage("id")} aria-pressed={language === "id"}>ID</button>
                  <button type="button" className={`btn-sm ${language === "en" ? "active" : ""}`} onClick={() => setLanguage("en")} aria-pressed={language === "en"}>EN</button>
                </div>
                <div className={`ee-badge ${eeInitialized ? "ok" : "fail"}`}>
                  <div className="ee-dot" />
                  <span>{eeInitialized === null ? t("admin.checking") : eeInitialized ? t("admin.eeActive") : t("admin.eeOffline")}</span>
                </div>
                {canReinitializeEe && <button type="button" className="btn-sm" disabled={reiniting} onClick={handleReinit}>
                  <i className="bi bi-arrow-repeat" /> {t("admin.reinitEe")}
                </button>}
              </div>
            </div>

            <div className="page-content">
              {section === "ov" && <DashboardOverview onNavigate={selectSection} />}
              {section === "ge" && <GeeCredentials />}
              {section === "ag" && <ArcgisStatus />}
              {section === "ml" && <ModelRegistry />}
              {section === "cc" && <CarbonCalibration />}
              {section === "cf" && <ConfigEditor />}
              {section === "us" && <AdminUsers />}
              {section === "sp" && <SatelliteProviders />}
              {section === "co" && <CompanyBoundaries />}
              {section === "ds" && <DisasterManagement />}
              {section === "gd" && <CloudDatasetPanel />}
              {/* {section === "ri" && (
                <Suspense fallback={<div className="adm-loading">Memuat informasi riset...</div>}>
                  <ResearchInformation />
                </Suspense>
              )} */}
            </div>
          </div>
        </div>

        {toast && <div className={`adm-toast ${toast.type}`}>{toast.message}</div>}
      </div>
    </AdminContext.Provider>
  );
}
