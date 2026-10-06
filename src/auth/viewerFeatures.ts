export const VIEWER_FEATURE_CODES = [
  "app.feature.carbon_stock",
  "app.feature.land_cover",
  "app.feature.vegetation_indices",
  "app.feature.land_cover_change",
  "app.feature.satellite_exploration",
  "app.feature.disaster_mapping",
  "app.feature.crop_monitoring",
] as const;

export type ViewerFeatureCode = (typeof VIEWER_FEATURE_CODES)[number];
export type CarbonAnalysisMode = "landcover" | "vegetation" | "carbon" | "combined";

export function getAllowedCarbonModes(features: readonly ViewerFeatureCode[] | null): CarbonAnalysisMode[] {
  if (features === null) return ["landcover", "vegetation", "carbon", "combined"];
  const modes: CarbonAnalysisMode[] = [];
  if (features.includes("app.feature.land_cover")) modes.push("landcover");
  if (features.includes("app.feature.vegetation_indices")) modes.push("vegetation");
  if (features.includes("app.feature.carbon_stock")) modes.push("carbon");
  if (modes.length === 3) modes.push("combined");
  return modes;
}

export function getViewerLandingPath(features: readonly ViewerFeatureCode[] | null): string {
  if (features === null) return "/no-features";
  const enabled = new Set(features);
  if (["app.feature.carbon_stock", "app.feature.land_cover", "app.feature.vegetation_indices"].some((code) => enabled.has(code as ViewerFeatureCode))) {
    return "/carbon-estimation";
  }
  if (enabled.has("app.feature.land_cover_change")) return "/land-cover-change";
  if (enabled.has("app.feature.satellite_exploration")) return "/satellite-imagery";
  if (enabled.has("app.feature.disaster_mapping")) return "/pemetaan-bencana";
  if (enabled.has("app.feature.crop_monitoring")) return "/crop-monitoring";
  return "/no-features";
}
