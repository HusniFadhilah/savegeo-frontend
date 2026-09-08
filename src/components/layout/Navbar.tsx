import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { useI18nStore } from "@/hooks/useI18nStore";
import { useThemeMode } from "@/hooks/useThemeMode";
import { useUiStore } from "@/hooks/useUiStore";
import SystemStatusModal from "@/components/modals/SystemStatusModal";

export default function Navbar() {
  const { state } = useConnectionStatus();
  const { isAuthenticated, user, logout } = useAuthStore();
  const { isAuthenticated: isUserAuthenticated, user: appUser, logout: logoutUser } = useUserAuthStore();
  const t = useI18nStore((s) => s.t);
  const { isDark, toggleTheme } = useThemeMode();
  const { mobileSidebarOpen, toggleMobileSidebar } = useUiStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const statusLabel =
    state === "online" ? " Terhubung" : state === "offline" ? " Terputus" : " Menghubungkan...";
  const statusBadgeClass =
    state === "online" ? "bg-success-subtle text-success" : state === "offline" ? "bg-danger-subtle text-danger" : "bg-light text-dark";

  const activeIsAdmin = isAuthenticated && !isUserAuthenticated;
  const activeUser = activeIsAdmin ? user : appUser;

  const handleLogout = () => {
    if (isAuthenticated) logout();
    if (isUserAuthenticated) logoutUser();
    setMenuOpen(false);
    navigate("/");
  };

  return (
    <nav className="navbar navbar-dark bg-dark app-navbar">
      <div className="container-fluid d-flex align-items-center gap-3">
        <Link to="/" className="navbar-brand app-brand m-0 p-0" aria-label="SaveGeo beranda">
          <img src="/images/savegeo-logo.svg" alt="SaveGeo" className="app-brand-logo" />
          <div>
            <strong>SaveGeo</strong>
            <span>AI Imagery Analytics Platform</span>
          </div>
        </Link>

        <div className="ms-auto d-flex align-items-center gap-2 navbar-actions">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={isDark ? "Gunakan light mode" : "Gunakan dark mode"}
            aria-label={isDark ? "Gunakan light mode" : "Gunakan dark mode"}
            aria-pressed={isDark}
          >
            <i className={`bi ${isDark ? "bi-sun-fill" : "bi-moon-stars-fill"}`} />
          </button>

          <button
            type="button"
            className={`badge navbar-status-btn ${statusBadgeClass}`}
            onClick={() => setStatusOpen(true)}
            title="View system status"
          >
            <i className={`bi ${state === "connecting" ? "bi-arrow-repeat spin" : "bi-broadcast"}`} />
            <span className="navbar-status-label">{statusLabel}</span>
          </button>

          {isAuthenticated || isUserAuthenticated ? (
            <div className="dropdown">
              <button
                type="button"
                className="btn btn-outline-light btn-sm d-flex align-items-center gap-2"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <i className="bi bi-person-circle" />
                <span>{activeUser?.username}</span>
              </button>
              {menuOpen && (
                <ul className="dropdown-menu dropdown-menu-end shadow show" onMouseLeave={() => setMenuOpen(false)}>
                  <li>
                    <h6 className="dropdown-header d-flex align-items-center gap-2 mb-0">
                      <i className="bi bi-person-circle" /> {activeUser?.username}
                    </h6>
                  </li>
                  <li>
                    <Link className="dropdown-item" to="/dashboard" onClick={() => setMenuOpen(false)}>
                      <i className="bi bi-speedometer2 me-2" /> Dashboard
                    </Link>
                  </li>
                  {isAuthenticated && !activeIsAdmin && (
                    <li>
                      <Link className="dropdown-item" to="/admin" onClick={() => setMenuOpen(false)}>
                        <i className="bi bi-shield-lock me-2" /> Dashboard Admin
                      </Link>
                    </li>
                  )}
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
