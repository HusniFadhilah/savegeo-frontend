import { datasetReferenceFromParams, datasetReferenceParams } from "./datasetReference";
import type { CloudDatasetFormat } from "./types";

export function readCloudDatasetQuery(search = typeof window === "undefined" ? "" : window.location.search) {
  return datasetReferenceFromParams(new URLSearchParams(search));
}

export function writeCloudDatasetQuery(id: string, format: CloudDatasetFormat, mode: "push" | "replace" = "replace") {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const reference = datasetReferenceParams({ id, format });
  reference.forEach((value, key) => params.set(key, value));
  const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", next);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

