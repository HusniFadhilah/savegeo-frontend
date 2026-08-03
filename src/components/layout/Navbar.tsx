import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { useI18nStore } from "@/hooks/useI18nStore";
import SystemStatusModal from "@/components/modals/SystemStatusModal";

export default function Navbar() {
  const { state } = useConnectionStatus();
  const { isAuthenticated, user, logout } = useAuthStore();
  const t = useI18nStore((s) => s.t);
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
    <nav className="navbar navbar-dark bg-dark py-2">
      <div className="container-fluid d-flex align-items-center">
        <div className="d-flex align-items-center gap-2 me-3">
          <img
            src="https://upload.wikimedia.org/wikipedia/id/2/20/Logo_Universitas_Diponegoro.png"
            alt="Universitas Diponegoro"
            height={36}
            className="bg-light rounded p-1"
          />
          <img
            src="https://upload.wikimedia.org/wikipedia/id/8/88/Logo_Len_Industri_Baru.png"
            alt="PT LEN Industri"
            height={36}
            className="bg-light rounded p-1"
          />
        </div>

        <div className="flex-grow-1 text-center px-3">
          <div className="navbar-brand m-0 p-0 fw-semibold text-wrap">
            <i className="bi bi-globe-asia-australia" /> SAVEGEO – Geospatial System for Vegetation, Land Cover,
            and Carbon Estimation
          </div>
          <div className="text-white small text-wrap">{t("nav.collaboration")}</div>
        </div>

        <div className="ms-3 d-flex align-items-center gap-2">
          <button
            type="button"
            className={`badge navbar-status-btn ${statusBadgeClass}`}
            onClick={() => setStatusOpen(true)}
            title="View system status"
          >
            <i className={`bi ${state === "connecting" ? "bi-arrow-repeat spin" : "bi-broadcast"}`} /> {statusLabel}
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
        </div>
      </div>
      <SystemStatusModal open={statusOpen} onClose={() => setStatusOpen(false)} />
    </nav>
  );
}
