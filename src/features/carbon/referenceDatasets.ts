import type { CarbonReferenceDatasetOption } from "./types";

/** Offline fallback for the curated API catalog. Keep retired targets out of new selections. */
export const FALLBACK_CARBON_REFERENCE_DATASETS: CarbonReferenceDatasetOption[] = [
  {
    value: "WCMC",
    label: "WCMC Carbon Density (2010, 300m)",
    year: 2010,
    group: "Above and Belowground Biomass Carbon",
    description:
      "Combined above- and belowground biomass carbon density (300m) from UN WCMC, circa 2010. Not directly comparable with AGB-only products.",
  },
  {
    value: "GEDI",
    label: "GEDI L4B Biomass (2019-2021, 1km)",
    year: 2020,
    group: "Aboveground Biomass Carbon",
    description:
      "NASA GEDI L4B aboveground biomass (1km) from spaceborne lidar. Gridded 2019-2021 observation product; not an annual time series.",
  },
  {
    value: "GEDI_L4A_MONTHLY",
    label: "GEDI L4A Monthly AGBD (2019-2025, 25m)",
    year: 2020,
    yearRange: [2019, 2025],
    yearSelectable: true,
    group: "Aboveground Biomass Carbon",
    description:
      "NASA GEDI L4A valid laser footprints at 25m, quality-filtered and converted to carbon with x0.47. Coverage is sparse.",
  },
  {
    value: "GEDI_L4D",
    label: "GEDI L4D Imputed AGBD (2023, 30m)",
    year: 2023,
    group: "Aboveground Biomass Carbon",
    description:
      "NASA GEDI L4D imputed aboveground biomass density at 30m, converted to carbon with x0.47.",
  },
  {
    value: "SPAWN",
    label: "Spawn & Gibbs AGB Carbon (2010, 300m)",
    group: "Aboveground Biomass Carbon",
    description:
      "Spawn & Gibbs (2020) aboveground biomass carbon (300m). Global coverage, 2010 baseline.",
  },
  {
    value: "ORNL_AGB_BGB",
    label: "ORNL AGB+BGB Carbon (2010, 300m)",
    year: 2010,
    group: "Above and Belowground Biomass Carbon",
    description:
      "ORNL DAAC aboveground + belowground biomass carbon (300m). Includes root biomass. 2010 baseline.",
  },
  {
    value: "ESA_CCI_BIOMASS_V7_COG",
    label: "ESA CCI Biomass v7 (2005-2024, 100m)",
    group: "Aboveground Biomass Carbon",
    year: 2024,
    yearRange: [2005, 2024],
    availableYears: [2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
    referenceOnlyCapable: true,
    description:
      "ESA CCI Biomass v7 forest above-ground biomass from public CEDA GeoTIFF tiles. Missing years 2013-2014 are excluded.",
  },
  {
    value: "CTREES_AGB_100M",
    label: "CTrees Global AGB (2000-2025, 100m)",
    group: "Aboveground Biomass Carbon",
    year: 2025,
    yearRange: [2000, 2025],
    availableYears: Array.from({ length: 26 }, (_, index) => 2025 - index),
    description:
      "Annual global CTrees above-ground biomass density at 100m, loaded from public AOI-windowed COG reads.",
    referenceOnlyCapable: true,
  },
  {
    value: "CHLORIS_AGB_STOCK",
    label: "Chloris AGB Carbon Stock (2003-2019, 4.6km)",
    group: "Aboveground Biomass Carbon",
    year: 2019,
    yearRange: [2003, 2019],
    availableYears: Array.from({ length: 17 }, (_, index) => 2019 - index),
    yearSelectable: true,
    description:
      "Annual Chloris above-ground biomass stock. Licensed 2024/2025 rasters are offered by the live catalog when configured. The public collection covers 2003-2019 at 4.6km.",
    referenceOnlyCapable: true,
  },
  {
    value: "HANSEN_TREECOVER_AGB_PROXY",
    label: "Hansen Treecover AGB Proxy (2000-2023, 30m)",
    year: 2023,
    yearRange: [2000, 2023],
    yearSelectable: true,
    group: "Aboveground Biomass Carbon",
    description:
      "Hansen GFC v1.11 treecover2000 band as an AGB carbon proxy - not a calibrated biomass measurement, correlates via Sentinel-2 spectral features.",
    referenceOnlyCapable: true,
  },
  {
    value: "OPENLANDMAP_SOC_G_KG",
    label: "OpenLandMap SOC (0 cm, g/kg, 250m)",
    year: 2018,
    selectionYear: 2018,
    group: "Soil Carbon",
    description: "Surface SOC concentration: native b0 values x5 give g/kg. 2018 is the release year; this is not a soil-carbon stock.",
    referenceOnlyCapable: true,
  },
  {
    value: "UNEP_WCMC_Biomass_SOC",
    label: "UNEP-WCMC Biomass + Soil Carbon (2010, 300m)",
    year: 2010,
    group: "Total Ecosystem Carbon",
    description: "Above- and belowground biomass carbon plus soil carbon to 1 m; distinct from biomass-only WCMC.",
    referenceOnlyCapable: true,
  },
  {
    value: "SOILGRIDS_SOC_30CM",
    label: "SoilGrids SOC 0-30cm (2017, 250m)",
    group: "Soil Carbon",
    description:
      "ISRIC SoilGrids v2.0 SOC 0-30cm dengan bulk density dan koreksi coarse-fragment (cfvo) untuk stok tanah turunan. Statistik berbasis sampling titik.",
    referenceOnlyCapable: true,
  },
];

// GEDI L4A is the default reference for carbon-stock estimation. Keep this
// value separate from the fallback list so the live API catalog can still
// provide labels, compatibility counts, and admin overrides.
export const DEFAULT_CARBON_REFERENCE_DATASET = "GEDI_L4A_MONTHLY";

/** Old delivery variants/targets remain loadable by the backend for saved work. */
export const RETIRED_CARBON_REFERENCE_DATASETS: Readonly<Record<string, string>> = {
  GEDI_L4B_STACK: "GEDI",
  WCMC_Carbon_ArcGIS: "WCMC",
  UNEP_WCMC_Biomass: "WCMC",
  ESA_CCI: "ESA_CCI_BIOMASS_V7_COG",
  ESA_CCI_SATIO_AGB: "ESA_CCI_BIOMASS_V7_COG",
  ESA_CCI_BIOMASS_COG: "ESA_CCI_BIOMASS_V7_COG",
  GLOBAL_MANGROVE_WATCH_AGB: "CTREES_AGB_100M",
  Simard: "CTREES_AGB_100M",
  OPENLANDMAP_SOC: "OPENLANDMAP_SOC_G_KG",
};

export function availableCarbonReferenceDatasets(datasets: CarbonReferenceDatasetOption[]): CarbonReferenceDatasetOption[] {
  const seen = new Set<string>();
  return datasets.filter((dataset) => {
    if (dataset.deprecated || Object.prototype.hasOwnProperty.call(RETIRED_CARBON_REFERENCE_DATASETS, dataset.value)
      || dataset.isConfigured === false || dataset.requiresConfiguration || seen.has(dataset.value)) return false;
    seen.add(dataset.value);
    return true;
  });
}

export function resolveCarbonReferenceDataset(value: string, datasets: CarbonReferenceDatasetOption[]): string {
  if (datasets.some((dataset) => dataset.value === value)) return value;
  const replacement = RETIRED_CARBON_REFERENCE_DATASETS[value];
  if (replacement && datasets.some((dataset) => dataset.value === replacement)) return replacement;
  return datasets.find((dataset) => dataset.value === DEFAULT_CARBON_REFERENCE_DATASET)?.value ?? datasets[0]?.value ?? value;
}

/**
 * Fallback only - CarbonParamsPanel.tsx prefers each dataset's own
 * `year`/`yearRange` (already returned by `listCarbonDatasets()`) once the
 * live catalog loads. This flat list is what's offered before that resolves
 * or if the request fails, since it's the union of years actually seen
 * across the registry (2010/2017-2020/2019-2023 for various datasets).
 */
export const CARBON_DATASET_YEARS = [2023, 2020, 2019, 2018, 2017, 2010];

export function carbonDatasetYearOptions(meta?: CarbonReferenceDatasetOption): number[] {
  if (meta?.availableYears?.length) {
    return [...meta.availableYears].filter((year) => Number.isFinite(Number(year))).map(Number).sort((a, b) => b - a);
  }
  if (meta?.yearSelectable && Array.isArray(meta.yearRange) && meta.yearRange.length === 2) {
    const [start, end] = meta.yearRange;
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return Array.from({ length: end - start + 1 }, (_, index) => end - index);
    }
  }
  if (meta?.selectionYear != null && Number.isFinite(Number(meta.selectionYear))) {
    return [Number(meta.selectionYear)];
  }
  if (meta?.year != null && Number.isFinite(Number(meta.year))) {
    return [Number(meta.year)];
  }
  return CARBON_DATASET_YEARS;
}
