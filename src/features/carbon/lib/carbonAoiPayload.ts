import { getAoiRegionSelection } from "./aoiRegionState";
import type { AoiBoundsPayload } from "./geo";

export function carbonJobAoi(aoi: { geojson: GeoJSON.GeoJSON } | AoiBoundsPayload) {
  if (!("geojson" in aoi)) return aoi;
  const region = aoi.geojson.type === "Feature" ? getAoiRegionSelection(aoi.geojson) : null;
  if (region?.scope === "indonesia") return { region: { scope: "indonesia" } };
  if (region?.scope === "island") return { region: { scope: "island", code: region.code } };
  if (region?.scope !== "admin") return aoi;
  return { region: { level: region.level, codes: region.codes } };
}
