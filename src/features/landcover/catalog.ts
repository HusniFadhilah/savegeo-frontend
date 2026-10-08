import type { LandCoverDatasetOption } from "./types";

const ALIASES: Record<string, string> = {
  GeoSave_Copernicus_DynamicWorld: "Dynamic_World",
  GeoSave_MapBiomas_Indonesia: "MapBiomas_Indonesia",
  ESRI_LULC_LivingAtlas: "ESRI_LandCover",
};

export function canonicalLandCoverKey(key: string): string {
  return ALIASES[key] ?? key;
}

export function canonicalLandCoverKeys(keys: string[]): string[] {
  return [...new Set(keys.map(canonicalLandCoverKey))];
}

export const PRIMARY_LULC_DATASETS: LandCoverDatasetOption[] = [
  { key: "MapBiomas_Indonesia", name: "MapBiomas Indonesia Collection 4.1", resolution: "30m", recommended: true, supports_transition: true },
  { key: "Dynamic_World", name: "Dynamic World", resolution: "10m", recommended: true, supports_transition: true },
  { key: "ESRI_LandCover", name: "Esri / Impact Observatory Annual LULC", resolution: "10m", recommended: true, supports_transition: true },
  { key: "GLC_FCS30D", name: "GLC_FCS30D", resolution: "30m", recommended: true, supports_transition: true },
  { key: "ESA_WorldCover", name: "ESA WorldCover (reference)", resolution: "10m", recommended: true, supports_transition: false },
];

export function isPrimaryLandCover(source: LandCoverDatasetOption): boolean {
  return source.recommended ?? PRIMARY_LULC_DATASETS.some((item) => item.key === source.key);
}

export function landCoverChoices(sources: LandCoverDatasetOption[], advanced = false, change = false): LandCoverDatasetOption[] {
  const unique = new Map<string, LandCoverDatasetOption>();
  for (const source of sources) {
    if (source.alias_of || canonicalLandCoverKey(source.key) !== source.key || source.deprecated || source.available === false) continue;
    if (!advanced && !isPrimaryLandCover(source)) continue;
    if (change && (source.supports_transition === false || source.key === "ESA_WorldCover")) continue;
    unique.set(source.key, source);
  }
  return [...unique.values()].sort((a, b) => Number(isPrimaryLandCover(b)) - Number(isPrimaryLandCover(a)));
}
