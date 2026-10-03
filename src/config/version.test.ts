import { describe, expect, it } from "vitest";
import { buildLabel, getCompatibilityStatus, localFrontendMetadata, shortCommit } from "./version";

describe("release metadata", () => {
  it("does not claim a local build has a workflow number", () => {
    expect(localFrontendMetadata.build_number).toBeNull();
    expect(buildLabel(localFrontendMetadata)).toBe("local");
  });

  it("marks product-version pairs without a backend as unavailable", () => {
    expect(getCompatibilityStatus(localFrontendMetadata, null)).toBe("metadata_unavailable");
  });

  it("compares the product version, not component build numbers", () => {
    expect(getCompatibilityStatus(localFrontendMetadata, { ...localFrontendMetadata, component: "backend" })).toBe("compatible");
    expect(getCompatibilityStatus(localFrontendMetadata, { ...localFrontendMetadata, component: "backend", product_version: "2.0.0" })).toBe("different");
  });

  it("only displays a short commit", () => {
    expect(shortCommit("1234567890abcdef1234567890abcdef12345678")).toBe("1234567");
    expect(shortCommit(null)).toBe("—");
  });
});
