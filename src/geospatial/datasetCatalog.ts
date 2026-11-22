import { apiClient } from "@/services/apiClient";
import { validateDatasetReference } from "./datasetReference";
import { cacheKey, getCached, setCached } from "./cache";
import type { CloudDatasetReference } from "./types";

export interface DatasetCatalogFilters {
  module?: string;
  format?: CloudDatasetReference["format"];
  dateFrom?: string;
  dateTo?: string;
  bbox?: [number, number, number, number];
  search?: string;
}

function query(filters: DatasetCatalogFilters = {}, page?: number, pageSize?: number) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined) params.set(key, Array.isArray(value) ? value.join(",") : String(value)); });
  if (page !== undefined && pageSize !== undefined) {
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
  }
  return params.toString() ? `?${params}` : "";
}

const DATASET_PAGE_SIZE = 100;
const MAX_DATASET_PAGES = 100;

export async function listCloudDatasets(filters?: DatasetCatalogFilters): Promise<CloudDatasetReference[]> {
  const key = await cacheKey("catalog", "1", JSON.stringify(filters ?? {}));
  const cached = await getCached<CloudDatasetReference[]>(key);
  if (cached) return cached.map(validateDatasetReference);
  const datasets: CloudDatasetReference[] = [];
  let total = Number.POSITIVE_INFINITY;
  for (let page = 1; page <= MAX_DATASET_PAGES && datasets.length < total; page += 1) {
    const result = await apiClient.get<{ datasets: CloudDatasetReference[]; count: number }>(
      `/geospatial/datasets${query(filters, page, DATASET_PAGE_SIZE)}`,
      { auth: "app" },
    );
    const entries = (result.datasets ?? []).map(validateDatasetReference);
    datasets.push(...entries);
    total = Number.isFinite(result.count) ? Math.max(0, result.count) : datasets.length;
    if (entries.length === 0) break;
  }
  if (datasets.length < total) throw new Error("dataset.catalogTooLarge");
  await setCached(key, datasets.filter((dataset) => dataset.access === "public"));
  return datasets;
}

export async function getCloudDataset(id: string): Promise<CloudDatasetReference> {
  const key = await cacheKey(id);
  const cached = await getCached<CloudDatasetReference>(key);
  if (cached) return validateDatasetReference(cached);
  const dataset = validateDatasetReference(await apiClient.get<CloudDatasetReference>(`/geospatial/datasets/${encodeURIComponent(id)}`, { auth: "app" }));
  if (dataset.access === "public") await setCached(key, dataset);
  return dataset;
}

export async function registerCloudDataset(reference: CloudDatasetReference): Promise<CloudDatasetReference> {
  return validateDatasetReference(await apiClient.post<CloudDatasetReference>("/geospatial/datasets/register", validateDatasetReference(reference), { auth: "app" }));
}

export async function deleteCloudDataset(id: string): Promise<void> {
  await apiClient.delete(`/geospatial/datasets/${encodeURIComponent(id)}`, { auth: "app" });
}
