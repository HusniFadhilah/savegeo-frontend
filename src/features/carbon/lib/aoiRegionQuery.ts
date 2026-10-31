/** Public links use ordinary scalar parameters, rather than JSON in the query. */
export function readAoiRegionQuery(query: URLSearchParams): string | undefined {
  const legacy = query.get("aoi_region");
  if (legacy) return legacy;
  const scope = query.get("aoi_scope");
  const codes = (key: string) => (query.get(key) || "").split(",").filter(Boolean);
  if (scope === "admin") return JSON.stringify({
    scope, level: query.get("aoi_level"), codes: codes("aoi_codes"),
    provinceCodes: codes("aoi_province_codes"), cityCodes: codes("aoi_city_codes"),
    districtCodes: codes("aoi_district_codes"), villageCodes: codes("aoi_village_codes"),
  });
  if (scope === "indonesia") return JSON.stringify({ scope });
  if (scope === "island") return JSON.stringify({ scope, code: query.get("aoi_island") });
  if (scope === "global") return JSON.stringify({ scope, countryCode: query.get("aoi_country"), level: query.get("aoi_level"), index: Number(query.get("aoi_index")) });
  return undefined;
}

export function writeAoiRegionQuery(query: URLSearchParams, value?: string) {
  if (!value) return;
  try {
    const region = JSON.parse(value);
    const put = (key: string, item: unknown) => {
      const text = Array.isArray(item) ? item.join(",") : String(item ?? "");
      if (text) query.set(key, text);
    };
    if (!["admin", "indonesia", "island", "global"].includes(region.scope)) return;
    put("aoi_scope", region.scope);
    if (region.scope === "admin") {
      put("aoi_level", region.level);
      put("aoi_codes", region.codes);
      put("aoi_province_codes", region.provinceCodes);
      put("aoi_city_codes", region.cityCodes);
      put("aoi_district_codes", region.districtCodes);
      put("aoi_village_codes", region.villageCodes);
    } else if (region.scope === "island") put("aoi_island", region.code);
    else if (region.scope === "global") {
      put("aoi_country", region.countryCode);
      put("aoi_level", region.level);
      put("aoi_index", region.index);
    }
  } catch {
    // Malformed region data cannot produce a restorable link.
  }
}
