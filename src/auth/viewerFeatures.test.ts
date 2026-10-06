import { describe, expect, it } from "vitest";
import { VIEWER_FEATURE_CODES, getAllowedCarbonModes, getViewerLandingPath } from "./viewerFeatures";

describe("Viewer feature navigation", () => {
  it("routes a Viewer to an enabled module, including non-carbon modules", () => {
    expect(getViewerLandingPath(["app.feature.disaster_mapping"])).toBe("/pemetaan-bencana");
    expect(getViewerLandingPath(["app.feature.crop_monitoring"])).toBe("/crop-monitoring");
  });

  it("shows the explicit no-features destination when every analytic feature is disabled", () => {
    expect(getViewerLandingPath([])).toBe("/no-features");
    expect(getViewerLandingPath(null)).toBe("/no-features");
  });

  it("offers only permitted Carbon modes and hides Combined unless all three are enabled", () => {
    expect(getAllowedCarbonModes(["app.feature.carbon_stock"])).toEqual(["carbon"]);
    expect(getAllowedCarbonModes(["app.feature.land_cover", "app.feature.vegetation_indices"]))
      .toEqual(["landcover", "vegetation"]);
    expect(getAllowedCarbonModes(VIEWER_FEATURE_CODES)).toContain("combined");
  });
});
