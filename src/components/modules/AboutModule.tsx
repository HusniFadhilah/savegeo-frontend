import { useNavigate } from "react-router-dom";
import { useUiStore, type DashboardModule } from "@/hooks/useUiStore";
import { getDashboardModulePath } from "@/routes/dashboardModuleRoutes";

const FEATURES = [
  { icon: "bi-tree-fill", title: "Analisis Vegetasi", desc: "Pantau kondisi vegetasi dari data penginderaan jauh." },
  { icon: "bi-map-fill", title: "Tutupan Lahan", desc: "Bandingkan perubahan tutupan lahan pada area kajian." },
  { icon: "bi-graph-up-arrow", title: "Estimasi Karbon", desc: "Dapatkan ringkasan estimasi karbon untuk mendukung analisis." },
];

/** Public overview. Internal research details live in the authenticated admin panel. */
export default function AboutModule() {
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
          <img src="/images/savegeo-logo.svg" alt="SaveGeo" className="app-brand-logo" />
        </div>
        <div className="about-hero-body">
          <span className="about-hero-eyebrow">Platform analisis geospasial</span>
          <h1 className="about-hero-title">SaveGeo</h1>
          <p className="about-hero-desc">
            Platform untuk mengeksplorasi citra penginderaan jauh, kondisi vegetasi, tutupan lahan, dan estimasi karbon.
          </p>
        </div>
      </div>

      <div className="about-stats">
        <div className="about-stat">
          <i className="bi bi-tree-fill" />
          <div><strong>Analisis vegetasi</strong><span>Eksplorasi kondisi area kajian</span></div>
        </div>
        <div className="about-stat">
          <i className="bi bi-map-fill" />
          <div><strong>Pemetaan geospasial</strong><span>Visualisasi berbasis peta</span></div>
        </div>
        <div className="about-stat">
          <i className="bi bi-graph-up-arrow" />
          <div><strong>Insight karbon</strong><span>Ringkasan untuk pengambilan keputusan</span></div>
        </div>
      </div>

      <div className="about-panel">
        <h2 className="about-section-title">Fitur Utama</h2>
        <div className="about-feature-grid">
          {FEATURES.map((feature) => (
            <div className="about-feature-card" key={feature.title}>
              <i className={`bi ${feature.icon}`} />
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="about-cta">
          <span><i className="bi bi-lightning-charge-fill" /> Akses cepat</span>
          <div className="about-cta-buttons">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openModule("carbon")}>
              <i className="bi bi-play-fill" /> Mulai Analisis
            </button>
            <button type="button" className="btn btn-outline-success btn-sm" onClick={() => openModule("guide")}>
              <i className="bi bi-book-fill" /> Baca Panduan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
