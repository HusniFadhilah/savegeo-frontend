import { describe, expect, it } from "vitest";
import { carbonDatasetYearOptions, FALLBACK_CARBON_REFERENCE_DATASETS } from "./referenceDatasets";

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
