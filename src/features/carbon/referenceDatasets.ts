import type { CarbonReferenceDatasetOption } from "./types";

/**
 * Fallback only - the real list is fetched live via `listCarbonDatasets()`
 * (GET /carbon/datasets) in CarbonParamsPanel.tsx, which also applies
 * admin DB overrides and filters to datasets with an active compatible
 * model. This static copy is what renders if that request fails outright;
 * synced against `savegeo/backend/app/registries/carbon_dataset_registry.py`
 * as of writing (9 datasets with an active model). It will not always match
 * the DB-driven live list exactly - that's expected for a fallback.
 */
export const FALLBACK_CARBON_REFERENCE_DATASETS: CarbonReferenceDatasetOption[] = [
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
    value: "HANSEN_TREECOVER_AGB_PROXY",
    label: "Hansen Treecover AGB Proxy (2000-2023, 30m)",
    group: "Aboveground Biomass Carbon",
    description:
      "Hansen GFC v1.11 treecover2000 band as an AGB carbon proxy - not a calibrated biomass measurement, correlates via Sentinel-2 spectral features.",
  },
  {
    value: "OPENLANDMAP_SOC",
    label: "OpenLandMap SOC (g/kg, 250m)",
    group: "Soil Carbon",
    description:
      "OpenLandMap soil organic carbon (250m), unit: g/kg. GEE-deployable linear model available.",
  },
  {
    value: "SOILGRIDS_SOC_30CM",
    label: "SoilGrids SOC 0-30cm (2017, 250m)",
    group: "Soil Carbon",
    description:
      "ISRIC SoilGrids v2.0 soil organic carbon, 0-30cm depth-weighted mean. Sampled point statistics only, no tile rendering.",
  },
];

export const DEFAULT_CARBON_REFERENCE_DATASET = "WCMC";

/**
 * Fallback only - CarbonParamsPanel.tsx prefers each dataset's own
 * `year`/`yearRange` (already returned by `listCarbonDatasets()`) once the
 * live catalog loads. This flat list is what's offered before that resolves
 * or if the request fails, since it's the union of years actually seen
 * across the registry (2010/2017-2020/2019-2023 for various datasets).
 */
export const CARBON_DATASET_YEARS = [2023, 2020, 2019, 2018, 2017, 2010];
