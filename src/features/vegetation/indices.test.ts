import { describe, expect, it } from "vitest";

import { DEFAULT_VEGETATION_INDICES, VEGETATION_INDICES } from "./indices";

describe("vegetation index catalog", () => {
  it("keeps the default active index list in sync with the catalog", () => {
    const activeCodes = VEGETATION_INDICES.filter((index) => index.defaultActive).map((index) => index.code);

    expect(DEFAULT_VEGETATION_INDICES).toEqual(activeCodes);
    expect(DEFAULT_VEGETATION_INDICES).toContain("NDVI");
  });

  it("does not define duplicate index codes", () => {
    const codes = VEGETATION_INDICES.map((index) => index.code);

    expect(new Set(codes).size).toBe(codes.length);
  });
});
