import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/hooks/useAuthStore";
import "@/styles/admin.css";
import { AdminContext, type ToastType } from "./AdminContext";
import type { AdminSection } from "./types";
import { getHealth, reinitEE } from "./api";
import DashboardOverview from "./components/DashboardOverview";
import GeeCredentials from "./components/GeeCredentials";
import ArcgisStatus from "./components/ArcgisStatus";
import ModelRegistry from "./components/ModelRegistry";
import ConfigEditor from "./components/ConfigEditor";
import AdminUsers from "./components/AdminUsers";
import CompanyBoundaries from "./components/CompanyBoundaries";
import SatelliteProviders from "./components/SatelliteProviders";
import DisasterManagement from "./components/disaster/DisasterManagement";

const NAV_SECTIONS: { section: string; items: { id: AdminSection; icon: string; label: string }[] }[] = [
  { section: "Utama", items: [{ id: "ov", icon: "bi-grid-1x2-fill", label: "Overview" }] },
  {
    section: "Konfigurasi",
    items: [
      { id: "ge", icon: "bi-broadcast-pin", label: "GEE Credentials" },
      { id: "ag", icon: "bi-geo-alt-fill", label: "ArcGIS" },
      { id: "ml", icon: "bi-cpu-fill", label: "ML Models" },
      { id: "cf", icon: "bi-sliders", label: "System Config" },
      { id: "us", icon: "bi-shield-lock-fill", label: "Admin Users" },
      { id: "sp", icon: "bi-camera-fill", label: "Satellite Providers" },
    ],
  },
  {
    section: "Data Spasial",
    items: [
      { id: "co", icon: "bi-building-fill", label: "Batas Perusahaan" },
      { id: "ds", icon: "bi-exclamation-triangle-fill", label: "Disaster Management" },
    ],
  },
];

const TITLES: Record<AdminSection, [string, string]> = {
  ov: ["Overview", "Dashboard sistem SAVEGEO"],
  ge: ["GEE Credentials", "Kelola service account Google Earth Engine"],
  ag: ["ArcGIS", "Status integrasi ArcGIS Living Atlas"],
  ml: ["ML Models", "Kelola model machine learning yang diupload"],
  cf: ["System Config", "Konfigurasi aplikasi tersimpan di database"],
  us: ["Admin Users", "Kelola akun administrator"],
  sp: ["Satellite Providers", "Kelola sumber citra satelit (Sentinel-2/Landsat) + resolusi/koleksi GEE"],
  co: ["Batas Perusahaan", "Kelola batas wilayah konsesi dan perusahaan industri"],
  ds: ["Disaster Management", "Kelola kejadian bencana, AOI, citra satelit, dan analisis"],
};

export default function AdminDashboard() {
  const { user, logout } = useAuthStore();
  const [section, setSection] = useState<AdminSection>("ov");
  const [eeInitialized, setEeInitialized] = useState<boolean | null>(null);
  const [reiniting, setReiniting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleReinit = async () => {
    setReiniting(true);
    try {
      await reinitEE();
      notify("Earth Engine berhasil diinisialisasi ulang", "s");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal reinit EE", "e");
    } finally {
      setReiniting(false);
      refreshHealth();
    }
  };

  const [title, subtitle] = TITLES[section];
  const initials = (user?.username ?? "AD").slice(0, 2).toUpperCase();

  return (
    <AdminContext.Provider value={{ notify, refreshHealth, eeInitialized }}>
      <div className="admin-panel">
        <div className="layout">
          <div className="sidebar">
            <Link to="/" className="sb-logo" style={{ textDecoration: "none" }}>
              <img src="/logo.jpg" alt="SAVEGEO" className="sb-logo-img" />
              <div className="sb-logo-text">
                SAVEGEO <small>Admin Panel v1.0</small>
              </div>
            </Link>
            <div className="sb-nav">
              {NAV_SECTIONS.map((grp) => (
                <div key={grp.section}>
                  <div className="sb-section">{grp.section}</div>
                  {grp.items.map((item) => (
                    <a
                      key={item.id}
                      className={`sb-item ${section === item.id ? "active" : ""}`}
                      onClick={() => setSection(item.id)}
                    >
                      <i className={`bi ${item.icon}`} />
                      <span>{item.label}</span>
                    </a>
                  ))}
                </div>
              ))}
            </div>
            <div className="sb-foot">
              <div className="sb-avatar">{initials}</div>
              <span className="sb-foot-name">{user?.username ?? "admin"}</span>
              <span className="sb-foot-logout" onClick={logout} title="Logout">
                <i className="bi bi-box-arrow-right" />
              </span>
            </div>
          </div>

          <div className="main">
            <div className="topbar">
              <div>
                <div className="topbar-title">{title}</div>
                <div className="topbar-sub">{subtitle}</div>
              </div>
              <div className="topbar-right">
                <div className={`ee-badge ${eeInitialized ? "ok" : "fail"}`}>
                  <div className="ee-dot" />
                  <span>{eeInitialized === null ? "Checking..." : eeInitialized ? "Earth Engine aktif" : "Earth Engine offline"}</span>
                </div>
                <button type="button" className="btn-sm" disabled={reiniting} onClick={handleReinit}>
                  <i className="bi bi-arrow-repeat" /> Reinit EE
                </button>
              </div>
            </div>

            <div className="page-content">
              {section === "ov" && <DashboardOverview onNavigate={setSection} />}
              {section === "ge" && <GeeCredentials />}
              {section === "ag" && <ArcgisStatus />}
              {section === "ml" && <ModelRegistry />}
              {section === "cf" && <ConfigEditor />}
              {section === "us" && <AdminUsers />}
              {section === "sp" && <SatelliteProviders />}
              {section === "co" && <CompanyBoundaries />}
              {section === "ds" && <DisasterManagement />}
            </div>
          </div>
        </div>

        {toast && <div className={`adm-toast ${toast.type}`}>{toast.message}</div>}
      </div>
    </AdminContext.Provider>
  );
}
