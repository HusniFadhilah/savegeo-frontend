export interface KalimantanFireMetric {
  province: string;
  highConfidence: number | null;
  mediumConfidence: number | null;
  burnedAreaHa: number | null;
  note?: string;
}

export interface KalimantanFireSource {
  label: string;
  publisher: string;
  date: string;
  url: string;
  summary: string;
}

/**
 * Situation snapshot used by the disaster landing page. These figures are
 * intentionally labelled with their observation window: hotspot detections
 * are not equivalent to fire incidents and should be ground-checked.
 */
export const KALIMANTAN_FIRE_2026 = {
  title: "Karhutla Kalimantan 2026",
  observationWindow: "27 Agustus 2026 (rilis 28 Agustus)",
  boundaryUrl:
    "https://geoservices.big.go.id/gis/rest/services/PTRA/Atlas_250K_PerkembanganWilayahAdministrasi/MapServer/25/query?where=PROVINSI%20in%20(%27KALIMANTAN%20BARAT%27,%27KALIMANTAN%20TENGAH%27,%27KALIMANTAN%20SELATAN%27,%27KALIMANTAN%20TIMUR%27,%27KALIMANTAN%20UTARA%27)&outFields=PROVINSI&returnGeometry=true&outSR=4326&f=geojson",
  boundarySource:
    "https://geoservices.big.go.id/gis/rest/services/PTRA/Atlas_250K_PerkembanganWilayahAdministrasi/MapServer/25",
  provinces: [
    "KALIMANTAN BARAT",
    "KALIMANTAN TENGAH",
    "KALIMANTAN SELATAN",
    "KALIMANTAN TIMUR",
    "KALIMANTAN UTARA",
  ],
  metrics: [
    {
      province: "Kalimantan Barat",
      highConfidence: 128,
      mediumConfidence: 1787,
      burnedAreaHa: 28680.47,
      note: "Snapshot hotspot 27 Agustus; luas tercatat Jan–Jun",
    },
    {
      province: "Kalimantan Tengah",
      highConfidence: 280,
      mediumConfidence: 4358,
      burnedAreaHa: null,
      note: "Snapshot hotspot 27 Agustus",
    },
    {
      province: "Kalimantan Selatan",
      highConfidence: 16,
      mediumConfidence: 825,
      burnedAreaHa: 383.07,
      note: "Snapshot hotspot 27 Agustus; luas tercatat Jan–Jun",
    },
    {
      province: "Kalimantan Timur",
      highConfidence: null,
      mediumConfidence: null,
      burnedAreaHa: null,
      note: "Masuk cakupan batas analisis; angka hotspot tidak tersedia pada rilis yang dipakai",
    },
    {
      province: "Kalimantan Utara",
      highConfidence: null,
      mediumConfidence: null,
      burnedAreaHa: null,
      note: "Masuk cakupan batas analisis; angka hotspot tidak tersedia pada rilis yang dipakai",
    },
  ] satisfies KalimantanFireMetric[],
  sources: [
    {
      label: "Operasi terpadu Kalimantan",
      publisher: "Kementerian Kehutanan",
      date: "20 Agustus 2026",
      url: "https://www.kehutanan.go.id/news/pemerintah-perkuat-operasi-terpadu-karhutla-di-kalimantan-tambah-dukungan-udara-dan-pemadaman-darat",
      summary:
        "750 hotspot high confidence terakumulasi pada Kalimantan Barat, Tengah, dan Selatan selama 17–19 Agustus 2026.",
    },
    {
      label: "Pemantauan hotspot meningkat",
      publisher: "Kementerian Kehutanan",
      date: "28 Agustus 2026",
      url: "https://www.kehutanan.go.id/news/hotspot-meningkat-kemenhut-perkuat-operasi-karhutla-dan-pemantauan-dampak-asap",
      summary:
        "Rilis menekankan bahwa hotspot adalah indikasi anomali suhu permukaan, bukan hitungan kejadian kebakaran.",
    },
    {
      label: "Batas administrasi provinsi",
      publisher: "Badan Informasi Geospasial",
      date: "Layer aktif",
      url: "https://geoservices.big.go.id/gis/rest/services/PTRA/Atlas_250K_PerkembanganWilayahAdministrasi/MapServer/25",
      summary:
        "Wilayah Administrasi Indonesia 34 Prov; geometry polygon dalam WGS84/EPSG:4326.",
    },
  ] satisfies KalimantanFireSource[],
} as const;

export const KALIMANTAN_FIRE_TOTAL_HIGH_CONFIDENCE = KALIMANTAN_FIRE_2026.metrics.reduce(
  (total, metric) => total + (metric.highConfidence ?? 0),
  0,
);

export const KALIMANTAN_FIRE_TOTAL_MEDIUM_CONFIDENCE = KALIMANTAN_FIRE_2026.metrics.reduce(
  (total, metric) => total + (metric.mediumConfidence ?? 0),
  0,
);

export const KALIMANTAN_FIRE_KNOWN_BURNED_AREA_HA = KALIMANTAN_FIRE_2026.metrics.reduce(
  (total, metric) => total + (metric.burnedAreaHa ?? 0),
  0,
);
