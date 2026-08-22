import { useState } from "react";
import { useUiStore } from "@/hooks/useUiStore";

type Tab = "ringkasan" | "tim" | "output";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "ringkasan", label: "Ringkasan", icon: "bi-stars" },
  { key: "tim", label: "Tim & Mitra", icon: "bi-people-fill" },
  { key: "output", label: "Output & Metodologi", icon: "bi-diagram-3-fill" },
];

const RESEARCHERS = [
  { name: "Dr. Eng. Adi Wibowo, S.Si., M.Kom.", role: "Ketua Peneliti", lead: true },
  { name: "Satriawan Rasyid Purnama, S.Kom., M.Cs.", role: "Anggota Peneliti", lead: false },
  { name: "Prof. Dr. Sc. Anindya Wirasatriya, S.T., M.Si., M.Sc.", role: "Anggota Peneliti", lead: false },
  { name: "Dr. Budi Warsito, S.Si., M.Si.", role: "Anggota Peneliti", lead: false },
  { name: "Dr. Muhammad Helmi, S.Si., M.Si.", role: "Anggota Peneliti", lead: false },
];

const PARTNERS = [
  { name: "Prof. Joga Dharma Setiawan, B.Sc., M.Sc., PhD.", role: "Direktur Utama" },
  { name: "Ilham Nugraha, S.T., M.M., IPM.", role: "Senior General Manager IS" },
  { name: "Heru Permana, S.St.", role: "VP of Intelligent Product Innovation & VP of Critical System Innovation" },
];

const METHOD_STEPS = [
  {
    title: "Akuisisi Data",
    icon: "bi-cloud-download-fill",
    items: [
      "Citra Sentinel-2 (12 band spektral)",
      "Dataset Dynamic World (Google)",
      "ESA WorldCover dan ESRI Land Cover",
      "API SP3STAB untuk AOI (Area of Interest)",
    ],
  },
  {
    title: "Segmentasi & Preprocessing",
    icon: "bi-grid-3x3-gap-fill",
    items: ["Semi-Supervised UNet dengan GPU Server H100", "Cloud masking dan filtering", "Composite median untuk time series"],
  },
  {
    title: "Estimasi Biomassa",
    icon: "bi-graph-up",
    items: [
      "Robust Linear Regression dari Google Earth Engine",
      "Kalibrasi menggunakan referensi karbon global (WCMC, ESA CCI)",
      "Cross-validation untuk validasi model",
    ],
  },
  {
    title: "Konversi & Output",
    icon: "bi-box-seam-fill",
    items: [
      "Konversi AGB (Above Ground Biomass) ke stok karbon",
      "CO₂ ekuivalen = karbon × 3.67 (IPCC conversion factor)",
      "Visualisasi: Peta densitas karbon (Mg C/ha)",
      "Statistik regional dan insight stok karbon",
    ],
  },
];

const FEATURES = [
  { icon: "bi-tree-fill", title: "Analisis Vegetasi", desc: "8 indeks vegetasi (NDVI, NDWI, MNDWI, NDBI, EVI, SAVI, BSI, NDMI)" },
  { icon: "bi-map-fill", title: "Land Cover", desc: "Dynamic World, ESA WorldCover, ESRI Land Cover" },
  { icon: "bi-graph-up-arrow", title: "Estimasi Karbon", desc: "Machine learning dengan validasi silang untuk akurasi tinggi" },
];

/**
 * Merged "Tentang Program" + "Detail Program Penelitian" into one page (they
 * were two near-identical stacks of oversized bootstrap `card-header bg-*
 * text-white` blocks, each a different contextual color - technically fine
 * but visually monotonous, and text sized like section dividers for what's
 * just body copy). Redesigned as one compact hero + 3 tabs instead: content
 * unchanged (nothing from either legacy page dropped), just organized and
 * restyled - see `.about-*` in app.css.
 */
export default function AboutModule() {
  const setActiveModule = useUiStore((s) => s.setActiveModule);
  const [tab, setTab] = useState<Tab>("ringkasan");

  return (
    <div className="about-page container-fluid mt-4">
      <div className="about-hero">
        <div className="about-hero-icon">
          <i className="bi bi-globe-asia-australia" />
        </div>
        <div className="about-hero-body">
          <span className="about-hero-eyebrow">Riset Hilirisasi Program Ajakan Industri</span>
          <h1 className="about-hero-title">SaveGeo — AI Imagery Analytics Platform</h1>
          <p className="about-hero-desc">
            Platform berbasis kecerdasan buatan untuk analisis citra penginderaan jauh, estimasi stok karbon, dan
            monitoring vegetasi menggunakan Google Earth Engine.
          </p>
        </div>
      </div>

      <div className="about-stats">
        <div className="about-stat">
          <i className="bi bi-building" />
          <div>
            <strong>Undip × PT LEN Industri</strong>
            <span>Kolaborasi riset & industri</span>
          </div>
        </div>
        <div className="about-stat">
          <i className="bi bi-patch-check-fill" />
          <div>
            <strong>S00202515583</strong>
            <span>Paten Sederhana</span>
          </div>
        </div>
        <div className="about-stat">
          <i className="bi bi-globe2" />
          <div>
            <strong>savegeo.len.co.id</strong>
            <span>
              Status: <span className="about-stat-badge">Aktif</span>
            </span>
          </div>
        </div>
      </div>

      <div className="about-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`about-tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            <i className={`bi ${t.icon}`} /> {t.label}
          </button>
        ))}
      </div>

      <div className="about-panel">
        {tab === "ringkasan" && (
          <>
            <h2 className="about-section-title">Fitur Utama</h2>
            <div className="about-feature-grid">
              {FEATURES.map((f) => (
                <div className="about-feature-card" key={f.title}>
                  <i className={`bi ${f.icon}`} />
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>

            <h2 className="about-section-title">Teknologi</h2>
            <div className="about-tech-grid">
              <div className="about-tech-col">
                <h4>
                  <i className="bi bi-cloud-fill" /> Backend & Processing
                </h4>
                <ul>
                  <li>Google Earth Engine</li>
                  <li>Python Flask API</li>
                  <li>Semi-Supervised UNet (GPU H100)</li>
                  <li>Scikit-learn (ML Models)</li>
                </ul>
              </div>
              <div className="about-tech-col">
                <h4>
                  <i className="bi bi-display-fill" /> Frontend & Visualization
                </h4>
                <ul>
                  <li>Bootstrap 5 + Leaflet.js</li>
                  <li>Chart.js for Analytics</li>
                  <li>Responsive Web Design</li>
                  <li>Interactive Mapping</li>
                </ul>
              </div>
            </div>

            <div className="about-cta">
              <span>
                <i className="bi bi-lightning-charge-fill" /> Akses cepat
              </span>
              <div className="about-cta-buttons">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setActiveModule("carbon")}>
                  <i className="bi bi-play-fill" /> Mulai Analisis
                </button>
                <button type="button" className="btn btn-outline-success btn-sm" onClick={() => setActiveModule("guide")}>
                  <i className="bi bi-book-fill" /> Baca Panduan
                </button>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setTab("output")}>
                  <i className="bi bi-diagram-3-fill" /> Lihat Output & Metodologi
                </button>
              </div>
            </div>
          </>
        )}

        {tab === "tim" && (
          <>
            <h2 className="about-section-title">Tim Peneliti</h2>
            <div className="about-table-wrap">
              <table className="about-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Jabatan</th>
                    <th>Afiliasi</th>
                  </tr>
                </thead>
                <tbody>
                  {RESEARCHERS.map((r) => (
                    <tr key={r.name}>
                      <td className={r.lead ? "about-table-lead" : undefined}>{r.name}</td>
                      <td>
                        <span className={`about-badge ${r.lead ? "about-badge-primary" : ""}`}>{r.role}</span>
                      </td>
                      <td>Universitas Diponegoro</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="about-section-title">Tim Mitra Industri</h2>
            <div className="about-table-wrap">
              <table className="about-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Jabatan</th>
                    <th>Afiliasi</th>
                  </tr>
                </thead>
                <tbody>
                  {PARTNERS.map((p) => (
                    <tr key={p.name}>
                      <td className="about-table-lead">{p.name}</td>
                      <td>
                        <span className="about-badge">{p.role}</span>
                      </td>
                      <td>PT LEN Industri (Persero)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "output" && (
          <>
            <h2 className="about-section-title">Output Penelitian</h2>
            <div className="about-output-grid">
              <div className="about-output-card">
                <i className="bi bi-patch-check-fill" />
                <h3>Paten Sederhana</h3>
                <p>
                  <strong>Nomor Permohonan:</strong> S00202515583
                </p>
                <p>
                  <strong>Jenis:</strong> Sistem Estimasi Stok Karbon Berbasis AI
                </p>
              </div>
              <div className="about-output-card">
                <i className="bi bi-globe2" />
                <h3>Platform Web</h3>
                <p>
                  <strong>URL:</strong>{" "}
                  <a href="https://savegeo.len.co.id" target="_blank" rel="noreferrer">
                    savegeo.len.co.id
                  </a>
                </p>
                <p>
                  <strong>Status:</strong> <span className="about-stat-badge">Aktif</span>
                </p>
              </div>
            </div>

            <div className="about-note">
              <i className="bi bi-info-circle-fill" />
              <p>
                Riset ini menghasilkan invensi <strong>sistem estimasi stok karbon berbasis kecerdasan buatan</strong>{" "}
                menggunakan citra penginderaan jauh. Inovasi platform web ini melahirkan{" "}
                <strong>pemetaan biomassa presisi</strong> dan <strong>pelaporan transparan</strong>.
              </p>
            </div>

            <h2 className="about-section-title">Metodologi Penelitian</h2>
            <div className="about-method-grid">
              {METHOD_STEPS.map((step, i) => (
                <div className="about-method-card" key={step.title}>
                  <div className="about-method-num">{i + 1}</div>
                  <i className={`bi ${step.icon}`} />
                  <h4>{step.title}</h4>
                  <ul>
                    {step.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
