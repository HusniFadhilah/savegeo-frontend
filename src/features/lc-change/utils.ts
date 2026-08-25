import type { LcClassInfo, LcDataset, LcYearResult, TransitionData } from "./types";

export const DATASET_OPTIONS: { value: LcDataset; label: string }[] = [
  { value: "Dynamic_World", label: "Dynamic World (Google, 10m)" },
  {
    value: "GeoSave_Copernicus_DynamicWorld",
    label: "GeoSave Copernicus Sentinel-2 Land Cover (10m)",
  },
  { value: "ESA_WorldCover", label: "ESA WorldCover (10m)" },
  { value: "ESRI_LandCover", label: "ESRI Land Cover (10m)" },
  { value: "MapBiomas_Indonesia", label: "MapBiomas Indonesia LANDY (30m)" },
  { value: "GeoSave_MapBiomas_Indonesia", label: "GeoSave MapBiomas Indonesia LANDY (30m)" },
  { value: "JAXA_FNF4", label: "JAXA PALSAR FNF 4-class (25m)" },
  { value: "JAXA_FNF", label: "JAXA ALOS FNF (25m)" },
];

export const DATASET_NOTES: Record<LcDataset, string> = {
  Dynamic_World: "Near real-time · Data tersedia tiap tahun (2015+)",
  ESA_WorldCover: "Tersedia: 2020, 2021 · Tahun lain → data terdekat",
  ESRI_LandCover: "Tersedia: 2017–2023 · Luar range → batas terdekat",
  MapBiomas_Indonesia: "Indonesia tahunan 2000–2023 · kelas hutan, gambut, sawit, tambang, urban",
  JAXA_FNF4: "Forest/Non-Forest 4 kelas 2017–2020 · relevan untuk monitoring hutan/karbon",
  JAXA_FNF: "Forest/Non-Forest 2007–2018 · sederhana untuk baseline hutan",
};

/** Hardcoded color fallbacks, only used when a class is missing a backend-supplied color. */
const COLOR_MAP: Partial<Record<LcDataset, Record<string, string>>> = {
  Dynamic_World: {
    Water: "#419BDF",
    Trees: "#397D49",
    Grass: "#88B053",
    "Flooded vegetation": "#7A87C6",
    Crops: "#E49635",
    "Shrub & Scrub": "#DFC35A",
    "Built Area": "#C4281B",
    "Bare ground": "#A59B8F",
    "Snow & Ice": "#B39FE1",
  },
  GeoSave_Copernicus_DynamicWorld: {
    Water: "#419BDF",
    Trees: "#397D49",
    Grass: "#88B053",
    "Flooded vegetation": "#7A87C6",
    Crops: "#E49635",
    "Shrub & Scrub": "#DFC35A",
    "Built Area": "#C4281B",
    "Bare ground": "#A59B8F",
    "Snow & Ice": "#B39FE1",
  },
  ESA_WorldCover: {
    Trees: "#006400",
    Shrubland: "#ffbb22",
    Grassland: "#ffff4c",
    Cropland: "#f096ff",
    "Built-up": "#fa0000",
    "Barren/sparse vegetation": "#b4b4b4",
    "Snow and ice": "#f0f0f0",
    "Open water": "#0032c8",
    "Herbaceous wetland": "#0096a0",
    Mangroves: "#00cf75",
    "Moss and lichen": "#fae6a0",
  },
  ESRI_LandCover: {
    Water: "#1A5BAB",
    Trees: "#358221",
    Grass: "#87D19E",
    "Flooded vegetation": "#FFDB5C",
    Crops: "#ED022A",
    "Scrub/Shrub": "#EDE9E4",
    "Built area": "#F2FAFF",
    "Bare ground": "#C8C8C8",
    "Snow/Ice": "#DEE4FF",
    Clouds: "#45C2A5",
    Rangeland: "#B1FF05",
  },
  JAXA_FNF4: {
    "Dense Forest": "#006400",
    "Non-Dense Forest": "#00a000",
    "Non-Forest": "#feff99",
    Water: "#0000ff",
  },
  JAXA_FNF: {
    Forest: "#006400",
    "Non-Forest": "#feff99",
    Water: "#0000ff",
  },
};

/** Indonesian labels for LULC class names, ported from main.js LULC_CLASS_TRANSLATIONS
 *  (scoped to this feature only - src/i18n/translations.ts is shared/off-limits). */
const LULC_CLASS_ID: Record<string, string> = {
  Water: "Air",
  Trees: "Pohon",
  Grass: "Rumput",
  "Flooded vegetation": "Vegetasi Tergenang",
  Crops: "Lahan Pertanian",
  "Shrub & Scrub": "Semak Belukar",
  "Built Area": "Area Terbangun",
  "Bare ground": "Lahan Gundul",
  "Snow & Ice": "Salju & Es",
  "Dense Forest": "Hutan Rapat",
  "Non-Dense Forest": "Hutan Tidak Rapat",
  "Forest Formation": "Formasi Hutan",
  "Peat Swamp Forest": "Hutan Rawa Gambut",
  "Non-Forest Natural Formation": "Formasi Alam Non-Hutan",
  "Other Non-Forest Natural Vegetation": "Vegetasi Alam Non-Hutan Lainnya",
  "Rice Paddy": "Sawah",
  "Oil Palm": "Sawit",
  "Pulpwood Plantation": "Hutan Tanaman Industri",
  "Other Agriculture": "Pertanian Lainnya",
  "Non-Vegetated Area": "Area Non-Vegetasi",
  "Mining Pit": "Tambang",
  "Urban Area": "Area Perkotaan",
  "Other Non-Vegetation": "Non-Vegetasi Lainnya",
  "Water Body": "Badan Air",
  Aquaculture: "Akuakultur/Tambak",
  "River, Lake, Ocean": "Sungai, Danau, Laut",
  "Not Observed / Cloud": "Tidak Teramati / Awan",
  Shrubland: "Semak",
  Shrubs: "Semak",
  Grassland: "Padang Rumput",
  Grasslands: "Padang Rumput",
  Cropland: "Lahan Pertanian",
  "Built-up": "Terbangun",
  "Barren/sparse vegetation": "Lahan Gundul/Vegetasi Jarang",
  "Snow and ice": "Salju dan Es",
  "Open water": "Air Terbuka",
  "Herbaceous wetland": "Lahan Basah",
  Mangroves: "Mangrove",
  "Moss and lichen": "Lumut",
  "Scrub/Shrub": "Semak",
  "Built area": "Area Terbangun",
  "Snow/Ice": "Salju/Es",
  Clouds: "Awan",
  Rangeland: "Padang Penggembalaan",
  Forest: "Hutan",
  "Non-Forest": "Non-Hutan",
};

/** Indonesian class label if known, otherwise the raw backend class name (no i18n dependency). */
export function translateLulcClass(name: string): string {
  return LULC_CLASS_ID[name] || name;
}

export function colorForClass(
  cls: string,
  dataset: LcDataset,
  yearData: Record<number, LcYearResult>,
): string {
  for (const year of Object.keys(yearData)) {
    const c = yearData[Number(year)]?.classes?.[cls]?.color;
    if (c) return c;
  }
  return COLOR_MAP[dataset]?.[cls] || "#aaaaaa";
}

export function hexRgba(hex: string | undefined, alpha: number): string {
  if (!hex || hex.length < 7) return `rgba(170,170,170,${alpha})`;
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  } catch {
    return `rgba(170,170,170,${alpha})`;
  }
}

/**
 * Proportional transition estimate between two years' class-area buckets.
 * Ported from LCChange._computeTransitions (main.js). This is NOT a
 * pixel-level GEE transition matrix - it distributes net losses across net
 * gains proportionally, and marks min(areaA, areaB) as "persistent" per
 * class. The UI must keep the "estimated" disclaimer that the legacy app
 * showed (module-lc-change.html methodology note).
 */
export function computeTransitions(
  classesA: Record<string, LcClassInfo>,
  classesB: Record<string, LcClassInfo>,
): TransitionData {
  const allClasses = [...new Set([...Object.keys(classesA), ...Object.keys(classesB)])].sort();

  const matrix: Record<string, Record<string, number>> = {};
  allClasses.forEach((f) => {
    matrix[f] = {};
    allClasses.forEach((t) => {
      matrix[f][t] = 0;
    });
  });

  allClasses.forEach((cls) => {
    const aA = Number(classesA[cls]?.area || 0);
    const aB = Number(classesB[cls]?.area || 0);
    matrix[cls][cls] = Math.min(aA, aB);
  });

  const gains: Record<string, number> = {};
  const losses: Record<string, number> = {};
  allClasses.forEach((cls) => {
    const diff = Number(classesB[cls]?.area || 0) - Number(classesA[cls]?.area || 0);
    if (diff > 0.01) gains[cls] = diff;
    if (diff < -0.01) losses[cls] = Math.abs(diff);
  });

  const totalGain = Object.values(gains).reduce((s, v) => s + v, 0);

  if (totalGain > 0.01) {
    Object.entries(losses).forEach(([from, lossAmt]) => {
      Object.entries(gains).forEach(([to, gainAmt]) => {
        matrix[from][to] = (lossAmt * gainAmt) / totalGain;
      });
    });
  }

  return { matrix, allClasses, gains, losses };
}

export function fmtHa(v: number): string {
  return v.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function fmtSigned(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(0)} ha`;
}
