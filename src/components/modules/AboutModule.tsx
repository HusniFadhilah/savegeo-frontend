import { useUiStore } from "@/hooks/useUiStore";

export default function AboutModule() {
  const setActiveModule = useUiStore((s) => s.setActiveModule);

  return (
    <div className="container-fluid mt-4">
      <div className="row">
        <div className="col-12">
          <div className="card border-primary">
            <div className="card-header bg-primary text-white">
              <h4 className="mb-0">
                <i className="bi bi-info-circle-fill" /> Tentang Program
              </h4>
            </div>
            <div className="card-body">
              <div className="alert alert-primary">
                <h5 className="alert-heading">
                  <i className="bi bi-star-fill" /> AI Imagery Analytics Platform
                </h5>
                <p className="mb-0">
                  Platform inovatif berbasis kecerdasan buatan untuk analisis citra penginderaan jauh, estimasi
                  stok karbon, dan monitoring vegetasi menggunakan Google Earth Engine.
                </p>
              </div>

              <div className="row mt-4">
                <div className="col-md-6">
                  <div className="card border-success">
                    <div className="card-body">
                      <h5 className="card-title text-success">
                        <i className="bi bi-building" /> Kolaborasi
                      </h5>
                      <ul className="list-unstyled mb-0">
                        <li>
                          <i className="bi bi-check-circle-fill text-success" /> <strong>Universitas Diponegoro</strong>
                        </li>
                        <li>
                          <i className="bi bi-check-circle-fill text-success" />{" "}
                          <strong>PT LEN Industri (Persero)</strong>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card border-info">
                    <div className="card-body">
                      <h5 className="card-title text-info">
                        <i className="bi bi-award-fill" /> Program
                      </h5>
                      <p className="mb-0">
                        <i className="bi bi-check-circle-fill text-info" /> <strong>Riset Hilirisasi Program Ajakan Industri</strong>
                      </p>
                      <p className="mb-0 mt-2">
                        <i className="bi bi-patch-check-fill text-success" /> Paten Sederhana: <strong>S00202515583</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card border-warning mt-4">
                <div className="card-header bg-warning">
                  <h5 className="mb-0">
                    <i className="bi bi-lightning-fill" /> Fitur Utama
                  </h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <div className="text-center">
                        <i className="bi bi-tree-fill text-success" style={{ fontSize: "3rem" }} />
                        <h6 className="mt-2">Analisis Vegetasi</h6>
                        <p className="text-muted small">8 indeks vegetasi (NDVI, NDWI, MNDWI, NDBI, EVI, SAVI, BSI, NDMI)</p>
                      </div>
                    </div>
                    <div className="col-md-4 mb-3">
                      <div className="text-center">
                        <i className="bi bi-map-fill text-primary" style={{ fontSize: "3rem" }} />
                        <h6 className="mt-2">Land Cover</h6>
                        <p className="text-muted small">Dynamic World, ESA WorldCover, ESRI Land Cover</p>
                      </div>
                    </div>
                    <div className="col-md-4 mb-3">
                      <div className="text-center">
                        <i className="bi bi-graph-up-arrow text-danger" style={{ fontSize: "3rem" }} />
                        <h6 className="mt-2">Estimasi Karbon</h6>
                        <p className="text-muted small">Machine learning dengan validasi silang untuk akurasi tinggi</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card border-secondary mt-4">
                <div className="card-header">
                  <h5 className="mb-0">
                    <i className="bi bi-cpu-fill" /> Teknologi
                  </h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6">
                      <h6>
                        <i className="bi bi-cloud-fill text-info" /> Backend & Processing
                      </h6>
                      <ul>
                        <li>Google Earth Engine</li>
                        <li>Python Flask API</li>
                        <li>Semi-Supervised UNet (GPU H100)</li>
                        <li>Scikit-learn (ML Models)</li>
                      </ul>
                    </div>
                    <div className="col-md-6">
                      <h6>
                        <i className="bi bi-display-fill text-primary" /> Frontend & Visualization
                      </h6>
                      <ul>
                        <li>Bootstrap 5 + Leaflet.js</li>
                        <li>Chart.js for Analytics</li>
                        <li>Responsive Web Design</li>
                        <li>Interactive Mapping</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="alert alert-secondary mt-4">
                <h6>
                  <i className="bi bi-link-45deg" /> Akses Cepat
                </h6>
                <div className="d-flex gap-2 flex-wrap">
                  <button type="button" className="btn btn-primary" onClick={() => setActiveModule("carbon")}>
                    <i className="bi bi-play-fill" /> Mulai Analisis
                  </button>
                  <button type="button" className="btn btn-success" onClick={() => setActiveModule("guide")}>
                    <i className="bi bi-book-fill" /> Baca Panduan
                  </button>
                  <button type="button" className="btn btn-info" onClick={() => setActiveModule("details")}>
                    <i className="bi bi-file-text-fill" /> Detail Program
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
