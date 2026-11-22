/** Whole days elapsed since `plantingDate` (YYYY-MM-DD), or null if unset/invalid. */
export function daysSincePlanting(plantingDate: string | null | undefined): number | null {
  if (!plantingDate) return null;
  const planted = new Date(plantingDate);
  if (Number.isNaN(planted.getTime())) return null;
  const diffMs = Date.now() - planted.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

interface StatusStyle {
  label: string;
  color: string;
  className: string;
  emoji: string;
}

/** Health label (sub-analysis A) -> Indonesian label/color, same convention
 * as VegStatsTable's cloud-free-% badge (text-success/warning/danger). */
export const HEALTH_LABEL_STYLE: Record<string, StatusStyle> = {
  Good: { label: "Baik", color: "#2e7d32", className: "text-success", emoji: "🟢" },
  Moderate: { label: "Sedang", color: "#f9a825", className: "text-warning", emoji: "🟡" },
  Poor: { label: "Buruk", color: "#c62828", className: "text-danger", emoji: "🔴" },
};

/** Anomaly category (sub-analysis C). */
export const ANOMALY_CATEGORY_STYLE: Record<string, StatusStyle> = {
  Normal: { label: "Normal", color: "#2e7d32", className: "text-success", emoji: "🟢" },
  Watch: { label: "Waspada", color: "#9e9d24", className: "text-warning", emoji: "🟡" },
  Moderate: { label: "Sedang", color: "#f9a825", className: "text-warning", emoji: "🟠" },
  High: { label: "Tinggi", color: "#ef6c00", className: "text-danger", emoji: "🟠" },
  Critical: { label: "Kritis", color: "#c62828", className: "text-danger", emoji: "🔴" },
  Unknown: { label: "Tidak diketahui", color: "#757575", className: "text-muted", emoji: "⚪" },
};

/** Flood severity (sub-analysis G). */
export const FLOOD_SEVERITY_STYLE: Record<string, StatusStyle> = {
  Low: { label: "Rendah", color: "#2e7d32", className: "text-success", emoji: "🟢" },
  Moderate: { label: "Sedang", color: "#f9a825", className: "text-warning", emoji: "🟡" },
  High: { label: "Tinggi", color: "#ef6c00", className: "text-danger", emoji: "🟠" },
  Critical: { label: "Kritis", color: "#c62828", className: "text-danger", emoji: "🔴" },
  Unknown: { label: "Tidak diketahui", color: "#757575", className: "text-muted", emoji: "⚪" },
};

/** Risk level (sub-analysis J). */
export const RISK_LEVEL_STYLE: Record<string, StatusStyle> = {
  Low: { label: "Rendah", color: "#2e7d32", className: "text-success", emoji: "🟢" },
  Moderate: { label: "Sedang", color: "#f9a825", className: "text-warning", emoji: "🟡" },
  High: { label: "Tinggi", color: "#ef6c00", className: "text-danger", emoji: "🟠" },
  Critical: { label: "Kritis", color: "#c62828", className: "text-danger", emoji: "🔴" },
  Unknown: { label: "Tidak diketahui", color: "#757575", className: "text-muted", emoji: "⚪" },
};

/** Water stress label (sub-analysis E). */
export const WATER_STRESS_STYLE: Record<string, StatusStyle> = {
  Low: { label: "Rendah", color: "#2e7d32", className: "text-success", emoji: "🟢" },
  Moderate: { label: "Sedang", color: "#f9a825", className: "text-warning", emoji: "🟡" },
  High: { label: "Tinggi", color: "#c62828", className: "text-danger", emoji: "🔴" },
  Unknown: { label: "Tidak diketahui", color: "#757575", className: "text-muted", emoji: "⚪" },
};

/** Growth stage (sub-analysis D) - `stage_key` -> Indonesian label. Backend
 * (`crop_registry.py`) sends English stage names/keys (Planting/Tillering/
 * Heading/...) since they're mostly agronomy jargon with no single settled
 * Indonesian term across every commodity - this was the untranslated gap:
 * `GrowthStagePanel` was rendering `stage`/`confidence` straight from the
 * API instead of through a label map like every other status field here.
 * Keyed by `stage_key` (stable slug), covers every stage across all 5
 * commodities in the registry (padi/jagung/kedelai/tebu/sawit). */
export const GROWTH_STAGE_LABEL: Record<string, string> = {
  planting: "Tanam",
  establishment: "Pembentukan Awal",
  tillering: "Pembentukan Anakan",
  panicle_initiation: "Inisiasi Malai",
  heading: "Keluar Malai (Heading)",
  grain_filling: "Pengisian Biji",
  maturity: "Pematangan",
  harvest: "Panen",
  vegetative: "Vegetatif",
  tasseling: "Bunga Jantan (Tasseling)",
  silking: "Rambut Tongkol (Silking)",
  flowering: "Berbunga",
  pod_filling: "Pengisian Polong",
  germination: "Perkecambahan",
  grand_growth: "Pertumbuhan Cepat",
  nursery_transplant: "Pembibitan / Tanam Pindah",
  immature: "Belum Produktif",
  productive: "Produktif (Siklus Panen Berulang)",
};

export const CONFIDENCE_LABEL: Record<string, string> = {
  high: "Tinggi",
  medium: "Sedang",
  low: "Rendah",
};

const FALLBACK_STYLE: StatusStyle = {
  label: "-",
  color: "#757575",
  className: "text-muted",
  emoji: "⚪",
};

export function styleFor(map: Record<string, StatusStyle>, key: string | null | undefined): StatusStyle {
  if (!key) return FALLBACK_STYLE;
  return map[key] ?? { ...FALLBACK_STYLE, label: key };
}

export function fmtNum(v: number | null | undefined, digits = 2): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "-";
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  return typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(digits)}%` : "-";
}

type CropTranslator = (key: string, params?: Record<string, string | number>) => string;

const CROP_REASON_KEYS: Record<string, string> = {
  "Tidak ada citra untuk periode ini": "crop.reason.noImagery",
  "Tidak ada citra untuk periode saat ini": "crop.reason.noImageryCurrent",
  "Tidak ada piksel tutupan lahan yang valid.": "crop.reason.noValidLandcover",
  "planting_date belum diisi pada Field ini": "crop.reason.plantingDateMissing",
  "Growth stage tidak tersedia untuk komoditas ini": "crop.reason.growthStageUnavailable",
  "NDVI periode saat ini tidak tersedia": "crop.reason.currentNdviUnavailable",
  "Data historis tidak cukup untuk baseline anomali": "crop.reason.insufficientHistoricalData",
  "flood.pre_date dan flood.post_date diperlukan": "crop.reason.floodDatesRequired",
  "Tahun MODIS gagal dimuat.": "crop.modis.yearsLoadFailed",
  "Luas lahan dan resolusi analisis harus positif.": "crop.reason.positiveAreaAndResolution",
  "period.start_date dan period.end_date wajib diisi untuk mode custom": "crop.reason.customDatesRequired",
  "field_id is required": "crop.reason.fieldIdRequired",
  "Field tidak ditemukan": "crop.reason.fieldNotFound",
  "Pilih bagian analisis tanaman yang valid.": "crop.reason.invalidAnalysisSelection",
  "Tidak bisa menghitung centroid field": "crop.reason.centroidUnavailable",
  "Gagal mengambil data Open-Meteo.": "crop.reason.weatherProviderFailed",
  "Layanan analisis sementara tidak tersedia. Coba lagi.": "crop.reason.serviceUnavailable",
  "Bagian ini belum berhasil diproses; coba ulang atau gunakan area/periode lebih kecil.": "crop.reason.sectionFailed",
  "Pilih atau gambar AOI di Crop Monitoring terlebih dahulu.": "crop.modis.aoiRequired",
  "Pilih minimal satu produk MODIS.": "crop.modis.productRequired",
  "Analisis gagal": "crop.modis.analysisFailed",
};

/** Translate stable backend reason strings at display time without changing API payloads. */
export function localizeCropReason(reason: string | null | undefined, t: CropTranslator): string | null {
  if (!reason) return null;
  const key = CROP_REASON_KEYS[reason.trim()];
  return key ? t(key) : reason;
}

const CROP_LABEL_KEYS: Record<string, string> = {
  Good: "crop.status.good", Baik: "crop.status.good",
  Moderate: "crop.moderate", Sedang: "crop.moderate",
  Poor: "crop.status.poor", Buruk: "crop.status.poor",
  Normal: "crop.status.normal",
  Watch: "crop.status.watch", Waspada: "crop.status.watch",
  High: "crop.high", Tinggi: "crop.high",
  Low: "crop.low", Rendah: "crop.low",
  Critical: "crop.status.critical", Kritis: "crop.status.critical",
  Unknown: "crop.status.unknown", "Tidak diketahui": "crop.status.unknown",
  "Vegetasi rapat / sehat": "crop.class.denseVegetation",
  "Vegetasi sedang": "crop.class.moderateVegetation",
  "Vegetasi rendah": "crop.class.sparseVegetation",
  "Tanah terbuka / vegetasi sangat jarang": "crop.class.bareOrSparse",
  "Non-vegetasi (air/bangunan/awan)": "crop.class.nonVegetation",
  Water: "crop.landcover.water", Trees: "crop.landcover.trees", Grass: "crop.landcover.grass",
  "Flooded vegetation": "crop.landcover.floodedVegetation", Crops: "crop.landcover.crops",
  "Shrub and scrub": "crop.landcover.shrub", "Built area": "crop.landcover.built",
  "Bare ground": "crop.landcover.bareGround", "Snow and ice": "crop.landcover.snowIce",
  padi: "crop.commodity.rice", Padi: "crop.commodity.rice", jagung: "crop.commodity.maize", Jagung: "crop.commodity.maize",
  kedelai: "crop.commodity.soybean", Kedelai: "crop.commodity.soybean", tebu: "crop.commodity.sugarcane", Tebu: "crop.commodity.sugarcane",
  sawit: "crop.commodity.oilPalm", Sawit: "crop.commodity.oilPalm",
};

/** Translate known status/class names while leaving user-entered and unknown values intact. */
export function localizeCropLabel(value: string | null | undefined, t: CropTranslator): string {
  if (!value) return "-";
  const key = CROP_LABEL_KEYS[value];
  return key ? t(key) : value;
}

const GROWTH_STAGE_KEYS: Record<string, string> = {
  planting: "crop.stage.planting", establishment: "crop.stage.establishment", tillering: "crop.stage.tillering",
  panicle_initiation: "crop.stage.panicleInitiation", heading: "crop.stage.heading", grain_filling: "crop.stage.grainFilling",
  maturity: "crop.stage.maturity", harvest: "crop.stage.harvest", vegetative: "crop.stage.vegetative",
  tasseling: "crop.stage.tasseling", silking: "crop.stage.silking", flowering: "crop.stage.flowering",
  pod_filling: "crop.stage.podFilling", germination: "crop.stage.germination", grand_growth: "crop.stage.grandGrowth",
  nursery_transplant: "crop.stage.nurseryTransplant", immature: "crop.stage.immature", productive: "crop.stage.productive",
};

const CROP_SUB_ANALYSIS_KEYS: Record<string, string> = {
  landcover: "crop.sub.landcover", health: "crop.sub.health", timeseries: "crop.sub.timeseries",
  anomaly: "crop.sub.anomaly", growth_stage: "crop.sub.growthStage", water_moisture: "crop.sub.moisture",
  weather: "crop.sub.weather", flood: "crop.sub.flood", productivity_zones: "crop.sub.productivity",
  historical_comparison: "crop.sub.historical", risk_score: "crop.sub.risk",
};

export function localizeCropSubAnalysis(value: string, t: CropTranslator): string {
  const key = CROP_SUB_ANALYSIS_KEYS[value];
  return key ? t(key) : value;
}

export function localizeGrowthStage(stageKey: string | null | undefined, fallback: string, t: CropTranslator): string {
  const key = stageKey ? GROWTH_STAGE_KEYS[stageKey] : undefined;
  return key ? t(key) : localizeCropLabel(fallback, t);
}

/** Translate known Indonesian service messages that include runtime values. */
export function localizeCropMessage(message: string | null | undefined, t: CropTranslator): string | null {
  if (!message) return null;
  const dryDays = message.match(/^(\d+) hari kering \(curah hujan <1mm\) dalam periode monitoring - risiko kekeringan\.$/);
  if (dryDays) return t("crop.weather.warningDryDays", { days: Number(dryDays[1]) });
  const heat = message.match(/^Suhu maksimum rata-rata ([\d.,-]+)°C - potensi heat stress\.$/);
  if (heat) return t("crop.weather.warningHeat", { temperature: heat[1] });
  const narrative = message.match(/^NDVI musim (\d{4}) berada sekitar ([\d.,-]+)% di (atas|bawah) musim (\d{4}) pada periode pemantauan yang sama\.$/);
  if (narrative) return t("crop.historical.narrative", {
    currentYear: Number(narrative[1]), delta: narrative[2], direction: t(narrative[3] === "atas" ? "crop.historical.above" : "crop.historical.below"), previousYear: Number(narrative[4]),
  });
  const key = CROP_REASON_KEYS[message.trim()];
  if (key) return t(key);
  if (message === "Data historis (CHIRPS) tidak cukup untuk baseline rainfall_mm_historical_normal") return t("crop.weather.historicalRainfallUnavailable");
  if (message === "Kelembapan (humidity) tidak tersedia dari Open-Meteo archive API daily aggregates.") return t("crop.weather.humidityUnavailable");
  return localizeCropReason(message, t);
}
