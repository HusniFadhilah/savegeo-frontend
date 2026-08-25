import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useUiStore, type DashboardModule } from "@/hooks/useUiStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import type { Language } from "@/i18n/translations";
import { getDashboardModulePath } from "@/routes/dashboardModuleRoutes";

const MENU: { id: DashboardModule; icon: string; labelKey: string }[] = [
  { id: "carbon", icon: "bi-tree-fill", labelKey: "sidebar.carbon" },
  { id: "lc-change", icon: "bi-arrow-left-right", labelKey: "sidebar.landChangeShort" },
  { id: "imagery", icon: "bi-camera", labelKey: "sidebar.imagery" },
  { id: "disaster", icon: "bi-activity", labelKey: "sidebar.disaster" },
  { id: "crop-monitoring", icon: "bi-flower2", labelKey: "sidebar.cropMonitoring" },
  { id: "guide", icon: "bi-journal-text", labelKey: "sidebar.guide" },
  { id: "about", icon: "bi-info-circle-fill", labelKey: "sidebar.about" },
];

export default function Sidebar() {
  const { activeModule, setActiveModule, sidebarCollapsed, toggleSidebar, mobileSidebarOpen, closeMobileSidebar } = useUiStore();
  const { language, setLanguage, t } = useI18nStore();
  const navigate = useNavigate();
  const [langOpen, setLangOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const selectModule = (m: DashboardModule, event?: ReactMouseEvent<HTMLAnchorElement>) => {
    event?.preventDefault();
    // "disaster" moved out of the in-page module-tab system into its own
    // login-gated route (`/pemetaan-bencana` - the redesigned Disaster
    // Intelligence Dashboard). The old in-page module still exists (now just
    // the legacy BMKG/DEM/InaRISK panels, folded into the new dashboard's
    // "Additional Sources" section too) but is no longer reachable from here
    // to avoid two different things both being called "Pemetaan Bencana".
    if (m === "disaster") {
      setActiveModule(m);
      navigate(getDashboardModulePath(m));
      closeMobileSidebar();
      return;
    }
    setActiveModule(m);
    navigate(getDashboardModulePath(m));
    closeMobileSidebar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectLanguage = (lang: Language) => {
    setLanguage(lang);
    setLangOpen(false);
  };

  // The sidebar sets `overflow-y: auto`, which per the CSS spec forces the
  // other axis to compute as `auto` too (not `visible`) - so a normal
  // absolutely-positioned dropdown-menu gets silently clipped to a sliver.
  // Render it in a portal at a fixed screen position instead, same fix the
  // legacy app did in JS (`positionLanguageDropdown`).
  useEffect(() => {
    if (!langOpen || !toggleRef.current) {
      setMenuPos(null);
      return;
    }
    const rect = toggleRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  }, [langOpen]);

  useEffect(() => {
    if (!langOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (toggleRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setLangOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [langOpen]);

  return (
    <>
      <div className={`main-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${mobileSidebarOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-header">
          <span>
            <i className="bi bi-grid-3x3-gap-fill" /> <span className="header-text">{t("sidebar.modules")}</span>
          </span>
          <button type="button" className="sidebar-toggle" onClick={toggleSidebar} title="Toggle sidebar">
            <i className="bi bi-chevron-right" />
          </button>
        </div>
        <ul className="sidebar-menu">
          {MENU.map((item) => (
            <li key={item.id}>
              <a
                className={`sidebar-menu-item ${activeModule === item.id ? "active" : ""}`}
                href={getDashboardModulePath(item.id)}
                onClick={(event) => selectModule(item.id, event)}
                data-tooltip={t(item.labelKey)}
              >
                <i className={`bi ${item.icon}`} />
                <span className="sidebar-menu-text">{t(item.labelKey)}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <div className="sidebar-language-label">
            <i className="bi bi-translate" />
            <span className="sidebar-menu-text">{t("sidebar.language")}</span>
          </div>
          <div className="dropdown language-dropdown">
            <button
              ref={toggleRef}
              type="button"
              className="btn btn-light btn-sm dropdown-toggle language-toggle"
              onClick={() => setLangOpen((v) => !v)}
            >
              <span className="language-code">{language.toUpperCase()}</span>
            </button>
            {langOpen &&
              menuPos &&
              createPortal(
                <ul
                  ref={menuRef}
                  className="dropdown-menu shadow language-menu show"
                  style={{ position: "fixed", top: menuPos.top, left: menuPos.left, minWidth: Math.max(menuPos.width, 150) }}
                >
                  <li>
                    <button type="button" className="dropdown-item language-option" onClick={() => selectLanguage("id")}>
                      <span className="language-code">ID</span> <span>Indonesia</span>
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item language-option" onClick={() => selectLanguage("en")}>
                      <span className="language-code">EN</span> <span>English</span>
                    </button>
                  </li>
                </ul>,
                document.body,
              )}
          </div>
        </div>
      </div>

    </>
  );
}
