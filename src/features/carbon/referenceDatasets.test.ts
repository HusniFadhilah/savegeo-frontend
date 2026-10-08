import { describe, expect, it } from "vitest";
import { availableCarbonReferenceDatasets, carbonDatasetYearOptions, FALLBACK_CARBON_REFERENCE_DATASETS, resolveCarbonReferenceDataset } from "./referenceDatasets";

describe("carbon reference year choices", () => {
  it("offers only the vintage of a static product", () => {
    expect(carbonDatasetYearOptions({ value: "WCMC", label: "WCMC", group: "carbon", description: "", yearRange: [2010, 2020], selectionYear: 2010, yearSelectable: false })).toEqual([2010]);
  });

  it("does not offer unpublished ESA CCI v7 years", () => {
    const product = FALLBACK_CARBON_REFERENCE_DATASETS.find((item) => item.value === "ESA_CCI_BIOMASS_V7_COG");
    const years = carbonDatasetYearOptions(product);
    expect(years).toContain(2024);
    expect(years).not.toContain(2013);
    expect(years).not.toContain(2014);
  });

  it("keeps Hansen loss-year masks selectable", () => {
    const product = FALLBACK_CARBON_REFERENCE_DATASETS.find((item) => item.value === "HANSEN_TREECOVER_AGB_PROXY");
    const years = carbonDatasetYearOptions(product);
    expect(years[0]).toBe(2023);
    expect(years.at(-1)).toBe(2000);
  });
});

describe("curated carbon references", () => {
  const product = (value: string, extra = {}) => ({ value, label: value, group: "carbon", description: "", ...extra });

  it("removes old-server duplicates and unconfigured choices while keeping reference-only products", () => {
    const products = availableCarbonReferenceDatasets([
      product("GEDI"), product("GEDI_L4B_STACK"), product("WCMC_Carbon_ArcGIS"),
      product("ESA_CCI"), product("ESA_CCI_BIOMASS_V7_COG", { compatibleModelCount: 0 }),
      product("GLOBAL_MANGROVE_WATCH_AGB"), product("ESA_BIOMASS_2026", { isConfigured: false }),
      product("retired_other", { deprecated: true }), product("GEDI"),
    ]);
    expect(products.map((item) => item.value)).toEqual(["GEDI", "ESA_CCI_BIOMASS_V7_COG"]);
  });

  it("migrates saved choices to their intended replacement", () => {
    const products = availableCarbonReferenceDatasets(FALLBACK_CARBON_REFERENCE_DATASETS);
    expect(resolveCarbonReferenceDataset("GEDI_L4B_STACK", products)).toBe("GEDI");
    expect(resolveCarbonReferenceDataset("WCMC_Carbon_ArcGIS", products)).toBe("WCMC");
    expect(resolveCarbonReferenceDataset("ESA_CCI_BIOMASS_COG", products)).toBe("ESA_CCI_BIOMASS_V7_COG");
    expect(resolveCarbonReferenceDataset("OPENLANDMAP_SOC", products)).toBe("OPENLANDMAP_SOC_G_KG");
  });

  it("keeps the offline fallback curated and offers published GEDI years", () => {
    expect(availableCarbonReferenceDatasets(FALLBACK_CARBON_REFERENCE_DATASETS)).toEqual(FALLBACK_CARBON_REFERENCE_DATASETS);
    expect(carbonDatasetYearOptions(FALLBACK_CARBON_REFERENCE_DATASETS.find((item) => item.value === "GEDI_L4A_MONTHLY"))).toContain(2025);
  });
});
