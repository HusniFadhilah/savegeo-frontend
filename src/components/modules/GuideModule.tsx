import { useState, type ReactNode } from "react";
import { useUiStore } from "@/hooks/useUiStore";

type StepId = "step1" | "step2" | "step3" | "step4" | "stepTips";
type NoteTone = "info" | "warn" | "success" | "danger";
type ParamKey = "veg" | "lc" | "carbon";

/** Restyled accordion section - numbered badge + chevron instead of
 * Bootstrap's default big blue-focus accordion button. */
function GuideStep({
  id,
  num,
  icon,
  title,
  openId,
  onToggle,
  children,
}: {
  id: StepId;
  num: string;
  icon: string;
  title: string;
  openId: StepId;
  onToggle: (id: StepId) => void;
  children: ReactNode;
}) {
  const isOpen = openId === id;
  return (
    <div className="guide-acc-item">
      <button type="button" className={`guide-acc-trigger ${isOpen ? "active" : ""}`} onClick={() => onToggle(id)} aria-expanded={isOpen}>
        <span className="guide-acc-num">{num}</span>
        <i className={`bi ${icon}`} />
        <span className="guide-acc-title">{title}</span>
        <i className="bi bi-chevron-down guide-acc-chevron" />
      </button>
      {isOpen && <div className="guide-acc-body">{children}</div>}
    </div>
  );
}

/** Small colored-accent callout, replaces Bootstrap's full-fill alert-*. */
function Note({ tone, title, children }: { tone: NoteTone; title?: string; children: ReactNode }) {
  const icon = { info: "bi-info-circle-fill", warn: "bi-exclamation-triangle-fill", success: "bi-lightbulb-fill", danger: "bi-x-circle-fill" }[tone];
  return (
    <div className={`guide-note guide-note-${tone}`}>
      <i className={`bi ${icon}`} />
      <div>
        {title && <strong>{title} </strong>}
        {children}
      </div>
    </div>
  );
}

const PARAM_TABS: { key: ParamKey; label: string; icon: string }[] = [
  { key: "veg", label: "Vegetation Indices", icon: "bi-tree-fill" },
  { key: "lc", label: "Land Cover", icon: "bi-map-fill" },
  { key: "carbon", label: "Carbon Stock", icon: "bi-graph-up-arrow" },
];

const DATASET_DOCS = [
  {
    group: "Citra Satelit",
    name: "Sentinel-2 MSI",
    resolution: "10-20m",
    period: "2015-sekarang",
    usedFor: "Indeks vegetasi, komposit optik, prediktor model karbon, crop health.",
    notes: "Menggunakan cloud masking dan composite median agar citra tropis lebih stabil.",
  },
  {
    group: "Citra Satelit",
    name: "Sentinel-1 SAR",
    resolution: "10m",
    period: "2014-sekarang",
    usedFor: "Informasi radar untuk kelembaban permukaan, banjir, dan zona produktivitas.",
    notes: "Lebih tahan awan dibanding citra optik; dipakai sebagai sumber pendukung.",
  },
  {
    group: "Land Cover",
    name: "Dynamic World",
    resolution: "10m",
    period: "Near real-time",
    usedFor: "Klasifikasi tutupan lahan dinamis dan analisis perubahan cepat.",
    notes: "Cocok untuk pemantauan aktual; mode kelas mayoritas lebih stabil untuk ringkasan.",
  },
  {
    group: "Land Cover",
    name: "ESA WorldCover",
    resolution: "10m",
    period: "2020-2021",
    usedFor: "Baseline tutupan lahan global resolusi tinggi.",
    notes: "Baik untuk pembanding kelas permukiman, vegetasi, lahan terbuka, dan air.",
  },
  {
    group: "Land Cover",
    name: "ESRI Land Cover / Living Atlas",
    resolution: "10m",
    period: "Tahunan / time-series",
    usedFor: "LULC tahunan, validasi silang, dan visualisasi perubahan.",
    notes: "Tersedia via GEE Community Catalog atau ArcGIS Living Atlas sesuai konfigurasi.",
  },
  {
    group: "Land Cover",
    name: "MODIS, Copernicus, GLC_FCS30D, JAXA, MapBiomas, JRC TMF",
    resolution: "25-500m",
    period: "Bervariasi",
    usedFor: "Pembanding multi-skala, forest/non-forest, mangrove, moist forest, dan LULC historis.",
    notes: "Dipakai sesuai ketersediaan tahun, cakupan wilayah, dan tujuan analisis.",
  },
  {
    group: "Carbon Reference",
    name: "WCMC Carbon Density",
    resolution: "300m",
    period: "2010",
    usedFor: "Baseline densitas karbon global untuk estimasi stok karbon.",
    notes: "Dataset fallback utama pada katalog karbon.",
  },
  {
    group: "Carbon Reference",
    name: "GEDI L4B Biomass",
    resolution: "1km",
    period: "2019-2023",
    usedFor: "Referensi biomassa dari lidar ruang angkasa, terutama area berhutan.",
    notes: "Bagus untuk validasi area forest; resolusi lebih kasar daripada Sentinel-2.",
  },
  {
    group: "Carbon Reference",
    name: "ESA CCI AGB",
    resolution: "100m",
    period: "2010-2020",
    usedFor: "Above-ground biomass annual map untuk kalibrasi karbon.",
    notes: "Direkomendasikan saat butuh baseline AGB tahunan yang lebih detail.",
  },
  {
    group: "Soil Carbon",
    name: "OpenLandMap SOC & SoilGrids SOC",
    resolution: "250m",
    period: "2017 / multi-source",
    usedFor: "Estimasi soil organic carbon dan statistik karbon tanah.",
    notes: "SoilGrids dipakai untuk statistik titik; OpenLandMap tersedia untuk model GEE-deployable.",
  },
  {
    group: "Crop Monitoring",
    name: "CHIRPS, ERA5-Land, Open-Meteo Archive",
    resolution: "Harian / agregat",
    period: "Historis",
    usedFor: "Curah hujan, hari kering, indikator cuaca, dan risiko kekeringan.",
    notes: "GEE path memakai CHIRPS/ERA5-Land; Open-Meteo tersedia sebagai opsi tanpa API key.",
  },
];

const MODEL_DOCS = [
  {
    name: "Linear / Ridge / Lasso Carbon Model",
    input: "Sentinel-2 bands, indeks spektral, terrain/landcover features bila tersedia.",
    output: "Densitas karbon, stok total, dan CO2 equivalent.",
    deploy: "GEE Direct",
    notes: "Model paling stabil untuk tile-map karena persamaan dapat dieksekusi langsung di Earth Engine.",
  },
  {
    name: "Random Forest / Gradient Boosting / XGBoost / LightGBM",
    input: "Feature stack raster atau sampel tabular hasil preprocessing.",
    output: "Estimasi karbon atau klasifikasi berbasis model non-linear.",
    deploy: "Server-side / statistik",
    notes: "Lebih fleksibel tetapi tidak selalu bisa dirender sebagai tile GEE langsung.",
  },
  {
    name: "Semi-Supervised UNet",
    input: "Citra Sentinel-2 multi-band dan label parsial.",
    output: "Segmentasi/ekstraksi objek geospasial untuk pipeline riset.",
    deploy: "Training / batch processing",
    notes: "Berjalan pada GPU server untuk kebutuhan riset; bukan semua workflow realtime memakai model ini.",
  },
  {
    name: "Crop Risk Composite Score",
    input: "Kesehatan vegetasi, moisture, cuaca, banjir, dan anomali fase pertumbuhan.",
    output: "Skor risiko 0-100 dan label level risiko.",
    deploy: "Backend scoring",
    notes: "Bobot faktor dikonfigurasi di backend agar dapat disesuaikan tanpa mengubah frontend.",
  },
];

/** Faithful port of module-guide.html; Bootstrap's JS accordion (data-bs-toggle)
 * is replaced with local React state since only Bootstrap CSS is bundled.
 * Redesigned from a long stack of oversized, alternating-color bootstrap
 * cards into a compact hero + numbered accordion, in the same restrained
 * visual language as AboutModule (see `.guide-*` in app.css) - all original
 * content kept, just reorganized (step 3's three parameter tables are now a
 * tab switcher instead of three full tables stacked back to back).
 */
export default function GuideModule() {
  const setActiveModule = useUiStore((s) => s.setActiveModule);
  const [openId, setOpenId] = useState<StepId>("step1");
  const toggle = (id: StepId) => setOpenId((cur) => (cur === id ? ("" as StepId) : id));
  const [paramTab, setParamTab] = useState<ParamKey>("veg");

  return (
    <div className="guide-page container-fluid mt-4">
      <div className="guide-hero">
        <div className="guide-hero-icon">
          <i className="bi bi-book-fill" />
        </div>
        <div className="guide-hero-body">
          <span className="guide-hero-eyebrow">Panduan Pengguna</span>
          <h1 className="guide-hero-title">Panduan Lengkap Penggunaan Platform</h1>
          <p className="guide-hero-desc">
            Alur ringkas untuk menyiapkan AOI, memilih analisis, mengatur parameter, menjalankan proses, dan membaca
            hasil tanpa bolak-balik menebak tombol.
          </p>
          <div className="guide-flow">
            <span className="guide-flow-step">
              <i className="bi bi-geo-alt-fill" /> Pilih AOI
            </span>
            <i className="bi bi-arrow-right guide-flow-arrow" />
            <span className="guide-flow-step">
              <i className="bi bi-sliders" /> Atur Parameter
            </span>
            <i className="bi bi-arrow-right guide-flow-arrow" />
            <span className="guide-flow-step">
              <i className="bi bi-play-fill" /> Jalankan Analisis
            </span>
          </div>
        </div>
        <div className="guide-hero-metrics" aria-label="Ringkasan panduan">
          <div>
            <strong>3</strong>
            <span>cara pilih AOI</span>
          </div>
          <div>
            <strong>4</strong>
            <span>jenis analisis</span>
          </div>
          <div>
            <strong>5</strong>
            <span>bagian praktis</span>
          </div>
        </div>
      </div>

      <div className="guide-accordion">
        <GuideStep id="step1" num="1" icon="bi-geo-alt-fill" title="Memilih Area of Interest (AOI)" openId={openId} onToggle={toggle}>
          <p className="guide-lead">Ada 3 cara untuk memilih area analisis:</p>
          <div className="guide-method-grid">
            <div className="guide-method-card">
              <h3>
                <i className="bi bi-flag-fill" /> Metode A: Indonesia Admin Boundaries
              </h3>
              <ol>
                <li>
                  Klik tab <strong>&quot;Indonesia Admin&quot;</strong>
                </li>
                <li>
                  Pilih <strong>Provinsi</strong> dari dropdown
                </li>
                <li>
                  Pilih <strong>Kota/Kabupaten</strong> (opsional)
                </li>
                <li>
                  Pilih <strong>Kecamatan</strong> (opsional)
                </li>
                <li>
                  Pilih <strong>Kelurahan/Desa</strong> (opsional)
                </li>
                <li>
                  Klik tombol <strong>&quot;Load Region&quot;</strong>
                </li>
              </ol>
              <Note tone="info" title="Tips:">
                Anda bisa memilih hanya sampai level provinsi dengan klik &quot;📍 Use Province Only&quot; atau level
                lainnya sesuai kebutuhan.
              </Note>
            </div>

            <div className="guide-method-card">
              <h3>
                <i className="bi bi-geo-alt-fill" /> Metode B: Koordinat + Buffer
              </h3>
              <ol>
                <li>
                  Klik tab <strong>&quot;Coordinates&quot;</strong>
                </li>
                <li>
                  Masukkan <strong>Latitude</strong> (contoh: -6.9667)
                </li>
                <li>
                  Masukkan <strong>Longitude</strong> (contoh: 110.4167)
                </li>
                <li>
                  Atur <strong>Buffer</strong> dalam kilometer (1-50 km)
                </li>
                <li>
                  Klik tombol <strong>&quot;Set AOI&quot;</strong>
                </li>
              </ol>
              <Note tone="warn" title="Catatan:">
                Buffer yang terlalu besar dapat memperlambat processing.
              </Note>
            </div>

            <div className="guide-method-card">
              <h3>
                <i className="bi bi-pencil-fill" /> Metode C: Gambar Manual
              </h3>
              <ol>
                <li>
                  Klik tab <strong>&quot;Draw on Map&quot;</strong>
                </li>
                <li>Gunakan tool polygon/rectangle di peta</li>
                <li>Gambar area yang diinginkan di peta</li>
                <li>
                  Klik tombol <strong>&quot;Use Drawn AOI&quot;</strong>
                </li>
              </ol>
              <Note tone="success" title="Kelebihan:">
                Metode ini paling fleksibel untuk area yang spesifik.
              </Note>
            </div>
          </div>
        </GuideStep>

        <GuideStep id="step2" num="2" icon="bi-diagram-3-fill" title="Memilih Jenis Analisis" openId={openId} onToggle={toggle}>
          <p className="guide-lead">Platform menyediakan 4 jenis analisis:</p>
          <div className="guide-analysis-grid">
            <div className="guide-analysis-card">
              <i className="bi bi-tree-fill" />
              <h3>1. Vegetation Indices</h3>
              <p>Analisis 8 indeks vegetasi: NDVI, NDWI, MNDWI, NDBI, EVI, SAVI, BSI, NDMI</p>
              <strong>Cocok untuk:</strong>
              <ul>
                <li>Monitoring kesehatan vegetasi</li>
                <li>Deteksi stress tanaman</li>
                <li>Monitoring kandungan air</li>
              </ul>
            </div>
            <div className="guide-analysis-card">
              <i className="bi bi-map-fill" />
              <h3>2. Land Cover</h3>
              <p>Klasifikasi tutupan lahan dari 3 dataset: Dynamic World, ESA WorldCover, ESRI</p>
              <strong>Cocok untuk:</strong>
              <ul>
                <li>Pemetaan penggunaan lahan</li>
                <li>Monitoring perubahan lahan</li>
                <li>Analisis habitat</li>
              </ul>
            </div>
            <div className="guide-analysis-card">
              <i className="bi bi-graph-up-arrow" />
              <h3>3. Carbon Stock Estimation</h3>
              <p>Estimasi stok karbon menggunakan machine learning dan data biomassa</p>
              <strong>Cocok untuk:</strong>
              <ul>
                <li>Inventarisasi karbon</li>
                <li>Pelaporan emisi</li>
                <li>Valuasi jasa ekosistem</li>
              </ul>
            </div>
            <div className="guide-analysis-card">
              <i className="bi bi-layers-fill" />
              <h3>4. Combined Analysis</h3>
              <p>Menggabungkan semua analisis dalam satu proses (lebih lama)</p>
              <strong>Cocok untuk:</strong>
              <ul>
                <li>Laporan komprehensif</li>
                <li>Studi multi-aspek</li>
                <li>Analisis mendalam</li>
              </ul>
            </div>
          </div>
        </GuideStep>

        <GuideStep id="step3" num="3" icon="bi-sliders" title="Mengatur Parameter" openId={openId} onToggle={toggle}>
          <Note tone="warn">
            <strong>Parameter berbeda untuk setiap jenis analisis.</strong> Pilih tab di bawah untuk masing-masing:
          </Note>

          <div className="guide-param-tabs" role="tablist">
            {PARAM_TABS.map((p) => (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={paramTab === p.key}
                className={`guide-param-tab ${paramTab === p.key ? "active" : ""}`}
                onClick={() => setParamTab(p.key)}
              >
                <i className={`bi ${p.icon}`} /> {p.label}
              </button>
            ))}
          </div>

          {paramTab === "veg" && (
            <div className="guide-table-wrap">
              <table className="guide-table">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Deskripsi</th>
                    <th>Rekomendasi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Year</strong>
                    </td>
                    <td>Tahun citra Sentinel-2</td>
                    <td>2022-2025 untuk data terbaru</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Month Range</strong>
                    </td>
                    <td>Rentang bulan untuk analisis</td>
                    <td>3-4 bulan untuk composite stabil</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Cloud Threshold</strong>
                    </td>
                    <td>% awan maksimal</td>
                    <td>20-40% untuk area tropis</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Indices Selection</strong>
                    </td>
                    <td>Pilih indeks yang dibutuhkan</td>
                    <td>NDVI wajib, tambahkan sesuai kebutuhan</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {paramTab === "lc" && (
            <div className="guide-table-wrap">
              <table className="guide-table">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Deskripsi</th>
                    <th>Rekomendasi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Year</strong>
                    </td>
                    <td>Tahun dataset</td>
                    <td>2021-2023 untuk data terkini</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Datasets</strong>
                    </td>
                    <td>Pilih 1 atau lebih dataset</td>
                    <td>Dynamic World untuk near-realtime</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>DW Mode</strong>
                    </td>
                    <td>Mode untuk Dynamic World</td>
                    <td>Mode (paling stabil)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {paramTab === "carbon" && (
            <div className="guide-table-wrap">
              <table className="guide-table">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Deskripsi</th>
                    <th>Rekomendasi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Reference Dataset</strong>
                    </td>
                    <td>Dataset biomassa acuan</td>
                    <td>ESA CCI (paling akurat)</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Pre-trained Model</strong>
                    </td>
                    <td>Model ML yang digunakan</td>
                    <td>Gunakan default atau pilih model GEE-compatible</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Year</strong>
                    </td>
                    <td>Tahun Sentinel-2</td>
                    <td>2022-2024</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Month Range</strong>
                    </td>
                    <td>Rentang bulan</td>
                    <td>Seluruh tahun (Jan-Dec) untuk akurasi terbaik</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Cloud Threshold</strong>
                    </td>
                    <td>% awan maksimal</td>
                    <td>10% (lebih ketat untuk carbon)</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Display Mode</strong>
                    </td>
                    <td>Clipped vs Full Tiles</td>
                    <td>Clipped untuk akurasi, Full untuk kecepatan</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </GuideStep>

        <GuideStep id="step4" num="4" icon="bi-play-circle-fill" title="Menjalankan & Membaca Hasil" openId={openId} onToggle={toggle}>
          <div className="guide-block">
            <h3>
              <i className="bi bi-play-fill" /> Menjalankan Analisis
            </h3>
            <ol>
              <li>Pastikan AOI sudah dipilih (terlihat di peta)</li>
              <li>Pastikan parameter sudah diatur</li>
              <li>
                Klik tombol <strong>&quot;Jalankan Analisis&quot;</strong>
              </li>
              <li>Tunggu proses selesai (1-5 menit tergantung kompleksitas)</li>
              <li>Loading indicator akan menunjukkan progress</li>
            </ol>
            <Note tone="info" title="Waktu Processing:">
              AOI kecil &amp; kondisi cuaca cerah di sisi cepat; AOI besar, banyak awan, atau server sibuk bisa
              mendekati batas atas.
            </Note>
            <ul className="guide-timing-list">
              <li>Vegetation: ~30 detik - 5 menit</li>
              <li>Land Cover (satu tahun): ~1-3 menit</li>
              <li>
                Perbandingan LC-Change (multi-tahun): 1 request per tahun (~1-2 menit/tahun) - <em>bukan</em> sekali
                jalan, jadi 5 tahun bisa ~5-10 menit total
              </li>
              <li>Carbon: ~2-8 menit (bisa sampai ~11 menit untuk AOI besar sebelum timeout)</li>
              <li>Carbon time-series/delta (multi-tahun): sampai ~15 menit (mengulang proses per tahun)</li>
              <li>Combined: ~5-15 menit, tergantung berapa banyak analisis digabung</li>
            </ul>
          </div>

          <div className="guide-block">
            <h3>
              <i className="bi bi-bar-chart-fill" /> Membaca Hasil Analisis
            </h3>
            <div className="guide-results-grid">
              <div>
                <h4>1. Results Map</h4>
                <ul>
                  <li>Tab untuk setiap layer hasil</li>
                  <li>Peta interaktif dengan zoom/pan</li>
                  <li>Legend menunjukkan skala nilai</li>
                </ul>
              </div>
              <div>
                <h4>2. Metrics Cards</h4>
                <ul>
                  <li>Ringkasan nilai utama</li>
                  <li>Jumlah citra, area total, nilai rata-rata</li>
                  <li>Badge berwarna untuk interpretasi cepat</li>
                </ul>
              </div>
              <div>
                <h4>3. Statistics Table</h4>
                <ul>
                  <li>Detail statistik per indeks/kelas</li>
                  <li>Min, Mean, Max, Std Dev</li>
                  <li>Deskripsi untuk setiap metrik</li>
                </ul>
              </div>
              <div>
                <h4>4. Charts & Visualization</h4>
                <ul>
                  <li>Bar chart untuk perbandingan</li>
                  <li>Pie chart untuk distribusi (land cover)</li>
                  <li>Line chart untuk trend (time series)</li>
                </ul>
              </div>
              <div>
                <h4>5. Carbon-Specific Results</h4>
                <ul>
                  <li>
                    <strong>Carbon Density:</strong> Mean, Std Dev, Min, Max (Mg/ha)
                  </li>
                  <li>
                    <strong>Total Stock:</strong> Total carbon (tons), Area (ha)
                  </li>
                  <li>
                    <strong>CO₂ Equivalent:</strong> Konversi ke CO₂
                  </li>
                  <li>
                    <strong>Model Performance:</strong> RMSE, R², Validation metrics
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="guide-block">
            <h3>
              <i className="bi bi-download" /> Export Hasil
            </h3>
            <p className="guide-lead">3 cara export hasil:</p>
            <div className="guide-export-grid">
              <div className="guide-export-card">
                <i className="bi bi-file-image" />
                <h4>Export GeoTIFF</h4>
                <p>Untuk GIS software</p>
              </div>
              <div className="guide-export-card">
                <i className="bi bi-file-code" />
                <h4>Download Stats</h4>
                <p>JSON format</p>
              </div>
              <div className="guide-export-card">
                <i className="bi bi-file-text" />
                <h4>Generate Report</h4>
                <p>Markdown format</p>
              </div>
            </div>
          </div>
        </GuideStep>

        <GuideStep id="stepTips" num="★" icon="bi-lightbulb-fill" title="Tips & Best Practices" openId={openId} onToggle={toggle}>
          <div className="guide-do-dont-grid">
            <div className="guide-do-card">
              <h3>
                <i className="bi bi-check-circle-fill" /> DO&apos;s (Lakukan)
              </h3>
              <ul>
                <li>Mulai dengan area kecil untuk testing</li>
                <li>Gunakan cloud threshold yang sesuai dengan wilayah</li>
                <li>Pilih periode kering untuk hasil terbaik (carbon)</li>
                <li>Save/export hasil untuk dokumentasi</li>
                <li>Bandingkan multiple datasets untuk validasi</li>
                <li>Perhatikan mode display (Clipped vs Full) untuk carbon</li>
              </ul>
            </div>
            <div className="guide-dont-card">
              <h3>
                <i className="bi bi-x-circle-fill" /> DON&apos;Ts (Hindari)
              </h3>
              <ul>
                <li>Area terlalu besar (&gt;1000 km²) untuk carbon</li>
                <li>Cloud threshold terlalu rendah di area tropis</li>
                <li>Month range terlalu pendek (&lt;3 bulan)</li>
                <li>Menjalankan multiple analysis bersamaan</li>
                <li>Menutup browser saat processing</li>
              </ul>
            </div>
          </div>

          <div className="guide-block">
            <h3>
              <i className="bi bi-question-circle-fill" /> Troubleshooting
            </h3>
            <div className="guide-table-wrap">
              <table className="guide-table">
                <thead>
                  <tr>
                    <th>Problem</th>
                    <th>Solution</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>No images found</strong>
                    </td>
                    <td>
                      Tingkatkan cloud threshold
                      <br />
                      Perluas month range
                      <br />
                      Coba tahun berbeda
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Processing timeout</strong>
                    </td>
                    <td>
                      Kurangi area size
                      <br />
                      Gunakan Full Tiles mode
                      <br />
                      Perpendek month range
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Empty results</strong>
                    </td>
                    <td>
                      Pastikan AOI benar
                      <br />
                      Check internet connection
                      <br />
                      Refresh page dan coba lagi
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Low accuracy (carbon)</strong>
                    </td>
                    <td>
                      Gunakan ESA CCI dataset
                      <br />
                      Pilih pre-trained model
                      <br />
                      Gunakan longer time period
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="guide-links">
            <h3>
              <i className="bi bi-book" /> Referensi & Learning
            </h3>
            <ul>
              <li>
                <strong>Google Earth Engine Docs:</strong>{" "}
                <a href="https://developers.google.com/earth-engine" target="_blank" rel="noreferrer">
                  developers.google.com/earth-engine
                </a>
              </li>
              <li>
                <strong>Sentinel-2 Info:</strong>{" "}
                <a href="https://sentinel.esa.int/web/sentinel/missions/sentinel-2" target="_blank" rel="noreferrer">
                  sentinel.esa.int
                </a>
              </li>
              <li>
                <strong>Dynamic World:</strong>{" "}
                <a href="https://dynamicworld.app/" target="_blank" rel="noreferrer">
                  dynamicworld.app
                </a>
              </li>
              <li>
                <strong>Carbon Stock Methodology:</strong> IPCC Guidelines
              </li>
            </ul>
          </div>
        </GuideStep>
      </div>

      <div className="guide-doc-section">
        <div className="guide-doc-heading">
          <span className="guide-hero-eyebrow">Referensi Teknis</span>
          <h2>Dokumentasi Dataset & Model</h2>
          <p>
            Ringkasan sumber data dan model yang dipakai platform. Katalog aktif tetap mengikuti konfigurasi backend,
            tetapi daftar ini membantu membaca asal data, resolusi, dan batasan utama setiap analisis.
          </p>
        </div>

        <div className="guide-doc-card">
          <h3>
            <i className="bi bi-database-fill" /> Dataset
          </h3>
          <div className="guide-table-wrap">
            <table className="guide-table guide-doc-table">
              <thead>
                <tr>
                  <th>Kelompok</th>
                  <th>Dataset</th>
                  <th>Resolusi</th>
                  <th>Periode</th>
                  <th>Dipakai Untuk</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {DATASET_DOCS.map((dataset) => (
                  <tr key={`${dataset.group}-${dataset.name}`}>
                    <td>
                      <span className="guide-doc-badge">{dataset.group}</span>
                    </td>
                    <td>
                      <strong>{dataset.name}</strong>
                    </td>
                    <td>{dataset.resolution}</td>
                    <td>{dataset.period}</td>
                    <td>{dataset.usedFor}</td>
                    <td>{dataset.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="guide-doc-card">
          <h3>
            <i className="bi bi-cpu-fill" /> Model & Inference
          </h3>
          <div className="guide-model-grid">
            {MODEL_DOCS.map((model) => (
              <div className="guide-model-card" key={model.name}>
                <div className="guide-model-top">
                  <i className="bi bi-diagram-2-fill" />
                  <span>{model.deploy}</span>
                </div>
                <h4>{model.name}</h4>
                <p>
                  <strong>Input:</strong> {model.input}
                </p>
                <p>
                  <strong>Output:</strong> {model.output}
                </p>
                <small>{model.notes}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="guide-quickref">
        <h2 className="guide-section-title">
          <i className="bi bi-bookmark-fill" /> Quick Reference
        </h2>
        <div className="guide-quickref-grid">
          <div>
            <h4>
              <i className="bi bi-keyboard" /> Keyboard Shortcuts
            </h4>
            <div className="guide-kbd-row">
              <kbd>Ctrl + Z</kbd> <span>Undo drawing</span>
            </div>
            <div className="guide-kbd-row">
              <kbd>Escape</kbd> <span>Cancel drawing</span>
            </div>
            <div className="guide-kbd-row">
              <kbd>+ / -</kbd> <span>Zoom in/out map</span>
            </div>
          </div>
          <div>
            <h4>
              <i className="bi bi-lightning-fill" /> Quick Actions
            </h4>
            <div className="guide-quickref-buttons">
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setActiveModule("carbon")}>
                <i className="bi bi-play" /> Go to Analysis
              </button>
              <button type="button" className="btn btn-sm btn-outline-success" onClick={() => setActiveModule("about")}>
                <i className="bi bi-info-circle" /> About Program
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
