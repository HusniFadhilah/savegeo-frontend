import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { isViewerRole } from "@/auth/access";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useUiStore, type DashboardModule } from "@/hooks/useUiStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import { getDashboardModulePath } from "@/routes/dashboardModuleRoutes";
import { safeHttpUrl } from "@/utils/safeHttpUrl";

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

const PARAM_TABS: { key: ParamKey; labelKey: string; icon: string }[] = [
  { key: "veg", labelKey: "guide.param.vegetation", icon: "bi-tree-fill" },
  { key: "lc", labelKey: "guide.param.landcover", icon: "bi-map-fill" },
  { key: "carbon", labelKey: "guide.param.carbon", icon: "bi-graph-up-arrow" },
];

const DATASET_DOCS = [
  {
    group: "Citra Satelit",
    name: "Sentinel-2 MSI",
    resolution: "10-20m",
    period: "2015-sekarang",
    usedFor: "Indeks vegetasi, komposit optik, prediktor model karbon, crop health.",
    method: "Optical multispectral, 13 band; cloud masking dan median composite untuk periode analisis.",
    accuracy: "Akurasi radiometrik MSI <5% (goal 3%); kualitas hasil bergantung masking awan dan musim.",
    sourceUrl: "https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-2",
    paperUrl: "https://s2.pages.eopf.copernicus.eu/pdfs-adfs/MSI/index.html",
    notes: "Band 10/20/60m; revisit konstelasi sekitar 5 hari.",
  },
  {
    group: "Citra Satelit",
    name: "Sentinel-1 SAR",
    resolution: "10m",
    period: "2014-sekarang",
    usedFor: "Informasi radar untuk kelembaban permukaan, banjir, dan zona produktivitas.",
    method: "C-band SAR GRD; backscatter VV/VH untuk indikator permukaan dan kelembaban.",
    accuracy: "Tidak punya OA klasifikasi tunggal; robust terhadap awan, tetapi sensitif terhadap speckle/geometri.",
    sourceUrl: "https://sentinels.copernicus.eu/copernicus/sentinel-1",
    paperUrl: "https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S1_GRD",
    notes: "Dipakai sebagai layer pendukung ketika citra optik berawan.",
  },
  {
    group: "Land Cover",
    name: "Dynamic World",
    resolution: "10m",
    period: "Near real-time",
    usedFor: "Klasifikasi tutupan lahan dinamis dan analisis perubahan cepat.",
    method: "Deep learning pada Sentinel-2 L1C; menghasilkan label top-1 dan probabilitas 9 kelas.",
    accuracy: "Paper validasi global: single-date agreement mendekati konsensus annotator; studi pembanding melaporkan OA ~72%.",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_DYNAMICWORLD_V1",
    paperUrl: "https://doi.org/10.1038/s41597-022-01307-4",
    notes: "Mode kelas mayoritas lebih stabil untuk ringkasan multi-temporal.",
  },
  {
    group: "Land Cover",
    name: "ESA WorldCover",
    resolution: "10m",
    period: "2020-2021",
    usedFor: "Baseline tutupan lahan global resolusi tinggi.",
    method: "Random Forest berbasis Sentinel-1 dan Sentinel-2; produk tahunan global 11 kelas.",
    accuracy: "Validasi resmi: OA 74.4% (2020 v100) dan 76.7% (2021 v200).",
    sourceUrl: "https://esa-worldcover.org/en/data-access",
    paperUrl: "https://doi.org/10.3390/rs14164101",
    notes: "Perbandingan 2020 vs 2021 perlu hati-hati karena versi algoritma berbeda.",
  },
  {
    group: "Land Cover",
    name: "ESRI Land Cover / Living Atlas",
    resolution: "10m",
    period: "Tahunan / time-series",
    usedFor: "LULC tahunan, validasi silang, dan visualisasi perubahan.",
    method: "Deep learning Sentinel-2; kelas global tahunan untuk peta 10m.",
    accuracy: "Impact Observatory menyebut Maps for Good 85%; studi pembanding global melaporkan Esri OA ~75%.",
    sourceUrl: "https://livingatlas.arcgis.com/landcover/",
    paperUrl: "https://doi.org/10.3390/rs14164101",
    notes: "Dipakai sebagai pembanding tahunan; cakupan/kelas dapat berbeda dari Dynamic World/WorldCover.",
  },
  {
    group: "Land Cover",
    name: "MODIS MCD12Q1",
    resolution: "500m",
    period: "Bervariasi",
    usedFor: "Pembanding historis multi-skala dan time-series tutupan lahan.",
    method: "Supervised classification MODIS tahunan dengan beberapa skema kelas IGBP/UMD/LAI.",
    accuracy: "Akurasi bervariasi per kelas/region; resolusi kasar, gunakan untuk konteks regional.",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MCD12Q1",
    paperUrl: "https://doi.org/10.1016/j.rse.2010.07.013",
    notes: "Tidak cocok untuk detail lahan kecil karena resolusi 500m.",
  },
  {
    group: "Carbon Reference",
    name: "WCMC Carbon Density",
    resolution: "300m",
    period: "2010",
    usedFor: "Baseline densitas karbon global untuk estimasi stok karbon.",
    method: "Kompilasi dataset biomassa publik + ESA CCI land cover; BGB dari rasio root-to-shoot IPCC.",
    accuracy: "Katalog GEE menyatakan dataset ini belum divalidasi; gunakan sebagai baseline kasar.",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/WCMC_biomass_carbon_density_v1_0",
    paperUrl: "https://doi.org/10.1098/rstb.2019.0128",
    notes: "AGB+BGB dalam tonnes C/ha; tidak langsung sebanding dengan AGB-only.",
  },
  {
    group: "Carbon Reference",
    name: "ORNL / Spawn Biomass Carbon",
    resolution: "300m",
    period: "2010",
    usedFor: "AGB, BGB, atau kombinasi AGB+BGB untuk referensi karbon global.",
    method: "Harmonisasi peta biomassa berbasis remote sensing dan model empiris per land-cover.",
    accuracy: "Menyediakan uncertainty pixel-level; validasi bergantung produk input per kelas lahan.",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/NASA_ORNL_biomass_carbon_density_v1",
    paperUrl: "https://doi.org/10.1038/s41597-020-0444-4",
    notes: "Band agb/bgb sudah dalam Mg C/ha.",
  },
  {
    group: "Carbon Reference",
    name: "GEDI L4B Biomass",
    resolution: "1km",
    period: "2019-2023",
    usedFor: "Referensi biomassa dari lidar ruang angkasa, terutama area berhutan.",
    method: "Spaceborne lidar; L4B mengestimasi mean AGBD grid 1 km dari footprint GEDI L4A.",
    accuracy: "Produk menyertakan standard error, percentage SE, dan quality flag; requirement GEDI L1: 20 Mg/ha atau 20%.",
    sourceUrl: "https://doi.org/10.3334/ORNLDAAC/2017",
    paperUrl: "https://daacweb-prod.ornl.gov/GEDI/guides/GEDI_L4B_Gridded_Biomass.html",
    notes: "Cakupan nominal lintang ~52S sampai 52N; tidak wall-to-wall seperti citra optik.",
  },
  {
    group: "Carbon Reference",
    name: "ESA CCI AGB",
    resolution: "100m",
    period: "2010-2020",
    usedFor: "Above-ground biomass annual map untuk kalibrasi karbon.",
    method: "Multi-sensor biomass CCI; AGB (Mg biomass/ha) dikonversi ke karbon dengan faktor 0.47.",
    accuracy: "Menyediakan layer standard error; akurasi bervariasi menurut biome dan kepadatan tutupan.",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/ESA_CCI_Above_Ground_Biomass_V6_0",
    paperUrl: "https://esa-cci.github.io/cci-notebook-viewers/external-notebooks/esa-cci/cci-notebooks/notebooks/biomass-cci/",
    notes: "Gunakan tahun tersedia; tidak semua tahun kontinu di semua versi asset.",
  },
  {
    group: "Soil Carbon",
    name: "OpenLandMap SOC",
    resolution: "250m",
    period: "2019 / multi-source",
    usedFor: "Soil organic carbon untuk indikator tanah dan model SOC.",
    method: "Prediksi SOC berbasis machine learning dari profil tanah dan covariate lingkungan.",
    accuracy: "Evaluasi mengikuti SoilGrids/OpenLandMap model; unit g/kg, bukan stok Mg C/ha.",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/OpenLandMap_SOL_SOL_ORGANIC-CARBON_USDA-6A1C_M_v02",
    paperUrl: "https://doi.org/10.1371/journal.pone.0169748",
    notes: "Perlu bulk density dan kedalaman untuk konversi ke stok karbon tanah.",
  },
  {
    group: "Soil Carbon",
    name: "SoilGrids SOC",
    resolution: "250m",
    period: "2017 / v2.0",
    usedFor: "Statistik titik SOC 0-30cm dan referensi tanah global.",
    method: "Machine learning ensemble dari profil tanah global dan covariate lingkungan.",
    accuracy: "Paper SoilGrids memakai repeated 10-fold cross-validation, melaporkan R2/RMSE per properti.",
    sourceUrl: "https://www.isric.org/explore/soilgrids",
    paperUrl: "https://doi.org/10.1371/journal.pone.0169748",
    notes: "Di aplikasi dipakai untuk statistik titik; bukan layer tile peta.",
  },
  {
    group: "Crop Monitoring",
    name: "CHIRPS Daily",
    resolution: "0.05 derajat",
    period: "1981-sekarang",
    usedFor: "Curah hujan, hari kering, indikator cuaca, dan risiko kekeringan.",
    method: "Blend thermal infrared precipitation estimate dengan observasi stasiun hujan.",
    accuracy: "Kinerja bergantung densitas stasiun; CHIRPS menyediakan seri panjang untuk drought monitoring.",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY",
    paperUrl: "https://doi.org/10.1038/sdata.2015.66",
    notes: "Cocok untuk agregasi harian/pentad/bulanan pada crop monitoring.",
  },
  {
    group: "Crop Monitoring",
    name: "ERA5-Land",
    resolution: "0.1 derajat",
    period: "Historis",
    usedFor: "Suhu, kelembaban, evapotranspirasi, dan variabel meteorologi pendukung.",
    method: "Reanalysis ECMWF land-surface, agregasi harian dari model cuaca dan observasi asimilatif.",
    accuracy: "Bukan observasi langsung; bias lokal perlu dipertimbangkan untuk keputusan lapangan.",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/ECMWF_ERA5_LAND_DAILY_AGGR",
    paperUrl: "https://doi.org/10.5194/essd-13-4349-2021",
    notes: "Baik untuk indikator regional ketika data stasiun lokal tidak tersedia.",
  },
  {
    group: "Crop Monitoring",
    name: "Open-Meteo Archive",
    resolution: "API titik/grid",
    period: "Historis",
    usedFor: "Fallback cuaca tanpa API key untuk crop monitoring.",
    method: "API agregasi model/reanalysis cuaca historis.",
    accuracy: "Tergantung sumber model yang dipilih Open-Meteo; gunakan sebagai pendukung, bukan validasi lapangan.",
    sourceUrl: "https://open-meteo.com/en/docs/historical-weather-api",
    paperUrl: "https://open-meteo.com/",
    notes: "Opsi praktis untuk demo dan fallback konektivitas.",
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
  const t = useI18nStore((state) => state.t);
  const language = useI18nStore((state) => state.language);
  const c = (id: string, en: string) => (language === "id" ? id : en);
  const setActiveModule = useUiStore((s) => s.setActiveModule);
  const isViewer = useAuthStore((s) => isViewerRole(s.user));
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<StepId>("step1");
  const toggle = (id: StepId) => setOpenId((cur) => (cur === id ? ("" as StepId) : id));
  const [paramTab, setParamTab] = useState<ParamKey>("veg");
  const [datasetSearch, setDatasetSearch] = useState("");
  const datasetQuery = datasetSearch.trim().toLowerCase();
  const filteredDatasetDocs = DATASET_DOCS.filter((dataset) =>
    [
      dataset.group,
      dataset.name,
      dataset.resolution,
      dataset.period,
      dataset.usedFor,
      dataset.method,
      dataset.accuracy,
      dataset.notes,
    ]
      .join(" ")
      .toLowerCase()
      .includes(datasetQuery),
  );
  const openModule = (module: DashboardModule) => {
    setActiveModule(module);
    navigate(getDashboardModulePath(module));
  };

  return (
    <div className="guide-page container-fluid mt-2">
      <div className="guide-hero mb-3">
        <div className="guide-hero-icon">
          <i className="bi bi-journal-text" />
        </div>
        <div className="guide-hero-body">
          <span className="guide-hero-eyebrow">{t("guide.eyebrow")}</span>
          <h1 className="guide-hero-title">{t("guide.title")}</h1>
          <p className="guide-hero-desc">
            {t("guide.description")}
          </p>
          <div className="guide-flow">
            <span className="guide-flow-step">
              <i className="bi bi-geo-alt-fill" /> {t("guide.chooseAoi")}
            </span>
            <i className="bi bi-arrow-right guide-flow-arrow" />
            <span className="guide-flow-step">
              <i className="bi bi-sliders" /> {t("guide.setParameters")}
            </span>
            <i className="bi bi-arrow-right guide-flow-arrow" />
            <span className="guide-flow-step">
              <i className="bi bi-play-fill" /> {t("guide.runAnalysis")}
            </span>
          </div>
        </div>
        <div className="guide-hero-metrics" aria-label={t("guide.summary")}>
          <div>
            <strong>3</strong>
            <span>{t("guide.aoiWays")}</span>
          </div>
          <div>
            <strong>4</strong>
            <span>{t("guide.analysisTypes")}</span>
          </div>
          <div>
            <strong>5</strong>
            <span>{t("guide.practicalParts")}</span>
          </div>
        </div>
      </div>

      <div className="guide-accordion">
        <GuideStep id="step1" num="1" icon="bi-geo-alt-fill" title={t("guide.step.aoi")} openId={openId} onToggle={toggle}>
          <p className="guide-lead">{t("guide.aoiIntro")}</p>
          <div className="guide-method-grid">
            <div className="guide-method-card">
              <h3>
                <i className="bi bi-flag-fill" /> {t("guide.method.adminTitle")}
              </h3>
              <ol>
                <li>
                  {t("guide.method.clickTab")} <strong>&quot;{t("aoi.tab.admin")}&quot;</strong>
                </li>
                <li>
                  {t("guide.method.choose")} <strong>{t("carbon.aoiRegion.province")}</strong> {t("guide.method.fromDropdown")}
                </li>
                <li>
                  {t("guide.method.choose")} <strong>{t("carbon.aoiRegion.city")}</strong> ({t("guide.optional")})
                </li>
                <li>
                  {t("guide.method.choose")} <strong>{t("carbon.aoiRegion.district")}</strong> ({t("guide.optional")})
                </li>
                <li>
                  {t("guide.method.choose")} <strong>{t("carbon.aoiRegion.village")}</strong> ({t("guide.optional")})
                </li>
                <li>
                  {t("guide.method.clickButton")} <strong>&quot;{t("carbon.aoiRegion.loadRegion")}&quot;</strong>
                </li>
              </ol>
              <Note tone="info" title={t("guide.tips")}>
                {c("Anda dapat memilih wilayah hingga tingkat provinsi dengan memilih Gunakan Provinsi Saja, atau memilih tingkat administrasi lain sesuai kebutuhan.", "You can select an area up to the province level using Use Province Only, or choose another administrative level as needed.")}
              </Note>
            </div>

            <div className="guide-method-card">
              <h3>
                <i className="bi bi-geo-alt-fill" /> {t("guide.method.coordinateTitle")}
              </h3>
              <ol>
                <li>
                  {t("guide.method.clickTab")} <strong>&quot;{t("aoi.tab.coordinate")}&quot;</strong>
                </li>
                <li>
                  {t("guide.method.enter")} <strong>{c("Lintang", "Latitude")}</strong> ({t("guide.example")}: -6.9667)
                </li>
                <li>
                  {t("guide.method.enter")} <strong>{c("Bujur", "Longitude")}</strong> ({t("guide.example")}: 110.4167)
                </li>
                <li>
                  {t("guide.method.set")} <strong>{c("Zona penyangga (buffer)", "Buffer")}</strong> ({t("guide.kilometers")}: {c("1–50 km", "1–50 km")})
                </li>
                <li>
                  {t("guide.method.clickButton")} <strong>&quot;{t("carbon.aoiCoord.setAoi")}&quot;</strong>
                </li>
              </ol>
              <Note tone="warn" title={t("guide.note")}>
                {c("Buffer yang terlalu besar dapat memperlambat pemrosesan.", "A large buffer can slow processing.")}</Note>
            </div>

            <div className="guide-method-card">
              <h3>
                <i className="bi bi-pencil-fill" /> {t("guide.method.drawTitle")}
              </h3>
              <ol>
                <li>
                  {t("guide.method.clickTab")} <strong>&quot;{t("aoi.tab.draw")}&quot;</strong>
                </li>
                <li>{t("guide.method.useDrawTools")}</li>
                <li>{t("guide.method.drawArea")}</li>
                <li>
                  {t("guide.method.clickButton")} <strong>&quot;{t("guide.method.useDrawnAoi")}&quot;</strong>
                </li>
              </ol>
              <Note tone="success" title={t("guide.advantage")}>
                {c("Metode ini paling fleksibel untuk area tertentu.", "This method is the most flexible for a specific area.")}</Note>
            </div>
          </div>
        </GuideStep>

        <GuideStep id="step2" num="2" icon="bi-diagram-3-fill" title={t("guide.step.analysis")} openId={openId} onToggle={toggle}>
          <p className="guide-lead">{t("guide.analysisIntro")}</p>
          <div className="guide-analysis-grid">
            <div className="guide-analysis-card">
              <i className="bi bi-tree-fill" />
              <h3>{c("1. Indeks Vegetasi", "1. Vegetation Indices")}</h3>
              <p>{c("Analisis delapan indeks vegetasi: NDVI, NDWI, MNDWI, NDBI, EVI, SAVI, BSI, dan NDMI.", "Analyze eight vegetation indices: NDVI, NDWI, MNDWI, NDBI, EVI, SAVI, BSI, and NDMI.")}</p>
              <strong>{c("Cocok untuk:", "Best for:")}</strong>
              <ul>
                <li>{c("Memantau kesehatan vegetasi", "Monitoring vegetation health")}</li>
                <li>{c("Mendeteksi stres tanaman", "Detecting crop stress")}</li>
                <li>{c("Memantau kandungan air", "Monitoring water content")}</li>
              </ul>
            </div>
            <div className="guide-analysis-card">
              <i className="bi bi-map-fill" />
              <h3>{c("2. Tutupan Lahan", "2. Land Cover")}</h3>
              <p>{c("Klasifikasi tutupan lahan dari tiga dataset: Dynamic World, ESA WorldCover, dan Esri.", "Land cover classification from three datasets: Dynamic World, ESA WorldCover, and Esri.")}</p>
              <strong>{c("Cocok untuk:", "Best for:")}</strong>
              <ul>
                <li>{c("Memetakan penggunaan lahan", "Land-use mapping")}</li>
                <li>{c("Memantau perubahan lahan", "Monitoring land change")}</li>
                <li>{c("Menganalisis habitat", "Habitat analysis")}</li>
              </ul>
            </div>
            <div className="guide-analysis-card">
              <i className="bi bi-graph-up-arrow" />
              <h3>{c("3. Estimasi Stok Karbon", "3. Carbon Stock Estimation")}</h3>
              <p>{c("Estimasi stok karbon menggunakan pembelajaran mesin dan data biomassa.", "Estimate carbon stock using machine learning and biomass data.")}</p>
              <strong>{c("Cocok untuk:", "Best for:")}</strong>
              <ul>
                <li>{c("Menginventarisasi karbon", "Carbon inventory")}</li>
                <li>{c("Melaporkan emisi", "Emissions reporting")}</li>
                <li>{c("Menilai jasa ekosistem", "Ecosystem-service valuation")}</li>
              </ul>
            </div>
            <div className="guide-analysis-card">
              <i className="bi bi-layers-fill" />
              <h3>{c("4. Analisis Gabungan", "4. Combined Analysis")}</h3>
              <p>{c("Menggabungkan semua analisis dalam satu proses (waktu pemrosesan lebih lama).", "Combines all analyses in one process (takes longer).")}</p>
              <strong>{c("Cocok untuk:", "Best for:")}</strong>
              <ul>
                <li>{c("Menyusun laporan komprehensif", "Comprehensive reporting")}</li>
                <li>{c("Melakukan studi multi-aspek", "Multi-aspect studies")}</li>
                <li>{c("Melakukan analisis mendalam", "In-depth analysis")}</li>
              </ul>
            </div>
          </div>
        </GuideStep>

        <GuideStep id="step3" num="3" icon="bi-sliders" title={t("guide.step.parameters")} openId={openId} onToggle={toggle}>
          <Note tone="warn">
            <strong>{c("Setiap jenis analisis memiliki parameter yang berbeda.", "Each analysis type uses different parameters.")}</strong> {c("Pilih tab di bawah untuk melihat parameter tiap analisis:", "Select a tab below to view parameters for each analysis:")}</Note>

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
                <i className={`bi ${p.icon}`} /> {t(p.labelKey)}
              </button>
            ))}
          </div>

          {paramTab === "veg" && (
            <div className="guide-table-wrap">
              <table className="guide-table">
                <thead>
                  <tr>
                    <th>{c("Parameter", "Parameter")}</th>
                    <th>{c("Deskripsi", "Description")}</th>
                    <th>{c("Rekomendasi", "Recommendation")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>{c("Tahun", "Year")}</strong>
                    </td>
                    <td>{c("Tahun citra Sentinel-2", "Sentinel-2 imagery year")}</td>
                    <td>{c("2022?2025 untuk data terbaru", "2022?2025 for recent data")}</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>{c("Rentang Bulan", "Month Range")}</strong>
                    </td>
                    <td>{c("Rentang bulan analisis", "Analysis month range")}</td>
                    <td>{c("3?4 bulan untuk komposit yang stabil", "3?4 months for a stable composite")}</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>{c("Ambang Awan", "Cloud Threshold")}</strong>
                    </td>
                    <td>{c("Persentase awan maksimum", "Maximum cloud percentage")}</td>
                    <td>{c("20?40% untuk wilayah tropis", "20?40% for tropical regions")}</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>{c("Pilihan Indeks", "Index Selection")}</strong>
                    </td>
                    <td>{c("Pilih indeks yang diperlukan", "Select the required indices")}</td>
                    <td>{c("NDVI wajib; tambahkan indeks lain sesuai kebutuhan.", "NDVI is required; add other indices as needed.")}</td>
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
                    <th>{c("Parameter", "Parameter")}</th>
                    <th>{c("Deskripsi", "Description")}</th>
                    <th>{c("Rekomendasi", "Recommendation")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>{c("Tahun", "Year")}</strong>
                    </td>
                    <td>{c("Tahun dataset", "Dataset year")}</td>
                    <td>{c("2021?2023 untuk data terkini", "2021?2023 for recent data")}</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>{c("Dataset", "Datasets")}</strong>
                    </td>
                    <td>{c("Pilih satu atau beberapa dataset", "Select one or more datasets")}</td>
                    <td>{c("Dynamic World untuk data mendekati waktu nyata", "Dynamic World for near-real-time data")}</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>{c("Mode DW", "DW Mode")}</strong>
                    </td>
                    <td>{c("Mode untuk Dynamic World", "Mode for Dynamic World")}</td>
                    <td>{c("Mode (paling stabil)", "Mode (most stable)")}</td>
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
                    <th>{c("Parameter", "Parameter")}</th>
                    <th>{c("Deskripsi", "Description")}</th>
                    <th>{c("Rekomendasi", "Recommendation")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>{c("Dataset Referensi", "Reference Dataset")}</strong>
                    </td>
                    <td>{c("Dataset biomassa referensi", "Biomass reference dataset")}</td>
                    <td>{c("ESA CCI (akurasi tertinggi)", "ESA CCI (highest accuracy)")}</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>{c("Model Terlatih", "Pre-trained Model")}</strong>
                    </td>
                    <td>{c("Model machine learning yang digunakan", "Machine-learning model used")}</td>
                    <td>{c("Gunakan model bawaan atau pilih model yang kompatibel dengan GEE.", "Use the default model or choose a GEE-compatible model.")}</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>{c("Tahun", "Year")}</strong>
                    </td>
                    <td>{c("Tahun Sentinel-2", "Sentinel-2 year")}</td>
                    <td>2022-2024</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>{c("Rentang Bulan", "Month Range")}</strong>
                    </td>
                    <td>{c("Rentang bulan", "Month range")}</td>
                    <td>{c("Setahun penuh (Jan?Des) untuk hasil terbaik", "Full year (Jan?Dec) for the best results")}</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>{c("Ambang Awan", "Cloud Threshold")}</strong>
                    </td>
                    <td>{c("Persentase awan maksimum", "Maximum cloud percentage")}</td>
                    <td>{c("10% (lebih ketat untuk karbon)", "10% (stricter for carbon)")}</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>{c("Mode Tampilan", "Display Mode")}</strong>
                    </td>
                    <td>{c("Tile terpotong vs tile penuh", "Clipped vs. full tiles")}</td>
                    <td>{c("Tile terpotong untuk detail, tile penuh untuk kecepatan.", "Clipped tiles for detail; full tiles for speed.")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </GuideStep>

        <GuideStep id="step4" num="4" icon="bi-play-circle-fill" title={t("guide.step.results")} openId={openId} onToggle={toggle}>
          <div className="guide-block">
            <h3>
              <i className="bi bi-play-fill" /> {t("guide.runAnalysisTitle")}
            </h3>
            <div className="guide-run-grid">
              <div className="guide-run-step">
                <span>1</span>
                <strong>{c("Periksa AOI", "Check AOI")}</strong>
                <p>{c("Pastikan area sudah dipilih dan luasnya sesuai untuk jenis analisis.", "Make sure an area is selected and its size is suitable for the analysis.")}</p>
              </div>
              <div className="guide-run-step">
                <span>2</span>
                <strong>{c("Periksa Parameter", "Check Parameters")}</strong>
                <p>{c("Pilih dataset, tahun/periode, ambang awan, model, dan opsi layer.", "Choose the dataset, year or period, cloud threshold, model, and layer options.")}</p>
              </div>
              <div className="guide-run-step">
                <span>3</span>
                <strong>{c("Jalankan", "Run")}</strong>
                <p>{c("Klik tombol", "Click")}{" "}<strong>{c("Jalankan Analisis", "Run Analysis")}</strong> {c("dan tunggu hingga proses selesai.", "and let the process finish.")}</p>
              </div>
              <div className="guide-run-step">
                <span>4</span>
                <strong>{c("Tinjau Hasil", "Review Results")}</strong>
                <p>{c("Tinjau peta, statistik, grafik, dan catatan peringatan sebelum mengekspor hasil.", "Review the map, statistics, charts, and warnings before exporting.")}</p>
              </div>
            </div>
            <Note tone="info" title={c("Waktu Pemrosesan:", "Processing Time:")}>
              {c("AOI kecil dengan cuaca cerah biasanya diproses lebih cepat. AOI besar, tutupan awan tinggi, atau server sibuk dapat memperpanjang waktu pemrosesan.", "Small AOIs with clear skies usually process faster. Large AOIs, heavy cloud cover, or a busy server can increase processing time.")}</Note>
            <div className="guide-timing-grid">
              <div>
                <strong>{c("Vegetasi", "Vegetation")}</strong>
                <span>{c("~30 detik?5 menit", "~30 seconds?5 minutes")}</span>
              </div>
              <div>
                <strong>{c("Tutupan Lahan", "Land Cover")}</strong>
                <span>{c("~1?3 menit per tahun", "~1?3 minutes per year")}</span>
              </div>
              <div>
                <strong>{c("Perubahan Tutupan Lahan", "Land Cover Change")}</strong>
                <span>{c("~1?2 menit/tahun; 5 tahun dapat memerlukan ~5?10 menit", "~1?2 minutes/year; 5 years may take ~5?10 minutes")}</span>
              </div>
              <div>
                <strong>{c("Karbon", "Carbon")}</strong>
                <span>{c("~2?8 menit; AOI besar dapat mendekati batas waktu", "~2?8 minutes; large AOIs may approach the time limit")}</span>
              </div>
              <div>
                <strong>{c("Deret waktu karbon", "Carbon time series")}</strong>
                <span>{c("hingga ~15 menit karena proses diulang setiap tahun", "up to ~15 minutes because processing repeats for each year")}</span>
              </div>
              <div>
                <strong>{c("Gabungan", "Combined")}</strong>
                <span>{c("~5?15 menit, bergantung pada jumlah analisis", "~5?15 minutes, depending on the number of analyses")}</span>
              </div>
            </div>
          </div>

          <div className="guide-block">
            <h3>
              <i className="bi bi-bar-chart-fill" /> {c("Membaca Hasil Analisis", "Reading Analysis Results")}</h3>
            <div className="guide-read-grid">
              <div className="guide-read-card">
                <i className="bi bi-map-fill" />
                <h4>{c("Peta Hasil", "Results Map")}</h4>
                <ul>
                  <li>{c("Tab untuk tiap layer hasil", "A tab for each result layer")}</li>
                  <li>{c("Peta interaktif dengan fungsi zoom dan geser", "Interactive map with zoom and pan")}</li>
                  <li>{c("Legenda menunjukkan skala nilai", "The legend shows the value scale")}</li>
                </ul>
              </div>
              <div className="guide-read-card">
                <i className="bi bi-speedometer2" />
                <h4>{c("Kartu Metrik", "Metric Cards")}</h4>
                <ul>
                  <li>{c("Ringkasan nilai utama", "Summary of key values")}</li>
                  <li>{c("Jumlah citra, luas total, dan nilai rata-rata", "Image count, total area, and mean value")}</li>
                  <li>{c("Lencana warna untuk interpretasi cepat", "Color badges for quick interpretation")}</li>
                </ul>
              </div>
              <div className="guide-read-card">
                <i className="bi bi-table" />
                <h4>{c("Tabel Statistik", "Statistics Table")}</h4>
                <ul>
                  <li>{c("Statistik terperinci per indeks/kelas", "Detailed statistics by index/class")}</li>
                  <li>{c("Minimum, rata-rata, maksimum, simpangan baku", "Minimum, mean, maximum, standard deviation")}</li>
                  <li>{c("Deskripsi tiap metrik", "Description of each metric")}</li>
                </ul>
              </div>
              <div className="guide-read-card">
                <i className="bi bi-bar-chart-fill" />
                <h4>{c("Grafik & Visualisasi", "Charts & Visualization")}</h4>
                <ul>
                  <li>{c("Diagram batang untuk perbandingan", "Bar chart for comparison")}</li>
                  <li>{c("Diagram lingkaran untuk distribusi (tutupan lahan)", "Pie chart for distribution (land cover)")}</li>
                  <li>{c("Grafik garis untuk tren (deret waktu)", "Line chart for trends (time series)")}</li>
                </ul>
              </div>
              <div className="guide-read-card guide-read-card-wide">
                <i className="bi bi-tree-fill" />
                <h4>{c("Hasil Khusus Karbon", "Carbon-specific Results")}</h4>
                <ul>
                  <li>
                    <strong>{c("Densitas Karbon:", "Carbon Density:")}</strong> {c("Rata-rata, simpangan baku, minimum, maksimum (Mg/ha)", "Mean, standard deviation, minimum, maximum (Mg/ha)")}</li>
                  <li>
                    <strong>{c("Stok Total:", "Total Stock:")}</strong> {c("Total karbon (ton), luas (ha)", "Total carbon (tonnes), area (ha)")}</li>
                  <li>
                    <strong>{c("Setara CO₂:", "CO₂ equivalent:")}</strong> {c("Konversi karbon ke ekuivalen CO₂", "Carbon-to-CO₂ conversion")}
                  </li>
                  <li>
                    <strong>{c("Kinerja Model:", "Model performance:")}</strong> {c("Metrik validasi (RMSE, R²)", "Validation metrics (RMSE, R²)")}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="guide-block">
            <h3>
              <i className="bi bi-download" /> {c("Ekspor Hasil", "Export Results")}</h3>
            <p className="guide-lead">{c("Tiga cara mengekspor hasil:", "Three ways to export results:")}</p>
            <div className="guide-export-grid">
              <div className="guide-export-card">
                <i className="bi bi-file-image" />
                <h4>{c("Ekspor GeoTIFF", "Export GeoTIFF")}</h4>
                <p>{c("Untuk perangkat lunak GIS", "For GIS software")}</p>
              </div>
              <div className="guide-export-card">
                <i className="bi bi-file-code" />
                <h4>{c("Unduh Statistik", "Download Statistics")}</h4>
                <p>{c("Format JSON", "JSON format")}</p>
              </div>
              <div className="guide-export-card">
                <i className="bi bi-file-text" />
                <h4>{c("Buat Laporan", "Generate Report")}</h4>
                <p>{c("Format Markdown", "Markdown format")}</p>
              </div>
            </div>
          </div>
        </GuideStep>

        <GuideStep id="stepTips" num="★" icon="bi-lightbulb-fill" title={t("guide.step.tips")} openId={openId} onToggle={toggle}>
          <div className="guide-do-dont-grid">
            <div className="guide-do-card">
              <h3>
                <i className="bi bi-check-circle-fill" /> {c("Yang Dianjurkan", "Recommended Practices")}</h3>
              <ul>
                <li>{c("Mulai dengan area kecil untuk uji coba.", "Start with a small area for testing.")}</li>
                <li>{c("Gunakan ambang awan yang sesuai untuk wilayah tersebut.", "Use a cloud threshold suited to the region.")}</li>
                <li>{c("Pilih periode kering untuk hasil karbon yang lebih baik.", "Choose a dry period for better carbon results.")}</li>
                <li>{c("Simpan atau ekspor hasil sebagai dokumentasi.", "Save or export results for documentation.")}</li>
                <li>{c("Bandingkan beberapa dataset untuk validasi.", "Compare multiple datasets for validation.")}</li>
                <li>{c("Perhatikan mode tampilan (terpotong atau penuh) untuk analisis karbon.", "Consider the display mode (clipped or full) for carbon analysis.")}</li>
              </ul>
            </div>
            <div className="guide-dont-card">
              <h3>
                <i className="bi bi-x-circle-fill" /> {c("Yang Perlu Dihindari", "Avoid These Practices")}</h3>
              <ul>
                <li>{c("Area terlalu besar (&gt;1.000 km²) untuk analisis karbon.", "An area larger than 1,000 km² for carbon analysis.")}</li>
                <li>{c("Ambang awan terlalu rendah untuk wilayah tropis.", "Setting the cloud threshold too low in tropical regions.")}</li>
                <li>{c("Rentang bulan terlalu singkat (<3 bulan).", "A month range shorter than 3 months.")}</li>
                <li>{c("Menjalankan beberapa analisis secara bersamaan.", "Running multiple analyses at the same time.")}</li>
                <li>{c("Menutup browser saat pemrosesan berlangsung.", "Closing the browser while processing.")}</li>
              </ul>
            </div>
          </div>

          <div className="guide-block">
            <h3>
              <i className="bi bi-question-circle-fill" /> {c("Pemecahan Masalah", "Troubleshooting")}</h3>
            <div className="guide-table-wrap">
              <table className="guide-table">
                <thead>
                  <tr>
                    <th>{c("Masalah", "Problem")}</th>
                    <th>{c("Solusi", "Solution")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>{c("Citra tidak ditemukan", "No images found")}</strong>
                    </td>
                    <td>
                      {c("Naikkan ambang awan.", "Increase the cloud threshold.")}<br />
                      {c("Perluas rentang bulan.", "Extend the month range.")}<br />
                      {c("Coba tahun lain.", "Try a different year.")}</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>{c("Pemrosesan melewati batas waktu", "Processing timed out")}</strong>
                    </td>
                    <td>
                      {c("Kurangi luas area.", "Reduce the area size.")}<br />
                      {c("Gunakan mode tile penuh.", "Use full-tile mode.")}<br />
                      {c("Perpendek rentang bulan.", "Shorten the month range.")}</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>{c("Hasil kosong", "No results")}</strong>
                    </td>
                    <td>
                      {c("Pastikan AOI sudah benar.", "Check that the AOI is correct.")}<br />
                      {c("Periksa koneksi internet.", "Check your internet connection.")}<br />
                      {c("Muat ulang halaman lalu coba lagi.", "Refresh the page and try again.")}</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>{c("Akurasi rendah (karbon)", "Low accuracy (carbon)")}</strong>
                    </td>
                    <td>
                      {c("Gunakan dataset ESA CCI.", "Use the ESA CCI dataset.")}<br />
                      {c("Pilih model terlatih.", "Choose a pre-trained model.")}<br />
                      {c("Gunakan rentang waktu yang lebih panjang.", "Use a longer time period.")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="guide-links">
            <h3>
              <i className="bi bi-book" /> {c("Referensi & Pembelajaran", "References & Learning")}</h3>
            <ul>
              <li>
                <strong>{c("Dokumentasi Google Earth Engine:", "Google Earth Engine documentation:")}</strong>{" "}
                <a href="https://developers.google.com/earth-engine" target="_blank" rel="noreferrer">
                  developers.google.com/earth-engine
                </a>
              </li>
              <li>
                <strong>{c("Informasi Sentinel-2:", "Sentinel-2 information:")}</strong>{" "}
                <a href="https://sentinel.esa.int/web/sentinel/missions/sentinel-2" target="_blank" rel="noreferrer">
                  sentinel.esa.int
                </a>
              </li>
              <li>
                <strong>{c("Dynamic World:", "Dynamic World:")}</strong>{" "}
                <a href="https://dynamicworld.app/" target="_blank" rel="noreferrer">
                  dynamicworld.app
                </a>
              </li>
              <li>
                <strong>{c("Metodologi Stok Karbon:", "Carbon Stock Methodology:")}</strong> {c("Pedoman IPCC", "IPCC Guidelines")}</li>
            </ul>
          </div>
        </GuideStep>
      </div>

      {!isViewer && (
        <div className="guide-doc-section">
        <div className="guide-doc-heading">
          <span className="guide-hero-eyebrow">{c("Referensi Teknis", "Technical References")}</span>
          <h2>{c("Dokumentasi Dataset & Model", "Dataset & Model Documentation")}</h2>
          <p>
            {c("Ringkasan sumber data dan model yang digunakan platform. Katalog aktif mengikuti konfigurasi backend; daftar ini menjelaskan asal data, resolusi, dan batasan utama tiap analisis.", "A summary of the data sources and models used by the platform. The active catalogue follows backend configuration; this list explains each analysis source, resolution, and key limitation.")}</p>
        </div>

        <div className="guide-doc-card">
          <div className="guide-doc-toolbar">
            <h3>
              <i className="bi bi-database-fill" /> {c("Dataset", "Dataset")}</h3>
            <label className="guide-doc-search">
              <i className="bi bi-search" />
              <input
                type="search"
                value={datasetSearch}
                onChange={(e) => setDatasetSearch(e.target.value)}
                placeholder={c("Cari dataset, metode, akurasi...", "Search datasets, methods, or accuracy...")}
                aria-label={c("Cari dokumentasi dataset", "Search dataset documentation")}
              />
            </label>
          </div>
          <div className="guide-doc-meta">
            {c("Menampilkan", "Showing")}{" "}<strong>{filteredDatasetDocs.length}</strong> {c("dari", "of")}{" "}<strong>{DATASET_DOCS.length}</strong> {c("dataset.", "datasets.")}</div>
          <div className="guide-table-wrap">
            <table className="guide-table guide-doc-table">
              <thead>
                <tr>
                  <th>{c("Kelompok", "Group")}</th>
                  <th>{c("Dataset", "Dataset")}</th>
                  <th>{c("Resolusi", "Resolution")}</th>
                  <th>{c("Periode", "Period")}</th>
                  <th>{c("Kegunaan", "Used For")}</th>
                  <th>{c("Metode", "Method")}</th>
                  <th>{c("Akurasi / Validasi", "Accuracy / Validation")}</th>
                  <th>{c("Sumber", "Source")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredDatasetDocs.map((dataset) => (
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
                    <td>
                      {dataset.method}
                      <small>{dataset.notes}</small>
                    </td>
                    <td>{dataset.accuracy}</td>
                    <td>
                      <div className="guide-doc-links">
                        {safeHttpUrl(dataset.sourceUrl) && <a href={safeHttpUrl(dataset.sourceUrl)} target="_blank" rel="noopener noreferrer">{c("Dataset", "Dataset")}</a>}
                        {safeHttpUrl(dataset.paperUrl) && <a href={safeHttpUrl(dataset.paperUrl)} target="_blank" rel="noopener noreferrer">{c("Paper/Dokumen", "Paper/Documentation")}</a>}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredDatasetDocs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="guide-empty-cell">
                      {c("Tidak ada dataset yang cocok dengan pencarian.", "No datasets match your search.")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="guide-doc-card">
          <h3>
            <i className="bi bi-cpu-fill" /> {c("Model & Inferensi", "Model & Inference")}</h3>
          <div className="guide-model-grid">
            {MODEL_DOCS.map((model) => (
              <div className="guide-model-card" key={model.name}>
                <div className="guide-model-top">
                  <i className="bi bi-diagram-2-fill" />
                  <span>{model.deploy}</span>
                </div>
                <h4>{model.name}</h4>
                <p>
                  <strong>{c("Masukan:", "Input:")}</strong> {model.input}
                </p>
                <p>
                  <strong>{c("Keluaran:", "Output:")}</strong> {model.output}
                </p>
                <small>{model.notes}</small>
              </div>
            ))}
          </div>
        </div>
        </div>
      )}

      <div className="guide-quickref">
        <h2 className="guide-section-title">
          <i className="bi bi-bookmark-fill" /> {c("Referensi Cepat", "Quick Reference")}</h2>
        <div className="guide-quickref-grid">
          <div>
            <h4>
              <i className="bi bi-keyboard" /> {c("Pintasan Keyboard", "Keyboard Shortcuts")}</h4>
            <div className="guide-kbd-row">
              <kbd>Ctrl + Z</kbd> <span>{c("Batalkan gambar", "Undo drawing")}</span>
            </div>
            <div className="guide-kbd-row">
              <kbd>Escape</kbd> <span>{c("Batalkan gambar", "Cancel drawing")}</span>
            </div>
            <div className="guide-kbd-row">
              <kbd>+ / -</kbd> <span>{c("Perbesar/perkecil peta", "Zoom in/out map")}</span>
            </div>
          </div>
          <div>
            <h4>
              <i className="bi bi-lightning-fill" /> {c("Aksi Cepat", "Quick Actions")}</h4>
            <div className="guide-quickref-buttons">
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openModule("carbon")}>
                <i className="bi bi-play" /> {c("Buka Analisis", "Go to Analysis")}</button>
              <button type="button" className="btn btn-sm btn-outline-success" onClick={() => openModule("about")}>
                <i className="bi bi-info-circle" /> {c("Tentang Program", "About Program")}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
