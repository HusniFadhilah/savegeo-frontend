import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isViewerRole } from "@/auth/access";
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
    state === "online" ? ` ${t("status.online")}` : state === "offline" ? ` ${t("status.offline")}` : ` ${t("status.connecting")}`;
  const statusBadgeClass =
    state === "online" ? "bg-success-subtle text-success" : state === "offline" ? "bg-danger-subtle text-danger" : "bg-light text-dark";

  const activeIsAdmin = isAuthenticated;
  const activeUser = activeIsAdmin ? user : appUser;
  const isViewer = activeIsAdmin && isViewerRole(user?.role);

  const handleLogout = () => {
    if (isAuthenticated) logout();
    if (isUserAuthenticated) logoutUser();
    setMenuOpen(false);
    navigate("/");
  };

  return (
    <nav className="navbar navbar-dark bg-dark app-navbar">
      <div className="container-fluid d-flex align-items-center gap-3">
        <Link to="/" className="navbar-brand app-brand m-0 p-0" aria-label={t("home.homeLink")}>
          <img src="/images/savegeo-logo.svg" alt={t("home.brand")} className="app-brand-logo" />
          <div>
            <strong>SaveGeo</strong>
            <span>{t("home.brandTagline")}</span>
          </div>
        </Link>

        <div className="ms-auto d-flex align-items-center gap-2 navbar-actions">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={isDark ? t("theme.lightMode") : t("theme.darkMode")}
            aria-label={isDark ? t("theme.lightMode") : t("theme.darkMode")}
            aria-pressed={isDark}
          >
            <i className={`bi ${isDark ? "bi-sun-fill" : "bi-moon-stars-fill"}`} />
          </button>

          <button
            type="button"
            className={`badge navbar-status-btn ${statusBadgeClass}`}
            onClick={() => setStatusOpen(true)}
            title={t("status.view")}
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
                      <i className="bi bi-speedometer2 me-2" /> {t("auth.dashboard")}
                    </Link>
                  </li>
                  {isAuthenticated && !isViewer && isUserAuthenticated && (
                    <li>
                      <Link className="dropdown-item" to="/admin" onClick={() => setMenuOpen(false)}>
                      <i className="bi bi-shield-lock me-2" /> {t("auth.adminDashboard")}
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
            aria-label={mobileSidebarOpen ? t("nav.closeMenu") : t("nav.openMenu")}
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
