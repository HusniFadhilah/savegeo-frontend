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

function query(filters: DatasetCatalogFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined) params.set(key, Array.isArray(value) ? value.join(",") : String(value)); });
  return params.toString() ? `?${params}` : "";
}

export async function listCloudDatasets(filters?: DatasetCatalogFilters): Promise<CloudDatasetReference[]> {
  const key = await cacheKey("catalog", "1", JSON.stringify(filters ?? {}));
  const cached = await getCached<CloudDatasetReference[]>(key);
  if (cached) return cached.map(validateDatasetReference);
  const result = await apiClient.get<{ datasets: CloudDatasetReference[] }>(`/geospatial/datasets${query(filters)}`, { auth: "app" });
  const datasets = (result.datasets ?? []).map(validateDatasetReference);
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
