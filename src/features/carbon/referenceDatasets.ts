import type { CarbonReferenceDatasetOption } from "./types";

/**
 * Ported from module-carbon.html's `#carbonReferenceDataset` optgroups, with
 * descriptions from main.js's `updateDatasetDescription()` dictionary.
 */
export const CARBON_REFERENCE_DATASETS: CarbonReferenceDatasetOption[] = [
  {
    value: "WCMC",
    label: "WCMC Carbon Density (2010, 300m)",
    group: "Aboveground Biomass Carbon",
    description:
      "Global carbon density map (300m) from UN World Conservation Monitoring Centre. Based on 2010 data.",
  },
  {
    value: "GEDI",
    label: "GEDI L4B Biomass (2019-2023, 1km)",
    group: "Aboveground Biomass Carbon",
    description:
      "NASA GEDI L4B aboveground biomass (1km) from spaceborne lidar. Best for forest areas, 2019-2023.",
  },
  {
    value: "GEDI_L4B_STACK",
    label: "GEDI L4B + Predictor Stack (2019-2023, 1km)",
    group: "Aboveground Biomass Carbon",
    description:
      "GEDI L4B gridded biomass (1km) combined with Sentinel-2 predictor stack. Enhanced spatial coverage.",
  },
  {
    value: "SPAWN",
    label: "Spawn & Gibbs AGB Carbon (2010, 300m)",
    group: "Aboveground Biomass Carbon",
    description:
      "Spawn & Gibbs (2020) aboveground biomass carbon (300m). Pantropical coverage, 2010 baseline.",
  },
  {
    value: "ORNL_AGB_BGB",
    label: "ORNL AGB+BGB Carbon (2010, 300m)",
    group: "Aboveground Biomass Carbon",
    description:
      "ORNL DAAC aboveground + belowground biomass carbon (300m). Includes root biomass. 2010 baseline.",
  },
  {
    value: "ESA_CCI_SATIO_AGB",
    label: "ESA CCI AGB via sat-io (2010-2020, 100m)",
    group: "Aboveground Biomass Carbon",
    description: "ESA CCI AGB via sat-io community asset (100m). 2010-2020 annual maps.",
  },
  {
    value: "OPENLANDMAP_SOC",
    label: "OpenLandMap SOC (g/kg, 250m)",
    group: "Soil Carbon",
    description:
      "OpenLandMap soil organic carbon (250m), unit: g/kg. GEE-deployable linear model available.",
  },
];

export const DEFAULT_CARBON_REFERENCE_DATASET = "WCMC";

/** Dataset years offered for the reference dataset (module-carbon.html #carbonDatasetYear). */
export const CARBON_DATASET_YEARS = [2020, 2019, 2018, 2017, 2010];
