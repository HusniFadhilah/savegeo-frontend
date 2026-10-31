import { getAoiRegionSelection } from "./aoiRegionState";
import type { AoiPayload } from "./geo";

export function carbonJobAoi(aoi: AoiPayload) {
  if (!("geojson" in aoi)) return aoi;
  const region = getAoiRegionSelection(aoi.geojson);
  if (region?.scope !== "admin") return aoi;
  return { region: { level: region.level, codes: region.codes } };
}
