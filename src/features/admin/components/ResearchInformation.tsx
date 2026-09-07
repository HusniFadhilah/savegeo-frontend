const RESEARCHERS = [
  { name: "Dr. Eng. Adi Wibowo, S.Si., M.Kom.", role: "Ketua Peneliti", affiliation: "Universitas Diponegoro" },
  { name: "Satriawan Rasyid Purnama, S.Kom., M.Cs.", role: "Anggota Peneliti", affiliation: "Universitas Diponegoro" },
  { name: "Prof. Dr. Sc. Anindya Wirasatriya, S.T., M.Si., M.Sc.", role: "Anggota Peneliti", affiliation: "Universitas Diponegoro" },
  { name: "Dr. Budi Warsito, S.Si., M.Si.", role: "Anggota Peneliti", affiliation: "Universitas Diponegoro" },
  { name: "Dr. Muhammad Helmi, S.Si., M.Si.", role: "Anggota Peneliti", affiliation: "Universitas Diponegoro" },
];

const PARTNERS = [
  { name: "Prof. Joga Dharma Setiawan, B.Sc., M.Sc., PhD.", role: "Direktur Utama" },
  { name: "Ilham Nugraha, S.T., M.M., IPM.", role: "Senior General Manager Information System" },
  { name: "Heru Permana, S.St.", role: "Len Innovation Technology (LenIoT)" },
];

const TECHNOLOGY_GROUPS = [
  {
    title: "Backend dan Processing",
    items: ["Google Earth Engine", "Python Flask API", "Semi-Supervised UNet (GPU H100)", "Scikit-learn (ML Models)"],
  },
  {
    title: "Frontend dan Visualisasi",
    items: ["Bootstrap 5 dan Leaflet.js", "Chart.js for Analytics", "Responsive Web Design", "Interactive Mapping"],
  },
];

const METHOD_STEPS = [
  {
    title: "Akuisisi Data",
    items: [
      "Citra Sentinel-2 (12 band spektral)",
      "Dataset Dynamic World (Google)",
      "ESA WorldCover dan ESRI Land Cover",
      "API Wilayah Indonesia untuk AOI (Area of Interest)",
    ],
  },
  {
    title: "Segmentasi dan Preprocessing",
    items: ["Semi-Supervised UNet dengan GPU Server H100", "Cloud masking dan filtering", "Composite median untuk time series"],
  },
  {
    title: "Estimasi Biomassa",
    items: [
      "Robust Linear Regression dari Google Earth Engine",
      "Kalibrasi menggunakan referensi karbon global (WCMC, ESA CCI)",
      "Cross-validation untuk validasi model",
    ],
  },
  {
    title: "Konversi dan Output",
    items: [
      "Konversi AGB (Above Ground Biomass) ke stok karbon",
      "CO2 ekuivalen = karbon x 3.67 (IPCC conversion factor)",
      "Visualisasi peta densitas karbon (Mg C/ha)",
      "Statistik regional dan insight stok karbon",
    ],
  },
];

export default function ResearchInformation() {
  return (
    <div>
      <div className="alert alert-warning py-2 px-3 small">
        <i className="bi bi-lock-fill me-2" /> Informasi pada halaman ini bersifat internal dan hanya tersedia untuk administrator.
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-header-custom">
            <span>Identitas riset</span>
          </div>
          <div className="card-body-custom">
            <table className="tbl tbl-wide">
              <tbody>
                <tr>
                  <td>Nomor paten</td>
                  <td className="tbl-mono">S00202515583</td>
                </tr>
                <tr>
                  <td>Jenis</td>
                  <td>Paten Sederhana</td>
                </tr>
                <tr>
                  <td>Inovasi</td>
                  <td>Sistem Estimasi Stok Karbon Berbasis AI</td>
                </tr>
                <tr>
                  <td>Platform</td>
                  <td>savegeo.len.co.id</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header-custom">
            <span>Teknologi yang digunakan</span>
          </div>
          <div className="card-body-custom">
            {TECHNOLOGY_GROUPS.map((group) => (
              <div key={group.title} style={{ marginBottom: 14 }}>
                <strong>{group.title}</strong>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  {group.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header-custom">
          <span>Tim peneliti</span>
        </div>
        <div className="card-body-custom">
          <table className="tbl tbl-wide">
            <thead>
              <tr><th>Nama</th><th>Peran</th><th>Afiliasi</th></tr>
            </thead>
            <tbody>
              {RESEARCHERS.map((person) => (
                <tr key={person.name}><td>{person.name}</td><td>{person.role}</td><td>{person.affiliation}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header-custom">
          <span>Mitra industri</span>
        </div>
        <div className="card-body-custom">
          <table className="tbl tbl-wide">
            <thead>
              <tr><th>Nama</th><th>Peran</th><th>Afiliasi</th></tr>
            </thead>
            <tbody>
              {PARTNERS.map((partner) => (
                <tr key={partner.name}><td>{partner.name}</td><td>{partner.role}</td><td>PT LEN Industri (Persero)</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header-custom">
          <span>Metodologi penelitian</span>
        </div>
        <div className="card-body-custom">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {METHOD_STEPS.map((step, index) => (
              <div key={step.title}>
                <strong>{index + 1}. {step.title}</strong>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  {step.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
