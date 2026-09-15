import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useI18nStore } from "@/hooks/useI18nStore";

const FEATURES = [
  {
    eyebrowKey: "home.feature.carbon.eyebrow",
    titleKey: "home.feature.carbon.title",
    descriptionKey: "home.feature.carbon.description",
    image: "/images/carbon-forest-loss.jpg",
    icon: "bi-tree-fill",
    path: "/carbon-estimation",
  },
  {
    eyebrowKey: "home.feature.disaster.eyebrow",
    titleKey: "home.feature.disaster.title",
    descriptionKey: "home.feature.disaster.description",
    image: "/images/disaster-water-risk.jpg",
    icon: "bi-water",
    path: "/pemetaan-bencana",
  },
  {
    eyebrowKey: "home.feature.crop.eyebrow",
    titleKey: "home.feature.crop.title",
    descriptionKey: "home.feature.crop.description",
    image: "/images/crop-monitoring-fields.jpg",
    icon: "bi-flower1",
    path: "/crop-monitoring",
  },
  {
    eyebrowKey: "home.feature.landChange.eyebrow",
    titleKey: "home.feature.landChange.title",
    descriptionKey: "home.feature.landChange.description",
    image: "/images/guide-hero-satellite.jpg",
    icon: "bi-arrow-left-right",
    path: "/land-cover-change",
  },
  {
    eyebrowKey: "home.feature.imagery.eyebrow",
    titleKey: "home.feature.imagery.title",
    descriptionKey: "home.feature.imagery.description",
    image: "/images/imagery-landsat-australia.jpg",
    icon: "bi-camera",
    path: "/satellite-imagery",
  },
  {
    eyebrowKey: "home.feature.workflow.eyebrow",
    titleKey: "home.feature.workflow.title",
    descriptionKey: "home.feature.workflow.description",
    image: "/images/land-change-disturbance.jpg",
    icon: "bi-bar-chart-line",
    path: "/workflow",
  },
];

const USE_CASES = [
  ["bi-tree", "home.useCase.forest.title", "home.useCase.forest.description", "/carbon-estimation"],
  ["bi-moisture", "home.useCase.crop.title", "home.useCase.crop.description", "/crop-monitoring"],
  ["bi-shield-exclamation", "home.useCase.disaster.title", "home.useCase.disaster.description", "/pemetaan-bencana"],
  ["bi-buildings", "home.useCase.research.title", "home.useCase.research.description", "/workflow"],
];

export default function LandingPage() {
  const { language, setLanguage, t } = useI18nStore();
  const [scrolled, setScrolled] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);
  const ctaRef = useRef<HTMLElement | null>(null);
  const heroImageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let frame = 0;
    const handleParallax = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (heroImageRef.current) {
          const offset = Math.min(window.scrollY * 0.34, 220);
          heroImageRef.current.style.setProperty("--hero-parallax", `${offset}px`);
        }
      });
    };
    window.addEventListener("scroll", handleParallax, { passive: true });
    handleParallax();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", handleParallax);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const element = ctaRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setCtaVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setCtaVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.22 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className="landing-page">
      <header className={`landing-nav ${scrolled ? "is-scrolled" : ""}`}>
        <div className="landing-shell landing-nav-inner">
          <Link to="/" className="landing-brand" aria-label={t("home.homeLink")}>
            <img src="/images/savegeo-logo.svg" alt={t("home.brand")} />
            <span>
              <strong>SaveGeo</strong>
              <small>{t("home.brandTagline")}</small>
            </span>
          </Link>
          <nav className="landing-links" aria-label={t("home.mainNavigation")}>
            <a href="#fitur">{t("home.nav.features")}</a>
            <a href="#cara-kerja">{t("home.nav.process")}</a>
            <a href="#solusi">{t("home.nav.solutions")}</a>
            <a href="#tentang">{t("home.nav.about")}</a>
          </nav>
          <div className="landing-nav-actions">
            <label className="landing-language" aria-label={t("home.language")}>
              <i className="bi bi-translate" aria-hidden="true" />
              <select value={language} onChange={(event) => setLanguage(event.target.value as "id" | "en")}>
                <option value="id">ID</option>
                <option value="en">EN</option>
              </select>
            </label>
            <Link to="/carbon-estimation" className="landing-nav-cta">{t("home.openPlatform")} <i className="bi bi-arrow-up-right" /></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div ref={heroImageRef} className="landing-hero-image" aria-hidden="true" />
          <div className="landing-shell landing-hero-content">
            <div className="landing-hero-copy">
              <div className="landing-kicker"><span /> {t("home.hero.kicker")}</div>
              <h1>{t("home.hero.titleLine1")}<br /><em>{t("home.hero.titleLine2")}</em></h1>
              <p>{t("home.hero.description")}</p>
              <div className="landing-hero-actions">
                <Link to="/carbon-estimation" className="landing-primary-button">{t("home.startAnalysis")} <i className="bi bi-arrow-up-right" /></Link>
                <a href="#fitur" className="landing-secondary-button"><i className="bi bi-play-circle" /> {t("home.exploreFeatures")}</a>
              </div>
            </div>
            <div className="landing-hero-panel-float">
              <div className="landing-hero-panel" aria-label={t("home.panel.aria")}>
                <div className="landing-panel-top"><span className="status-dot" /> {t("home.panel.active")} <span>2026</span></div>
                <div className="landing-panel-map"><div className="map-crosshair" /><div className="map-aoi map-aoi-one" /><div className="map-aoi map-aoi-two" /><div className="map-scanline" /></div>
                <div className="landing-panel-footer"><div><small>{t("home.panel.layers")}</small><strong>{t("home.panel.multiSource")}</strong></div><i className="bi bi-layers" /></div>
              </div>
            </div>
          </div>
          <a className="landing-scroll-button" href="#fitur" aria-label={t("home.exploreFeatures")}>
            <span className="landing-scroll-button-icon"><i className="bi bi-arrow-down" /></span>
          </a>
        </section>

        <section className="landing-trust" aria-label={t("home.partners.aria")}>
          <div className="landing-shell landing-trust-inner"><span>{t("home.partners.kicker")}</span><div className="landing-trust-logos"><strong>SaveGeo</strong><b>Universitas Diponegoro</b><b>PT LEN Industri (Persero)</b></div></div>
        </section>

        <section id="fitur" className="landing-section landing-features-section">
          <div className="landing-shell">
            <div className="landing-section-heading"><div><div className="landing-kicker green"><span /> {t("home.features.kicker")}</div><h2>{t("home.features.titleLine1")}<br /><em>{t("home.features.titleLine2")}</em></h2></div><p>{t("home.features.description")}</p></div>
            <div className="landing-feature-grid">{FEATURES.map((feature) => <Link to={feature.path} className="landing-feature-card" key={feature.titleKey}><div className="landing-feature-image" style={{ backgroundImage: `url(${feature.image})` }}><span className="landing-feature-icon"><i className={`bi ${feature.icon}`} /></span><span className="landing-feature-arrow"><i className="bi bi-arrow-up-right" /></span></div><div className="landing-feature-body"><small>{t(feature.eyebrowKey)}</small><h3>{t(feature.titleKey)}</h3><p>{t(feature.descriptionKey)}</p><span className="landing-text-link">{t("home.learnMore")} <i className="bi bi-arrow-right" /></span></div></Link>)}</div>
          </div>
        </section>

        <section id="cara-kerja" className="landing-process-section">
          <div className="landing-shell"><div className="landing-section-heading light"><div><div className="landing-kicker"><span /> {t("home.process.kicker")}</div><h2>{t("home.process.titleLine1")}<br /><em>{t("home.process.titleLine2")}</em></h2></div><p>{t("home.process.description")}</p></div><div className="landing-process-grid"><div className="landing-process-line" />{[["01", "home.process.step1.title", "home.process.step1.description"], ["02", "home.process.step2.title", "home.process.step2.description"], ["03", "home.process.step3.title", "home.process.step3.description"]].map(([number, titleKey, descriptionKey]) => <div className="landing-process-step" key={number}><span className="landing-process-number">{number}</span><h3>{t(titleKey)}</h3><p>{t(descriptionKey)}</p></div>)}</div></div>
        </section>

        <section id="solusi" className="landing-section landing-usecase-section"><div className="landing-shell"><div className="landing-section-heading"><div><div className="landing-kicker green"><span /> {t("home.solutions.kicker")}</div><h2>{t("home.solutions.titleLine1")}<br /><em>{t("home.solutions.titleLine2")}</em></h2></div><p>{t("home.solutions.description")}</p></div><div className="landing-usecase-grid">{USE_CASES.map(([icon, titleKey, descriptionKey, path]) => <Link to={path} className="landing-usecase-card" key={titleKey}><i className={`bi ${icon}`} /><h3>{t(titleKey)}</h3><p>{t(descriptionKey)}</p><span>{t("home.exploreSolution")} <i className="bi bi-arrow-up-right" /></span></Link>)}</div></div></section>

        <section ref={ctaRef} id="tentang" className={`landing-cta-section ${ctaVisible ? "is-visible" : ""}`}><div className="landing-shell landing-cta-inner"><div className="landing-cta-orbit orbit-one" /><div className="landing-cta-orbit orbit-two" /><div className="landing-kicker"><span /> {t("home.cta.kicker")}</div><h2>{t("home.cta.titleLine1")}<br /><em>{t("home.cta.titleLine2")}</em></h2><p>{t("home.cta.description")}</p><Link to="/carbon-estimation" className="landing-primary-button">{t("home.enterPlatform")} <i className="bi bi-arrow-up-right" /></Link></div></section>
      </main>

      <footer className="landing-footer">
        <div className="landing-shell landing-footer-inner">
          <div className="landing-footer-main">
            <div className="landing-footer-about">
              <div className="landing-brand">
                <img src="/images/savegeo-logo.svg" alt={t("home.brand")} />
                <span><strong>SaveGeo</strong><small>{t("home.brandTagline")}</small></span>
              </div>
              <p>{t("home.footer.description")}</p>
            </div>
            <div className="landing-footer-partners" aria-label={t("home.partners.aria")}>
              <small>{t("home.footer.supportedBy")}</small>
              <div className="landing-footer-logo-row">
                <img src="https://upload.wikimedia.org/wikipedia/id/2/20/Logo_Universitas_Diponegoro.png" alt="Universitas Diponegoro" />
                <img src="https://upload.wikimedia.org/wikipedia/id/8/88/Logo_Len_Industri_Baru.png" alt="PT LEN Industri (Persero)" />
                <img src="/images/logo-kemdiktisaintek.png" alt="Kemdiktisaintek" />
                <img src="/images/logo-hiliriset.png" alt="Hiliriset" />
              </div>
            </div>
          </div>
          <div className="landing-footer-divider" />
          <div className="landing-footer-bottom">
            <span>© 2025-{new Date().getFullYear()} SaveGeo</span>
            <span>Universitas Diponegoro × PT LEN Industri (Persero)</span>
            <span>{t("home.footer.tagline")}</span>
          </div>
        </div>
      </footer>
      {scrolled && <button type="button" className="landing-scroll-top" onClick={scrollToTop} aria-label={t("home.backToTop")}><i className="bi bi-arrow-up" /></button>}
    </div>
  );
}
