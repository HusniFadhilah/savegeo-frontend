import { listCarbonDatasets, listCarbonModels } from "@/features/carbon/api";
import { carbonDatasetYearOptions } from "@/features/carbon/referenceDatasets";
import type {
  CarbonModelListItem,
  CarbonPoolKey,
  CarbonReferenceDatasetOption,
} from "@/features/carbon/types";
import { DEFAULT_CARBON_REFERENCE_DATASET } from "@/features/carbon/referenceDatasets";

export interface BasicCarbonTarget {
  key: CarbonPoolKey;
  dataset: CarbonReferenceDatasetOption;
  datasetYear: number;
  model: CarbonModelListItem | null;
  referenceOnly: boolean;
}

function modelScore(model: CarbonModelListItem): number {
  return model.metrics?.cv_metrics?.r2_mean
    ?? model.metrics?.r2_mean
    ?? model.metadata_json?.cv_metrics?.r2_mean
    ?? Number.NEGATIVE_INFINITY;
}

function compareRecommendedModels(a: CarbonModelListItem, b: CarbonModelListItem): number {
  const deployable = Number(Boolean(b.metadata_json?.gee_deployable)) - Number(Boolean(a.metadata_json?.gee_deployable));
  if (deployable) return deployable;
  const established = Number(Boolean(a.metadata_json?.preliminary)) - Number(Boolean(b.metadata_json?.preliminary));
  if (established) return established;
  const scoreA = modelScore(a);
  const scoreB = modelScore(b);
  if (scoreA !== scoreB) return scoreB - scoreA;
  return (a.display_name || a.name).localeCompare(b.display_name || b.name);
}

function preferredYear(dataset: CarbonReferenceDatasetOption, fallback: number): number {
  const years = carbonDatasetYearOptions(dataset);
  if (years.length) return years[0];
  const year = Number(dataset.year);
  return Number.isInteger(year) ? year : fallback;
}

/** Select one compatible method for each carbon pool without exposing model pickers in Basic mode. */
export async function buildBasicCarbonPlan(
  fallbackYear: number,
): Promise<BasicCarbonTarget[]> {
  const [datasets, defaultAgbModels, bgbModels, socModels] = await Promise.all([
    listCarbonDatasets(),
    listCarbonModels(DEFAULT_CARBON_REFERENCE_DATASET),
    listCarbonModels("ORNL_BGB"),
    listCarbonModels("SOILGRIDS_OCS_0_30CM"),
  ]);

  const agbDatasets = datasets.filter((dataset) => dataset.targetPool === "aboveground_biomass_carbon");
  const defaultAgb = agbDatasets.find((dataset) => dataset.value === DEFAULT_CARBON_REFERENCE_DATASET);
  const orderedAgbDatasets = [
    defaultAgb,
    ...agbDatasets.filter((dataset) => dataset !== defaultAgb)
      .sort((a, b) => (b.compatibleModelCount ?? 0) - (a.compatibleModelCount ?? 0)),
  ].filter((dataset): dataset is CarbonReferenceDatasetOption => Boolean(dataset));

  let agbTarget: BasicCarbonTarget | undefined;
  for (const dataset of orderedAgbDatasets) {
    const models = dataset.value === DEFAULT_CARBON_REFERENCE_DATASET
      ? defaultAgbModels
      : await listCarbonModels(dataset.value);
    const model = [...models].sort(compareRecommendedModels)[0];
    if (model) {
      const modelYear = Number(model.metadata_json?.reference_year);
      agbTarget = {
        key: "agb",
        dataset,
        datasetYear: Number.isInteger(modelYear) ? modelYear : preferredYear(dataset, fallbackYear),
        model,
        referenceOnly: false,
      };
      break;
    }
  }

  const bgbDataset = datasets.find((dataset) => dataset.value === "ORNL_BGB");
  const bgbModel = [...bgbModels]
    .filter((model) => model.metadata_json?.method !== "ipcc_root_to_shoot")
    .sort(compareRecommendedModels)[0] ?? null;
  const socDataset = datasets.find((dataset) => dataset.value === "SOILGRIDS_OCS_0_30CM");
  const socModel = socModels.find((model) => model.name === "soc_stock_integration_0_30cm")
    ?? [...socModels].sort(compareRecommendedModels)[0]
    ?? null;

  const plan: BasicCarbonTarget[] = [];
  if (agbTarget) plan.push(agbTarget);
  if (bgbDataset) {
    plan.push({ key: "bgb", dataset: bgbDataset, datasetYear: 2010, model: bgbModel, referenceOnly: !bgbModel });
  }
  if (socDataset) {
    plan.push({ key: "soc", dataset: socDataset, datasetYear: 2020, model: socModel, referenceOnly: !socModel });
  }
  if (plan.length !== 3) {
    throw new Error("Katalog karbon belum menyediakan sumber AGB, BGB, dan SOC yang diperlukan untuk mode Simpel.");
  }
  return plan;
}
