import { describe, expect, it } from "vitest";
import { datasetReferenceFromParams, datasetReferenceParams, validateDatasetReference } from "./datasetReference";

describe("cloud dataset references", () => {
  it("round-trips compact URL state without a URL", () => {
    const params = datasetReferenceParams({ id: "sentinel2-2026-abc123", format: "cog" });
    expect(params.toString()).toBe("datasetId=sentinel2-2026-abc123&format=cog");
    expect(datasetReferenceFromParams(params)).toEqual({ id: "sentinel2-2026-abc123", format: "cog" });
  });

  it("rejects credentials and non-http sources", () => {
    expect(() => validateDatasetReference({ id: "x", name: "x", format: "cog", url: "javascript:alert(1)", access: "public", sourceType: "remote" })).toThrow("dataset.invalidUrl");
  });
});

