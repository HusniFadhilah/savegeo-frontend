import { listCarbonDatasets, listCarbonModels } from "@/features/carbon/api";
import { carbonDatasetYearOptions } from "@/features/carbon/referenceDatasets";
import type {
  CarbonModelListItem,
  CarbonPoolKey,
  CarbonReferenceDatasetOption,
} from "@/features/carbon/types";
import { DEFAULT_CARBON_REFERENCE_DATASET } from "@/features/carbon/referenceDatasets";
import { boundsFromGeoJSON, calculateAreaFromGeoJSON, type AoiPayload } from "./geo";

function carbonFootprint(aoi: AoiPayload) {
  const bounds = "geojson" in aoi ? boundsFromGeoJSON(aoi.geojson) : null;
  const west = bounds?.getWest() ?? ("west" in aoi ? aoi.west : 0);
  const east = bounds?.getEast() ?? ("east" in aoi ? aoi.east : 0);
  const south = bounds?.getSouth() ?? ("south" in aoi ? aoi.south : 0);
  const north = bounds?.getNorth() ?? ("north" in aoi ? aoi.north : 0);
  const width = Math.abs(east - west) * 111.32 * Math.cos((north + south) * Math.PI / 360);
  const height = Math.abs(north - south) * 111.32;
  const area = "geojson" in aoi ? (calculateAreaFromGeoJSON(aoi.geojson) ?? 0) : width * height;
  return { width, height, area };
}

export function simpleCarbonSummaryScale(aoi: AoiPayload): number {
  const { width, height } = carbonFootprint(aoi);
  return Math.max(10, Math.ceil(Math.sqrt(width * height * 1e6 / 250_000)));
}

export function needsNationalCarbonModel(aoi?: AoiPayload): boolean {
  if (!aoi) return false;
  const { width, height, area } = carbonFootprint(aoi);
  // Large regions need a frozen national model rather than fitting a local RF
  // within the AOI's bounding box plus a 20 km calibration buffer.
  return area > 10_000 || (width + 40) * (height + 40) > 80_000;
}

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
  aoi?: AoiPayload,
): Promise<BasicCarbonTarget[]> {
  const [datasets, defaultAgbModels, bgbModels, socModels] = await Promise.all([
    listCarbonDatasets(),
    listCarbonModels(DEFAULT_CARBON_REFERENCE_DATASET),
    listCarbonModels("ORNL_BGB"),
    listCarbonModels("SOILGRIDS_OCS_0_30CM"),
  ]);
  const detritusTargets: BasicCarbonTarget[] = ([['litter', 'TROPICAL_LITTER_REFERENCE'], ['deadwood', 'TROPICAL_DEADWOOD_REFERENCE']] as const).map(([key, datasetKey]) => {
    const dataset = datasets.find((item) => item.value === datasetKey);
    if (!dataset) throw new Error(`Referensi pelatihan ${key} belum tersedia pada backend.`);
    return { key, dataset, datasetYear: 2010, model: null, referenceOnly: false };
  });

  if (needsNationalCarbonModel(aoi)) {
    const nationalAgbModels = await listCarbonModels("SPAWN");
    const primaryTargets = ([['agb', 'SPAWN', 2010, nationalAgbModels], ['bgb', 'ORNL_BGB', 2010, bgbModels], ['soc', 'SOILGRIDS_OCS_0_30CM', 2020, socModels]] as const).map(([key, datasetKey, datasetYear, models]) => {
      const dataset = datasets.find((item) => item.value === datasetKey);
      if (!dataset) throw new Error(`Sumber referensi ${datasetKey} belum tersedia untuk AOI besar.`);
      if (fallbackYear === datasetYear) return { key, dataset, datasetYear, model: null, referenceOnly: true };
      const model = [...models].filter((item) => item.metadata_json?.method === "saved_reference_ensemble"
        && item.metadata_json?.training_domain === "indonesia"
        && item.metadata_json?.gee_deployable).sort(compareRecommendedModels)[0];
      if (!model) throw new Error(`Model estimasi tahunan nasional ${key.toUpperCase()} belum tersedia. Tahun ${fallbackYear} tidak dapat diganti dengan referensi ${datasetYear}.`);
      return { key, dataset, datasetYear, model, referenceOnly: false };
    });
    return [...primaryTargets, ...detritusTargets];
  }

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
  // Prefer an annual model for the selected analysis year. Soil stock
  // integration is a static SoilGrids reference and cannot produce an annual
  // estimate on its own.
  const annualSocModels = socModels.filter((model) => model.metadata_json?.method !== "soil_stock_integration");
  const socModel = [...annualSocModels].sort(compareRecommendedModels)[0]
    ?? socModels.find((model) => model.name === "soc_stock_integration_0_30cm")
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
  for (const target of plan) {
    if (fallbackYear === target.datasetYear) {
      target.model = null;
      target.referenceOnly = true;
    }
  }
  if (plan.length !== 3) {
    throw new Error("Katalog karbon belum menyediakan sumber AGB, BGB, dan SOC yang diperlukan untuk mode Simpel.");
  }
  return [...plan, ...detritusTargets];
}
