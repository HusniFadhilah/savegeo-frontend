import type { CloudDatasetFormat, CloudDatasetReference } from "./types";

const DATASET_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ALLOWED_FORMATS = new Set<CloudDatasetFormat>(["cog", "geoparquet", "pmtiles"]);

export function validateDatasetReference(reference: CloudDatasetReference): CloudDatasetReference {
  if (!DATASET_ID.test(reference.id)) throw new Error("dataset.invalidId");
  if (!reference.name.trim()) throw new Error("dataset.invalidName");
  if (!ALLOWED_FORMATS.has(reference.format)) throw new Error("dataset.invalidFormat");
  if (reference.url && !/^https?:\/\//i.test(reference.url)) throw new Error("dataset.invalidUrl");
  if (reference.assetUrl && !/^https?:\/\//i.test(reference.assetUrl)) throw new Error("dataset.invalidUrl");
  if (reference.bbox && (reference.bbox.length !== 4 || reference.bbox[0] > reference.bbox[2] || reference.bbox[1] > reference.bbox[3])) {
    throw new Error("dataset.invalidBbox");
  }
  return reference;
}

/** Only compact, shareable state is serialized. URLs and access material never enter the URL. */
export function datasetReferenceParams(reference: Pick<CloudDatasetReference, "id" | "format">): URLSearchParams {
  if (!DATASET_ID.test(reference.id) || !ALLOWED_FORMATS.has(reference.format)) throw new Error("dataset.invalidReference");
  return new URLSearchParams({ datasetId: reference.id, format: reference.format });
}

export function datasetReferenceFromParams(params: URLSearchParams): Pick<CloudDatasetReference, "id" | "format"> | null {
  const id = params.get("datasetId");
  const format = params.get("format") as CloudDatasetFormat | null;
  if (!id || !format || !DATASET_ID.test(id) || !ALLOWED_FORMATS.has(format)) return null;
  return { id, format };
}

