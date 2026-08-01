export interface VegetationIndexMeta {
  code: string;
  label: string;
  description: string;
  defaultActive: boolean;
}

/**
 * The 8-index catalog from module-carbon.html's `#indicesContainer` badges.
 * Descriptions are standard remote-sensing index definitions (not sourced
 * from main.js, which only carries the short codes) so users understand
 * what each toggle computes.
 */
export const VEGETATION_INDICES: VegetationIndexMeta[] = [
  { code: "NDVI", label: "NDVI", description: "Normalized Difference Vegetation Index - vegetation density/health.", defaultActive: true },
  { code: "NDWI", label: "NDWI", description: "Normalized Difference Water Index - surface water content.", defaultActive: true },
  { code: "MNDWI", label: "MNDWI", description: "Modified NDWI - open water bodies, less affected by built-up noise.", defaultActive: true },
  { code: "NDBI", label: "NDBI", description: "Normalized Difference Built-up Index - built-up/urban areas.", defaultActive: true },
  { code: "EVI", label: "EVI", description: "Enhanced Vegetation Index - canopy structure, corrects for atmosphere/soil.", defaultActive: false },
  { code: "SAVI", label: "SAVI", description: "Soil Adjusted Vegetation Index - vegetation in sparsely vegetated areas.", defaultActive: false },
  { code: "BSI", label: "BSI", description: "Bare Soil Index - exposed/bare soil detection.", defaultActive: false },
  { code: "NDMI", label: "NDMI", description: "Normalized Difference Moisture Index - vegetation water/moisture content.", defaultActive: false },
];

export const DEFAULT_VEGETATION_INDICES = VEGETATION_INDICES.filter((i) => i.defaultActive).map(
  (i) => i.code,
);
