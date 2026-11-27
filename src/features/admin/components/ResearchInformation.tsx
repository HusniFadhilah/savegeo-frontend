import { AdminTableNumberCell, AdminTableNumberHeader } from "@/features/admin/components/AdminTableNumber";
import { useBilingualCopy } from "@/hooks/useBilingualCopy";
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
  const c = useBilingualCopy();
  const english: Record<string, string> = {
    "Informasi pada halaman ini bersifat internal dan hanya tersedia untuk administrator.": "This information is internal and available to administrators only.",
    "Identitas riset": "Research overview", Keterangan: "Description", Nilai: "Value", "Nomor paten": "Patent number",
    Jenis: "Type", "Paten Sederhana": "Simple patent", Inovasi: "Innovation", "Sistem Estimasi Stok Karbon Berbasis AI": "AI-Based Carbon Stock Estimation System",
    Platform: "Platform", "Teknologi yang digunakan": "Technology stack", "Backend dan Processing": "Backend and processing",
    "Frontend dan Visualisasi": "Frontend and visualization", "Tim peneliti": "Research team", Nama: "Name", Peran: "Role", Afiliasi: "Affiliation",
    "Mitra industri": "Industry partners", "Metodologi penelitian": "Research methodology", "Ketua Peneliti": "Principal investigator",
    "Anggota Peneliti": "Research team member", "Direktur Utama": "President director", "Akuisisi Data": "Data acquisition",
    "Segmentasi dan Preprocessing": "Segmentation and preprocessing", "Estimasi Biomassa": "Biomass estimation", "Konversi dan Output": "Conversion and outputs",
    "Citra Sentinel-2 (12 band spektral)": "Sentinel-2 imagery (12 spectral bands)", "Dataset Dynamic World (Google)": "Dynamic World dataset (Google)",
    "ESA WorldCover dan ESRI Land Cover": "ESA WorldCover and Esri Land Cover", "API Wilayah Indonesia untuk AOI (Area of Interest)": "Indonesia administrative-boundary API for AOI (area of interest)",
    "Semi-Supervised UNet dengan GPU Server H100": "Semi-supervised U-Net on an H100 GPU server", "Cloud masking dan filtering": "Cloud masking and filtering",
    "Composite median untuk time series": "Median composites for time series", "Robust Linear Regression dari Google Earth Engine": "Robust linear regression in Google Earth Engine",
    "Kalibrasi menggunakan referensi karbon global (WCMC, ESA CCI)": "Calibration against global carbon references (WCMC, ESA CCI)",
    "Cross-validation untuk validasi model": "Cross-validation for model assessment", "Konversi AGB (Above Ground Biomass) ke stok karbon": "Conversion of AGB (aboveground biomass) to carbon stock",
    "CO2 ekuivalen = karbon x 3.67 (IPCC conversion factor)": "CO₂ equivalent = carbon × 3.67 (IPCC conversion factor)",
    "Visualisasi peta densitas karbon (Mg C/ha)": "Carbon-density map (Mg C/ha)", "Statistik regional dan insight stok karbon": "Regional statistics and carbon-stock insights",
    "Len Innovation Technology (LenIoT)": "Len Innovation Technology (LenIoT)", "Senior General Manager Information System": "Senior General Manager, Information Systems",
  };
  const text = (id: string) => c(id, english[id] ?? id);
  return (
    <div>
      <div className="alert alert-warning py-2 px-3 small">
        <i className="bi bi-lock-fill me-2" /> {text("Informasi pada halaman ini bersifat internal dan hanya tersedia untuk administrator.")}
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-header-custom">
            <span>{text("Identitas riset")}</span>
          </div>
          <div className="card-body-custom">
            <table className="tbl">
              <thead><tr><AdminTableNumberHeader /><th>{text("Keterangan")}</th><th>{text("Nilai")}</th></tr></thead>
              <tbody>
                <tr>
                  <AdminTableNumberCell index={0} />
                  <td>{text("Nomor paten")}</td>
                  <td className="tbl-mono">S00202515583</td>
                </tr>
                <tr>
                  <AdminTableNumberCell index={1} />
                  <td>{text("Jenis")}</td>
                  <td>{text("Paten Sederhana")}</td>
                </tr>
                <tr>
                  <AdminTableNumberCell index={2} />
                  <td>{text("Inovasi")}</td>
                  <td>{text("Sistem Estimasi Stok Karbon Berbasis AI")}</td>
                </tr>
                <tr>
                  <AdminTableNumberCell index={3} />
                  <td>{text("Platform")}</td>
                  <td>savegeo.len.co.id</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header-custom">
            <span>{text("Teknologi yang digunakan")}</span>
          </div>
          <div className="card-body-custom">
            {TECHNOLOGY_GROUPS.map((group) => (
              <div key={group.title} style={{ marginBottom: 14 }}>
                <strong>{text(group.title)}</strong>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  {group.items.map((item) => <li key={item}>{text(item)}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header-custom">
          <span>{text("Tim peneliti")}</span>
        </div>
        <div className="card-body-custom">
          <table className="tbl tbl-wide">
            <thead>
              <tr><AdminTableNumberHeader /><th>{text("Nama")}</th><th>{text("Peran")}</th><th>{text("Afiliasi")}</th></tr>
            </thead>
            <tbody>
              {RESEARCHERS.map((person, index) => (
                <tr key={person.name}><AdminTableNumberCell index={index} /><td>{person.name}</td><td>{text(person.role)}</td><td>{person.affiliation}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header-custom">
          <span>{text("Mitra industri")}</span>
        </div>
        <div className="card-body-custom">
          <table className="tbl tbl-wide">
            <thead>
              <tr><AdminTableNumberHeader /><th>{text("Nama")}</th><th>{text("Peran")}</th><th>{text("Afiliasi")}</th></tr>
            </thead>
            <tbody>
              {PARTNERS.map((partner, index) => (
                <tr key={partner.name}><AdminTableNumberCell index={index} /><td>{partner.name}</td><td>{text(partner.role)}</td><td>PT LEN Industri (Persero)</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header-custom">
          <span>{text("Metodologi penelitian")}</span>
        </div>
        <div className="card-body-custom">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {METHOD_STEPS.map((step, index) => (
              <div key={step.title}>
                <strong>{index + 1}. {text(step.title)}</strong>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  {step.items.map((item) => <li key={item}>{text(item)}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
