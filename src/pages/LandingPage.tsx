import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const FEATURES = [
  {
    eyebrow: "Forestry & climate",
    title: "Estimasi Stok Karbon",
    description: "Ukur indikasi stok karbon, vegetasi, dan tutupan lahan dari AOI yang sama.",
    image: "/images/carbon-forest-loss.jpg",
    icon: "bi-tree-fill",
    path: "/carbon-estimation",
  },
  {
    eyebrow: "Risk intelligence",
    title: "Pemetaan Bencana",
    description: "Pahami area terdampak, hotspot, dan informasi pendukung untuk respons yang lebih cepat.",
    image: "/images/disaster-water-risk.jpg",
    icon: "bi-water",
    path: "/pemetaan-bencana",
  },
  {
    eyebrow: "Precision agriculture",
    title: "Crop Monitoring",
    description: "Pantau kesehatan tanaman, moisture, cuaca, fase pertumbuhan, dan anomali lahan.",
    image: "/images/crop-monitoring-fields.jpg",
    icon: "bi-flower1",
    path: "/crop-monitoring",
  },
  {
    eyebrow: "Change intelligence",
    title: "Land Cover Change",
    description: "Bandingkan perubahan tutupan lahan lintas waktu dengan peta dan statistik yang mudah dibaca.",
    image: "/images/guide-hero-satellite.jpg",
    icon: "bi-arrow-left-right",
    path: "/land-cover-change",
  },
  {
    eyebrow: "Earth observation",
    title: "Satellite Imagery",
    description: "Eksplorasi scene, tanggal akuisisi, basemap, dan layer citra untuk kebutuhan analisis.",
    image: "/images/imagery-landsat-australia.jpg",
    icon: "bi-camera",
    path: "/satellite-imagery",
  },
  {
    eyebrow: "Research workflow",
    title: "Insight & Reporting",
    description: "Susun temuan geospasial menjadi visualisasi dan hasil yang siap digunakan untuk riset.",
    image: "/images/land-change-disturbance.jpg",
    icon: "bi-bar-chart-line",
    path: "/guide",
  },
];

const USE_CASES = [
  ["bi-tree", "Kehutanan & karbon", "Inventarisasi, pemantauan perubahan, dan dukungan carbon accounting."],
  ["bi-moisture", "Pemantauan Pertanian", "Temukan variasi kondisi lahan dan tanda awal stres tanaman."],
  ["bi-shield-exclamation", "Pemetaan bencana", "Dukung pemetaan dampak dan prioritas respons berbasis lokasi."],
  ["bi-buildings", "Tata ruang & riset", "Hubungkan data spasial dengan analisis yang transparan dan dapat ditelusuri."],
];

export default function LandingPage() {
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
          <Link to="/" className="landing-brand" aria-label="SaveGeo beranda">
            <img src="/images/savegeo-logo.svg" alt="SaveGeo" />
            <span>
              <strong>SaveGeo</strong>
              <small>AI Imagery Analytics Platform</small>
            </span>
          </Link>
          <nav className="landing-links" aria-label="Navigasi utama">
            <a href="#fitur">Fitur</a>
            <a href="#cara-kerja">Cara Kerja</a>
            <a href="#solusi">Solusi</a>
            <a href="#tentang">Tentang</a>
          </nav>
          <div className="landing-nav-actions">
            <Link to="/login" className="landing-nav-cta">Buka Platform <i className="bi bi-arrow-up-right" /></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div ref={heroImageRef} className="landing-hero-image" aria-hidden="true" />
          <div className="landing-shell landing-hero-content">
            <div className="landing-hero-copy">
              <div className="landing-kicker"><span /> EARTH OBSERVATION, MADE ACTIONABLE</div>
              <h1>Melihat lebih jauh.<br /><em>Memutuskan lebih tepat.</em></h1>
              <p>SaveGeo menggunakan teknologi berbasis AI untuk mengubah citra satelit dan data geospasial menjadi insight yang membantu Anda memahami wilayah, memantau perubahan, dan mengambil keputusan berbasis bukti.</p>
              <div className="landing-hero-actions">
                <Link to="/login" className="landing-primary-button">Mulai Analisis <i className="bi bi-arrow-up-right" /></Link>
                <a href="#fitur" className="landing-secondary-button"><i className="bi bi-play-circle" /> Jelajahi Fitur</a>
              </div>
            </div>
            <div className="landing-hero-panel-float">
              <div className="landing-hero-panel" aria-label="Ringkasan kemampuan SaveGeo">
                <div className="landing-panel-top"><span className="status-dot" /> PLATFORM AKTIF <span>2026</span></div>
                <div className="landing-panel-map"><div className="map-crosshair" /><div className="map-aoi map-aoi-one" /><div className="map-aoi map-aoi-two" /><div className="map-scanline" /></div>
                <div className="landing-panel-footer"><div><small>ANALYTICS LAYERS</small><strong>Multi-source imagery</strong></div><i className="bi bi-layers" /></div>
              </div>
            </div>
          </div>
          <a className="landing-scroll-button" href="#fitur" aria-label="Jelajahi fitur SaveGeo">
            <span className="landing-scroll-button-icon"><i className="bi bi-arrow-down" /></span>
          </a>
        </section>

        <section className="landing-trust" aria-label="Mitra SaveGeo">
          <div className="landing-shell landing-trust-inner"><span>DIKEMBANGKAN UNTUK ANALISIS BUMI YANG LEBIH BAIK</span><div className="landing-trust-logos"><strong>SaveGeo</strong><b>Universitas Diponegoro</b><b>PT LEN Industri</b></div></div>
        </section>

        <section id="fitur" className="landing-section landing-features-section">
          <div className="landing-shell">
            <div className="landing-section-heading"><div><div className="landing-kicker green"><span /> APA YANG BISA ANDA LAKUKAN</div><h2>Pahami wilayah Anda<br /><em>dengan lebih jelas.</em></h2></div><p>Dari hutan hingga lahan pertanian, SaveGeo membantu Anda membaca sinyal perubahan di permukaan bumi dengan cara yang lebih sederhana.</p></div>
            <div className="landing-feature-grid">{FEATURES.map((feature) => <Link to="/login" className="landing-feature-card" key={feature.title}><div className="landing-feature-image" style={{ backgroundImage: `url(${feature.image})` }}><span className="landing-feature-icon"><i className={`bi ${feature.icon}`} /></span><span className="landing-feature-arrow"><i className="bi bi-arrow-up-right" /></span></div><div className="landing-feature-body"><small>{feature.eyebrow}</small><h3>{feature.title}</h3><p>{feature.description}</p><span className="landing-text-link">Pelajari lebih lanjut <i className="bi bi-arrow-right" /></span></div></Link>)}</div>
          </div>
        </section>

        <section id="cara-kerja" className="landing-process-section">
          <div className="landing-shell"><div className="landing-section-heading light"><div><div className="landing-kicker"><span /> WORKFLOW YANG JELAS</div><h2>Dari wilayah pilihan<br /><em>menjadi insight.</em></h2></div><p>Mulai dari AOI yang Anda kenal. Atur analisis yang dibutuhkan. Baca hasilnya dalam satu ruang kerja interaktif.</p></div><div className="landing-process-grid"><div className="landing-process-line" />{[["01", "Pilih AOI", "Tentukan provinsi, area perusahaan, koordinat, gambar di peta, atau unggah file."], ["02", "Jalankan analisis", "Pilih periode, dataset, dan parameter yang relevan dengan pertanyaan Anda."], ["03", "Ambil keputusan", "Gunakan peta, statistik, perbandingan waktu, dan ekspor untuk langkah berikutnya."]].map(([number, title, description]) => <div className="landing-process-step" key={number}><span className="landing-process-number">{number}</span><h3>{title}</h3><p>{description}</p></div>)}</div></div>
        </section>

        <section id="solusi" className="landing-section landing-usecase-section"><div className="landing-shell"><div className="landing-section-heading"><div><div className="landing-kicker green"><span /> DIBUAT UNTUK KONTEKS NYATA</div><h2>Data yang dekat dengan<br /><em>keputusan Anda.</em></h2></div><p>SaveGeo dirancang untuk menjembatani data pengamatan bumi dengan kebutuhan operasional, riset, dan kebijakan.</p></div><div className="landing-usecase-grid">{USE_CASES.map(([icon, title, description]) => <div className="landing-usecase-card" key={title}><i className={`bi ${icon}`} /><h3>{title}</h3><p>{description}</p><span>Explore solution <i className="bi bi-arrow-up-right" /></span></div>)}</div></div></section>

        <section ref={ctaRef} id="tentang" className={`landing-cta-section ${ctaVisible ? "is-visible" : ""}`}><div className="landing-shell landing-cta-inner"><div className="landing-cta-orbit orbit-one" /><div className="landing-cta-orbit orbit-two" /><div className="landing-kicker"><span /> SAVEGEO PLATFORM</div><h2>Mulai memantau wilayah<br /><em>dengan perspektif baru.</em></h2><p>Masuk ke ruang kerja analitik SaveGeo dan ubah data permukaan bumi menjadi langkah yang lebih terarah.</p><Link to="/login" className="landing-primary-button">Masuk ke SaveGeo <i className="bi bi-arrow-up-right" /></Link></div></section>
      </main>

      <footer className="landing-footer">
        <div className="landing-shell landing-footer-inner">
          <div className="landing-footer-main">
            <div className="landing-footer-about">
              <div className="landing-brand">
                <img src="/images/savegeo-logo.svg" alt="SaveGeo" />
                <span><strong>SaveGeo</strong><small>AI Imagery Analytics Platform</small></span>
              </div>
              <p>Geospatial intelligence untuk vegetasi, tutupan lahan, stok karbon, dan pemetaan bencana.</p>
            </div>
            <div className="landing-footer-partners" aria-label="Mitra SaveGeo">
              <small>DIDUKUNG OLEH</small>
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
            <span>Built for a better view of Earth.</span>
          </div>
        </div>
      </footer>
      {scrolled && <button type="button" className="landing-scroll-top" onClick={scrollToTop} aria-label="Kembali ke atas"><i className="bi bi-arrow-up" /></button>}
    </div>
  );
}
