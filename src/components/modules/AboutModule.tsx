import { useNavigate } from "react-router-dom";
import { useUiStore, type DashboardModule } from "@/hooks/useUiStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import { getDashboardModulePath } from "@/routes/dashboardModuleRoutes";

const FEATURES = [
  { icon: "bi-tree-fill", titleKey: "about.feature.vegetation.title", descKey: "about.feature.vegetation.description" },
  { icon: "bi-map-fill", titleKey: "about.feature.landCover.title", descKey: "about.feature.landCover.description" },
  { icon: "bi-graph-up-arrow", titleKey: "about.feature.carbon.title", descKey: "about.feature.carbon.description" },
];

/** Public overview. Internal research details live in the authenticated admin panel. */
export default function AboutModule() {
  const t = useI18nStore((state) => state.t);
  const setActiveModule = useUiStore((s) => s.setActiveModule);
  const navigate = useNavigate();
  const openModule = (module: DashboardModule) => {
    setActiveModule(module);
    navigate(getDashboardModulePath(module));
  };

  return (
    <div className="about-page container-fluid mt-2">
      <div className="about-hero">
        <div className="about-hero-icon">
          <img src="/images/savegeo-logo.svg" alt={t("home.brand")} className="app-brand-logo" />
        </div>
        <div className="about-hero-body">
          <span className="about-hero-eyebrow">{t("about.eyebrow")}</span>
          <h1 className="about-hero-title">SaveGeo</h1>
          <p className="about-hero-desc">
            {t("about.description")}
          </p>
        </div>
      </div>

      <div className="about-stats mb-3">
        <div className="about-stat">
          <i className="bi bi-tree-fill" />
          <div><strong>{t("about.stat.vegetation.title")}</strong><span>{t("about.stat.vegetation.description")}</span></div>
        </div>
        <div className="about-stat">
          <i className="bi bi-map-fill" />
          <div><strong>{t("about.stat.mapping.title")}</strong><span>{t("about.stat.mapping.description")}</span></div>
        </div>
        <div className="about-stat">
          <i className="bi bi-graph-up-arrow" />
          <div><strong>{t("about.stat.carbon.title")}</strong><span>{t("about.stat.carbon.description")}</span></div>
        </div>
      </div>

      <div className="about-panel">
        <h2 className="about-section-title">{t("about.featuresTitle")}</h2>
        <div className="about-feature-grid">
          {FEATURES.map((feature) => (
            <div className="about-feature-card" key={feature.titleKey}>
              <i className={`bi ${feature.icon}`} />
              <h3>{t(feature.titleKey)}</h3>
              <p>{t(feature.descKey)}</p>
            </div>
          ))}
        </div>

        <div className="about-cta">
          <span><i className="bi bi-lightning-charge-fill" /> {t("about.quickAccess")}</span>
          <div className="about-cta-buttons">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openModule("carbon")}>
              <i className="bi bi-play-fill" /> {t("home.startAnalysis")}
            </button>
            <button type="button" className="btn btn-outline-success btn-sm" onClick={() => openModule("guide")}>
              <i className="bi bi-book-fill" /> {t("about.readGuide")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
