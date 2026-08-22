import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { useI18nStore } from "@/hooks/useI18nStore";
import { useUiStore } from "@/hooks/useUiStore";
import SystemStatusModal from "@/components/modals/SystemStatusModal";

export default function Navbar() {
  const { state } = useConnectionStatus();
  const { isAuthenticated, user, logout } = useAuthStore();
  const t = useI18nStore((s) => s.t);
  const { mobileSidebarOpen, toggleMobileSidebar } = useUiStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const statusLabel =
    state === "online" ? "Terhubung" : state === "offline" ? "Terputus" : "Menghubungkan...";
  const statusBadgeClass =
    state === "online" ? "bg-success-subtle text-success" : state === "offline" ? "bg-danger-subtle text-danger" : "bg-light text-dark";

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/admin");
  };

  return (
    <nav className="navbar navbar-dark bg-dark app-navbar">
      <div className="container-fluid d-flex align-items-center gap-3">
        <div className="navbar-brand app-brand m-0 p-0">
          <img src="/images/savegeo-logo.svg" alt="SaveGeo" className="app-brand-logo" />
          <div>
            <strong>SaveGeo</strong>
            <span>AI Imagery Analytics Platform</span>
          </div>
        </div>

        <div className="ms-auto d-flex align-items-center gap-2 navbar-actions">
          <button
            type="button"
            className={`badge navbar-status-btn ${statusBadgeClass}`}
            onClick={() => setStatusOpen(true)}
            title="View system status"
          >
            <i className={`bi ${state === "connecting" ? "bi-arrow-repeat spin" : "bi-broadcast"}`} />
            <span className="navbar-status-label">{statusLabel}</span>
          </button>

          {isAuthenticated ? (
            <div className="dropdown">
              <button
                type="button"
                className="btn btn-outline-light btn-sm d-flex align-items-center gap-2"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <i className="bi bi-person-circle" />
                <span>{user?.username}</span>
              </button>
              {menuOpen && (
                <ul className="dropdown-menu dropdown-menu-end shadow show" onMouseLeave={() => setMenuOpen(false)}>
                  <li>
                    <h6 className="dropdown-header d-flex align-items-center gap-2 mb-0">
                      <i className="bi bi-person-circle" /> {user?.username}
                    </h6>
                  </li>
                  <li>
                    <Link className="dropdown-item" to="/admin" onClick={() => setMenuOpen(false)}>
                      <i className="bi bi-speedometer2 me-2" /> {t("auth.dashboard")}
                    </Link>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item text-danger" onClick={handleLogout}>
                      <i className="bi bi-box-arrow-right me-2" /> {t("auth.logout")}
                    </button>
                  </li>
                </ul>
              )}
            </div>
          ) : (
            <Link className="btn btn-outline-light btn-sm d-flex align-items-center gap-2" to="/admin">
              <i className="bi bi-box-arrow-in-right" />
              <span>{t("auth.loginAdmin")}</span>
            </Link>
          )}

          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={toggleMobileSidebar}
            aria-label={mobileSidebarOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={mobileSidebarOpen}
          >
            <i className={`bi ${mobileSidebarOpen ? "bi-x-lg" : "bi-list"}`} />
          </button>
        </div>
      </div>
      <SystemStatusModal open={statusOpen} onClose={() => setStatusOpen(false)} />
    </nav>
  );
}
