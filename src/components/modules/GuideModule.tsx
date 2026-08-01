import { useState, type ReactNode } from "react";
import { useUiStore } from "@/hooks/useUiStore";

interface AccordionSectionProps {
  id: string;
  icon: string;
  iconColor: string;
  title: string;
  openId: string | null;
  onToggle: (id: string) => void;
  children: ReactNode;
}

function AccordionSection({ id, icon, iconColor, title, openId, onToggle, children }: AccordionSectionProps) {
  const isOpen = openId === id;
  return (
    <div className="accordion-item">
      <h2 className="accordion-header">
        <button
          type="button"
          className={`accordion-button ${isOpen ? "" : "collapsed"}`}
          onClick={() => onToggle(id)}
        >
          <i className={`bi ${icon} ${iconColor} me-2`} />
          <strong>{title}</strong>
        </button>
      </h2>
      {isOpen && (
        <div className="accordion-collapse collapse show">
          <div className="accordion-body">{children}</div>
        </div>
      )}
    </div>
  );
}

/** Faithful port of module-guide.html; Bootstrap's JS accordion (data-bs-toggle)
 * is replaced with local React state since only Bootstrap CSS is bundled. */
export default function GuideModule() {
  const setActiveModule = useUiStore((s) => s.setActiveModule);
  const [openId, setOpenId] = useState<string | null>("step1");
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  return (
    <div className="container-fluid mt-4">
      <div className="row">
        <div className="col-12">
          <div className="card border-success">
            <div className="card-header bg-success text-white">
              <h4 className="mb-0">
                <i className="bi bi-book-fill" /> Panduan Lengkap Penggunaan Platform
              </h4>
            </div>
            <div className="card-body">
              <div className="alert alert-success">
                <h5 className="alert-heading">
                  <i className="bi bi-rocket-takeoff-fill" /> Memulai Analisis
                </h5>
                <p className="mb-0">
                  Platform SAVEGEO memudahkan Anda melakukan analisis geospasial hanya dalam 3 langkah:{" "}
                  <strong>Pilih AOI → Atur Parameter → Jalankan Analisis</strong>
                </p>
              </div>

              <div className="accordion" id="guideAccordion">
                <AccordionSection id="step1" icon="bi-1-circle-fill" iconColor="text-primary" title="Langkah 1: Memilih Area of Interest (AOI)" openId={openId} onToggle={toggle}>
                  <p>
                    <strong>Ada 3 cara untuk memilih area analisis:</strong>
                  </p>

                  <div className="card border-primary mb-3">
                    <div className="card-header">
                      <strong>
                        <i className="bi bi-flag-fill" /> Metode A: Indonesia Admin Boundaries
                      </strong>
                    </div>
                    <div className="card-body">
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
                      <div className="alert alert-info mb-0">
                        <i className="bi bi-info-circle-fill" /> <strong>Tips:</strong> Anda bisa memilih hanya
                        sampai level provinsi dengan klik &quot;📍 Use Province Only&quot; atau level lainnya
                        sesuai kebutuhan.
                      </div>
                    </div>
                  </div>

                  <div className="card border-success mb-3">
                    <div className="card-header">
                      <strong>
                        <i className="bi bi-geo-alt-fill" /> Metode B: Koordinat + Buffer
                      </strong>
                    </div>
                    <div className="card-body">
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
                      <div className="alert alert-warning mb-0">
                        <i className="bi bi-exclamation-triangle-fill" /> <strong>Catatan:</strong> Buffer yang
                        terlalu besar dapat memperlambat processing.
                      </div>
                    </div>
                  </div>

                  <div className="card border-warning mb-0">
                    <div className="card-header">
                      <strong>
                        <i className="bi bi-pencil-fill" /> Metode C: Gambar Manual
                      </strong>
                    </div>
                    <div className="card-body">
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
                      <div className="alert alert-success mb-0">
                        <i className="bi bi-lightbulb-fill" /> <strong>Kelebihan:</strong> Metode ini paling
                        fleksibel untuk area yang spesifik.
                      </div>
                    </div>
                  </div>
                </AccordionSection>

                <AccordionSection id="step2" icon="bi-2-circle-fill" iconColor="text-success" title="Langkah 2: Memilih Jenis Analisis" openId={openId} onToggle={toggle}>
                  <p>
                    <strong>Platform menyediakan 4 jenis analisis:</strong>
                  </p>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <div className="card border-success h-100">
                        <div className="card-body">
                          <h6 className="card-title text-success">
                            <i className="bi bi-tree-fill" /> 1. Vegetation Indices
                          </h6>
                          <p className="card-text">Analisis 8 indeks vegetasi: NDVI, NDWI, MNDWI, NDBI, EVI, SAVI, BSI, NDMI</p>
                          <strong>Cocok untuk:</strong>
                          <ul className="small">
                            <li>Monitoring kesehatan vegetasi</li>
                            <li>Deteksi stress tanaman</li>
                            <li>Monitoring kandungan air</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <div className="card border-primary h-100">
                        <div className="card-body">
                          <h6 className="card-title text-primary">
                            <i className="bi bi-map-fill" /> 2. Land Cover
                          </h6>
                          <p className="card-text">Klasifikasi tutupan lahan dari 3 dataset: Dynamic World, ESA WorldCover, ESRI</p>
                          <strong>Cocok untuk:</strong>
                          <ul className="small">
                            <li>Pemetaan penggunaan lahan</li>
                            <li>Monitoring perubahan lahan</li>
                            <li>Analisis habitat</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <div className="card border-danger h-100">
                        <div className="card-body">
                          <h6 className="card-title text-danger">
                            <i className="bi bi-graph-up-arrow" /> 3. Carbon Stock Estimation
                          </h6>
                          <p className="card-text">Estimasi stok karbon menggunakan machine learning dan data biomassa</p>
                          <strong>Cocok untuk:</strong>
                          <ul className="small">
                            <li>Inventarisasi karbon</li>
                            <li>Pelaporan emisi</li>
                            <li>Valuasi jasa ekosistem</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <div className="card border-warning h-100">
                        <div className="card-body">
                          <h6 className="card-title text-warning">
                            <i className="bi bi-layers-fill" /> 4. Combined Analysis
                          </h6>
                          <p className="card-text">Menggabungkan semua analisis dalam satu proses (lebih lama)</p>
                          <strong>Cocok untuk:</strong>
                          <ul className="small">
                            <li>Laporan komprehensif</li>
                            <li>Studi multi-aspek</li>
                            <li>Analisis mendalam</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionSection>

                <AccordionSection id="step3" icon="bi-3-circle-fill" iconColor="text-warning" title="Langkah 3: Mengatur Parameter" openId={openId} onToggle={toggle}>
                  <div className="alert alert-warning">
                    <i className="bi bi-sliders" /> <strong>Parameter berbeda untuk setiap jenis analisis.</strong>{" "}
                    Berikut panduan untuk masing-masing:
                  </div>

                  <div className="card border-success mb-3">
                    <div className="card-header bg-success text-white">
                      <strong>Parameter untuk Vegetation Indices</strong>
                    </div>
                    <div className="card-body">
                      <table className="table table-sm table-hover">
                        <thead>
                          <tr>
                            <th>Parameter</th>
                            <th>Deskripsi</th>
                            <th>Rekomendasi</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><strong>Year</strong></td>
                            <td>Tahun citra Sentinel-2</td>
                            <td>2022-2025 untuk data terbaru</td>
                          </tr>
                          <tr>
                            <td><strong>Month Range</strong></td>
                            <td>Rentang bulan untuk analisis</td>
                            <td>3-4 bulan untuk composite stabil</td>
                          </tr>
                          <tr>
                            <td><strong>Cloud Threshold</strong></td>
                            <td>% awan maksimal</td>
                            <td>20-40% untuk area tropis</td>
                          </tr>
                          <tr>
                            <td><strong>Indices Selection</strong></td>
                            <td>Pilih indeks yang dibutuhkan</td>
                            <td>NDVI wajib, tambahkan sesuai kebutuhan</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="card border-primary mb-3">
                    <div className="card-header bg-primary text-white">
                      <strong>Parameter untuk Land Cover</strong>
                    </div>
                    <div className="card-body">
                      <table className="table table-sm table-hover">
                        <thead>
                          <tr>
                            <th>Parameter</th>
                            <th>Deskripsi</th>
                            <th>Rekomendasi</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><strong>Year</strong></td>
                            <td>Tahun dataset</td>
                            <td>2021-2023 untuk data terkini</td>
                          </tr>
                          <tr>
                            <td><strong>Datasets</strong></td>
                            <td>Pilih 1 atau lebih dataset</td>
                            <td>Dynamic World untuk near-realtime</td>
                          </tr>
                          <tr>
                            <td><strong>DW Mode</strong></td>
                            <td>Mode untuk Dynamic World</td>
                            <td>Mode (paling stabil)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="card border-danger mb-0">
                    <div className="card-header bg-danger text-white">
                      <strong>Parameter untuk Carbon Stock Estimation</strong>
                    </div>
                    <div className="card-body">
                      <table className="table table-sm table-hover">
                        <thead>
                          <tr>
                            <th>Parameter</th>
                            <th>Deskripsi</th>
                            <th>Rekomendasi</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><strong>Reference Dataset</strong></td>
                            <td>Dataset biomassa acuan</td>
                            <td>ESA CCI (paling akurat)</td>
                          </tr>
                          <tr>
                            <td><strong>Pre-trained Model</strong></td>
                            <td>Model ML yang digunakan</td>
                            <td>Gunakan default atau pilih model GEE-compatible</td>
                          </tr>
                          <tr>
                            <td><strong>Year</strong></td>
                            <td>Tahun Sentinel-2</td>
                            <td>2022-2024</td>
                          </tr>
                          <tr>
                            <td><strong>Month Range</strong></td>
                            <td>Rentang bulan</td>
                            <td>Seluruh tahun (Jan-Dec) untuk akurasi terbaik</td>
                          </tr>
                          <tr>
                            <td><strong>Cloud Threshold</strong></td>
                            <td>% awan maksimal</td>
                            <td>10% (lebih ketat untuk carbon)</td>
                          </tr>
                          <tr>
                            <td><strong>Display Mode</strong></td>
                            <td>Clipped vs Full Tiles</td>
                            <td>Clipped untuk akurasi, Full untuk kecepatan</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </AccordionSection>

                <AccordionSection id="step4" icon="bi-4-circle-fill" iconColor="text-danger" title="Langkah 4: Menjalankan dan Membaca Hasil" openId={openId} onToggle={toggle}>
                  <div className="card border-primary mb-3">
                    <div className="card-header">
                      <strong>
                        <i className="bi bi-play-fill" /> Menjalankan Analisis
                      </strong>
                    </div>
                    <div className="card-body">
                      <ol>
                        <li>Pastikan AOI sudah dipilih (terlihat di peta)</li>
                        <li>Pastikan parameter sudah diatur</li>
                        <li>
                          Klik tombol <strong className="text-primary">&quot;Run Analysis&quot;</strong>
                        </li>
                        <li>Tunggu proses selesai (1-5 menit tergantung kompleksitas)</li>
                        <li>Loading indicator akan menunjukkan progress</li>
                      </ol>
                      <div className="alert alert-info">
                        <i className="bi bi-clock-fill" /> <strong>Waktu Processing:</strong>
                        <ul className="mb-0 mt-2">
                          <li>Vegetation: ~30-60 detik</li>
                          <li>Land Cover: ~1-2 menit</li>
                          <li>Carbon: ~2-5 menit</li>
                          <li>Combined: ~5-10 menit</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="card border-success mb-3">
                    <div className="card-header bg-success text-white">
                      <strong>
                        <i className="bi bi-bar-chart-fill" /> Membaca Hasil Analisis
                      </strong>
                    </div>
                    <div className="card-body">
                      <h6><strong>1. Results Map</strong></h6>
                      <ul>
                        <li>Tab untuk setiap layer hasil</li>
                        <li>Peta interaktif dengan zoom/pan</li>
                        <li>Legend menunjukkan skala nilai</li>
                      </ul>
                      <h6 className="mt-3"><strong>2. Metrics Cards</strong></h6>
                      <ul>
                        <li>Ringkasan nilai utama</li>
                        <li>Jumlah citra, area total, nilai rata-rata</li>
                        <li>Badge berwarna untuk interpretasi cepat</li>
                      </ul>
                      <h6 className="mt-3"><strong>3. Statistics Table</strong></h6>
                      <ul>
                        <li>Detail statistik per indeks/kelas</li>
                        <li>Min, Mean, Max, Std Dev</li>
                        <li>Deskripsi untuk setiap metrik</li>
                      </ul>
                      <h6 className="mt-3"><strong>4. Charts & Visualization</strong></h6>
                      <ul>
                        <li>Bar chart untuk perbandingan</li>
                        <li>Pie chart untuk distribusi (land cover)</li>
                        <li>Line chart untuk trend (time series)</li>
                      </ul>
                      <h6 className="mt-3"><strong>5. Carbon-Specific Results</strong></h6>
                      <ul>
                        <li><strong>Carbon Density:</strong> Mean, Std Dev, Min, Max (Mg/ha)</li>
                        <li><strong>Total Stock:</strong> Total carbon (tons), Area (ha)</li>
                        <li><strong>CO₂ Equivalent:</strong> Konversi ke CO₂</li>
                        <li><strong>Model Performance:</strong> RMSE, R², Validation metrics</li>
                      </ul>
                    </div>
                  </div>

                  <div className="card border-warning mb-0">
                    <div className="card-header bg-warning">
                      <strong>
                        <i className="bi bi-download" /> Export Hasil
                      </strong>
                    </div>
                    <div className="card-body">
                      <p><strong>3 cara export hasil:</strong></p>
                      <div className="row">
                        <div className="col-md-4">
                          <div className="text-center p-3 border rounded">
                            <i className="bi bi-file-image text-primary" style={{ fontSize: "2rem" }} />
                            <h6 className="mt-2">Export GeoTIFF</h6>
                            <p className="small text-muted">Untuk GIS software</p>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="text-center p-3 border rounded">
                            <i className="bi bi-file-code text-success" style={{ fontSize: "2rem" }} />
                            <h6 className="mt-2">Download Stats</h6>
                            <p className="small text-muted">JSON format</p>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="text-center p-3 border rounded">
                            <i className="bi bi-file-text text-danger" style={{ fontSize: "2rem" }} />
                            <h6 className="mt-2">Generate Report</h6>
                            <p className="small text-muted">Markdown format</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionSection>

                <AccordionSection id="stepTips" icon="bi-lightbulb-fill" iconColor="text-warning" title="Tips & Best Practices" openId={openId} onToggle={toggle}>
                  <div className="alert alert-success">
                    <h6><i className="bi bi-check-circle-fill" /> DO&apos;s (Lakukan)</h6>
                    <ul className="mb-0">
                      <li>✅ Mulai dengan area kecil untuk testing</li>
                      <li>✅ Gunakan cloud threshold yang sesuai dengan wilayah</li>
                      <li>✅ Pilih periode kering untuk hasil terbaik (carbon)</li>
                      <li>✅ Save/export hasil untuk dokumentasi</li>
                      <li>✅ Bandingkan multiple datasets untuk validasi</li>
                      <li>✅ Perhatikan mode display (Clipped vs Full) untuk carbon</li>
                    </ul>
                  </div>

                  <div className="alert alert-danger">
                    <h6><i className="bi bi-x-circle-fill" /> DON&apos;Ts (Hindari)</h6>
                    <ul className="mb-0">
                      <li>❌ Area terlalu besar (&gt;1000 km²) untuk carbon</li>
                      <li>❌ Cloud threshold terlalu rendah di area tropis</li>
                      <li>❌ Month range terlalu pendek (&lt;3 bulan)</li>
                      <li>❌ Menjalankan multiple analysis bersamaan</li>
                      <li>❌ Menutup browser saat processing</li>
                    </ul>
                  </div>

                  <div className="card border-info">
                    <div className="card-header">
                      <strong>
                        <i className="bi bi-question-circle-fill" /> Troubleshooting
                      </strong>
                    </div>
                    <div className="card-body">
                      <table className="table table-sm table-hover">
                        <thead>
                          <tr>
                            <th>Problem</th>
                            <th>Solution</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><strong>No images found</strong></td>
                            <td>
                              • Tingkatkan cloud threshold
                              <br />• Perluas month range
                              <br />• Coba tahun berbeda
                            </td>
                          </tr>
                          <tr>
                            <td><strong>Processing timeout</strong></td>
                            <td>
                              • Kurangi area size
                              <br />• Gunakan Full Tiles mode
                              <br />• Perpendek month range
                            </td>
                          </tr>
                          <tr>
                            <td><strong>Empty results</strong></td>
                            <td>
                              • Pastikan AOI benar
                              <br />• Check internet connection
                              <br />• Refresh page dan coba lagi
                            </td>
                          </tr>
                          <tr>
                            <td><strong>Low accuracy (carbon)</strong></td>
                            <td>
                              • Gunakan ESA CCI dataset
                              <br />• Pilih pre-trained model
                              <br />• Gunakan longer time period
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="alert alert-primary mt-3">
                    <h6><i className="bi bi-book" /> Referensi & Learning</h6>
                    <ul className="mb-0">
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
                      <li><strong>Carbon Stock Methodology:</strong> IPCC Guidelines</li>
                    </ul>
                  </div>
                </AccordionSection>
              </div>

              <div className="card border-secondary mt-4">
                <div className="card-header">
                  <h5 className="mb-0"><i className="bi bi-bookmark-fill" /> Quick Reference</h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6">
                      <h6><i className="bi bi-keyboard" /> Keyboard Shortcuts</h6>
                      <table className="table table-sm table-hover">
                        <tbody>
                          <tr>
                            <td><code>Ctrl + Z</code></td>
                            <td>Undo drawing</td>
                          </tr>
                          <tr>
                            <td><code>Escape</code></td>
                            <td>Cancel drawing</td>
                          </tr>
                          <tr>
                            <td><code>+/-</code></td>
                            <td>Zoom in/out map</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="col-md-6">
                      <h6><i className="bi bi-lightning-fill" /> Quick Actions</h6>
                      <div className="d-grid gap-2">
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setActiveModule("carbon")}>
                          <i className="bi bi-play" /> Go to Analysis
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-success" onClick={() => setActiveModule("about")}>
                          <i className="bi bi-info-circle" /> About Program
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-info" onClick={() => setActiveModule("details")}>
                          <i className="bi bi-file-text" /> Program Details
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
