export default function DetailsModule() {
  return (
    <div className="container-fluid mt-4">
      <div className="row">
        <div className="col-12">
          <div className="card border-info">
            <div className="card-header bg-info text-white">
              <h4 className="mb-0">
                <i className="bi bi-file-text-fill" /> Detail Program Penelitian
              </h4>
            </div>
            <div className="card-body">
              <div className="card border-primary mb-4">
                <div className="card-header bg-primary text-white">
                  <h5 className="mb-0">
                    <i className="bi bi-people-fill" /> Tim Peneliti
                  </h5>
                </div>
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th>Nama</th>
                          <th>Jabatan</th>
                          <th>Afiliasi</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <strong>Dr. Eng. Adi Wibowo, S.Si., M.Kom.</strong>
                          </td>
                          <td>
                            <span className="badge bg-primary">Ketua Peneliti</span>
                          </td>
                          <td>Universitas Diponegoro</td>
                        </tr>
                        <tr>
                          <td>Satriawan Rasyid Purnama, S.Kom., M.Cs.</td>
                          <td>
                            <span className="badge bg-secondary">Anggota Peneliti</span>
                          </td>
                          <td>Universitas Diponegoro</td>
                        </tr>
                        <tr>
                          <td>Prof. Dr. Sc. Anindya Wirasatriya, S.T., M.Si., M.Sc.</td>
                          <td>
                            <span className="badge bg-secondary">Anggota Peneliti</span>
                          </td>
                          <td>Universitas Diponegoro</td>
                        </tr>
                        <tr>
                          <td>Dr. Budi Warsito, S.Si., M.Si.</td>
                          <td>
                            <span className="badge bg-secondary">Anggota Peneliti</span>
                          </td>
                          <td>Universitas Diponegoro</td>
                        </tr>
                        <tr>
                          <td>Dr. Muhammad Helmi, S.Si., M.Si.</td>
                          <td>
                            <span className="badge bg-secondary">Anggota Peneliti</span>
                          </td>
                          <td>Universitas Diponegoro</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="card border-success mb-4">
                <div className="card-header bg-success text-white">
                  <h5 className="mb-0">
                    <i className="bi bi-building-fill" /> Tim Mitra Industri
                  </h5>
                </div>
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th>Nama</th>
                          <th>Jabatan</th>
                          <th>Afiliasi</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <strong>Prof. Joga Dharma Setiawan, B.Sc., M.Sc., PhD.</strong>
                          </td>
                          <td>
                            <span className="badge bg-success">Direktur Utama</span>
                          </td>
                          <td>PT LEN Industri (Persero)</td>
                        </tr>
                        <tr>
                          <td>Ilham Nugraha, S.T., M.M., IPM.</td>
                          <td>
                            <span className="badge bg-info">Senior General Manager IS</span>
                          </td>
                          <td>PT LEN Industri (Persero)</td>
                        </tr>
                        <tr>
                          <td>Heru Permana, S.St.</td>
                          <td>
                            <span className="badge bg-info">
                              VP of Intelligent Product Innovation & VP of Critical System Innovation
                            </span>
                          </td>
                          <td>PT LEN Industri (Persero)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="card border-warning mb-4">
                <div className="card-header bg-warning">
                  <h5 className="mb-0">
                    <i className="bi bi-trophy-fill" /> Output Penelitian
                  </h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <div className="card border-success">
                        <div className="card-body">
                          <h6 className="card-title text-success">
                            <i className="bi bi-patch-check-fill" /> Paten Sederhana
                          </h6>
                          <p className="mb-1">
                            <strong>Nomor Permohonan:</strong> S00202515583
                          </p>
                          <p className="mb-0">
                            <strong>Jenis:</strong> Sistem Estimasi Stok Karbon Berbasis AI
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <div className="card border-primary">
                        <div className="card-body">
                          <h6 className="card-title text-primary">
                            <i className="bi bi-globe2" /> Platform Web
                          </h6>
                          <p className="mb-1">
                            <strong>URL:</strong>{" "}
                            <a href="https://savegeo.len.co.id" target="_blank" rel="noreferrer">
                              savegeo.len.co.id
                            </a>
                          </p>
                          <p className="mb-0">
                            <strong>Status:</strong> <span className="badge bg-success">Aktif</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="alert alert-info mt-3">
                    <h6>
                      <i className="bi bi-info-circle-fill" /> Deskripsi Inovasi
                    </h6>
                    <p className="mb-0">
                      Riset ini menghasilkan invensi <strong>sistem estimasi stok karbon berbasis kecerdasan buatan</strong>{" "}
                      menggunakan citra penginderaan jauh. Inovasi platform web ini melahirkan{" "}
                      <strong>pemetaan biomassa presisi</strong> dan <strong>pelaporan transparan</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="card border-secondary mb-4">
                <div className="card-header bg-secondary text-white">
                  <h5 className="mb-0">
                    <i className="bi bi-gear-fill" /> Metodologi Penelitian
                  </h5>
                </div>
                <div className="card-body">
                  <h6>
                    <i className="bi bi-1-circle-fill text-primary" /> Akuisisi Data
                  </h6>
                  <ul>
                    <li>Citra Sentinel-2 (12 band spektral)</li>
                    <li>Dataset Dynamic World (Google)</li>
                    <li>ESA WorldCover dan ESRI Land Cover</li>
                    <li>API SP3STAB untuk AOI (Area of Interest)</li>
                  </ul>

                  <h6 className="mt-3">
                    <i className="bi bi-2-circle-fill text-success" /> Segmentasi & Preprocessing
                  </h6>
                  <ul>
                    <li>Semi-Supervised UNet dengan GPU Server H100</li>
                    <li>Cloud masking dan filtering</li>
                    <li>Composite median untuk time series</li>
                  </ul>

                  <h6 className="mt-3">
                    <i className="bi bi-3-circle-fill text-warning" /> Estimasi Biomassa
                  </h6>
                  <ul>
                    <li>Robust Linear Regression dari Google Earth Engine</li>
                    <li>Kalibrasi menggunakan referensi karbon global (WCMC, ESA CCI)</li>
                    <li>Cross-validation untuk validasi model</li>
                  </ul>

                  <h6 className="mt-3">
                    <i className="bi bi-4-circle-fill text-danger" /> Konversi & Output
                  </h6>
                  <ul>
                    <li>Konversi AGB (Above Ground Biomass) ke stok karbon</li>
                    <li>CO₂ ekuivalen = karbon × 3.67 (IPCC conversion factor)</li>
                    <li>Visualisasi: Peta densitas karbon (Mg C/ha)</li>
                    <li>Statistik regional dan insight stok karbon</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
