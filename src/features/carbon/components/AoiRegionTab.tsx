import { useEffect, useRef, useState } from "react";
import { useI18nStore } from "@/hooks/useI18nStore";
import { useAoiStore } from "@/hooks/useAoiStore";
import {
  fetchProvinces,
  fetchCities,
  fetchDistricts,
  fetchVillages,
  fetchIslands,
  fetchIslandGeometry,
  fetchIndonesiaGeometry,
  fetchRegionGeometry,
  fetchGlobalCountries,
  fetchGlobalBoundaries,
  fetchGlobalBoundaryGeometry,
  type GlobalBoundaryOption,
  type LocationSearchResult,
} from "@/services/analysisService";
import { ApiError } from "@/services/apiClient";
import type { RegionOption } from "@/types/api";
import type { AoiFeature, AoiGeometry } from "@/types/map";
import SearchableSelect from "@/components/ui/SearchableSelect";
import MultiSearchableSelect from "@/components/ui/MultiSearchableSelect";
import AsyncLocationSelect from "@/components/ui/AsyncLocationSelect";
import InfoTip from "@/components/ui/InfoTip";
import { withAoiRegionSelection } from "@/features/carbon/lib/aoiRegionState";

interface Props {
  onApply: (feature: AoiFeature, name: string) => void;
}

type Scope = "admin" | "island" | "indonesia" | "global";
type AdminHierarchy = {
  province?: string;
  regency_or_city?: string;
  district?: string;
  village?: string;
};

function normalizeRegionName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function withoutAdminPrefix(value: string): string {
  return normalizeRegionName(value).replace(
    /^(?:provinsi|prov|kota administrasi|kota|kabupaten|kab|kecamatan|kec|desa|kelurahan|kel)\s+/,
    "",
  );
}

function matchRegionOption(
  options: RegionOption[],
  name: string | undefined,
  level?: string,
): RegionOption | undefined {
  if (!name?.trim()) return undefined;
  const normalized = normalizeRegionName(name);
  const exact = options.find((option) => normalizeRegionName(option.name) === normalized);
  if (exact) return exact;

  const target = withoutAdminPrefix(name);
  const matches = options.filter((option) => withoutAdminPrefix(option.name) === target);
  if (matches.length <= 1) return matches[0];

  const preferredPrefix = level === "city" ? "kota " : level === "regency" ? "kabupaten " : "";
  if (!preferredPrefix) return undefined;
  const preferred = matches.find((option) => normalizeRegionName(option.name).startsWith(preferredPrefix));
  if (preferred) return preferred;
  const otherPrefix = level === "city" ? "kabupaten " : "kota ";
  const untyped = matches.filter((option) => !normalizeRegionName(option.name).startsWith(otherPrefix));
  return untyped.length === 1 ? untyped[0] : undefined;
}

function uniqueOptions(options: RegionOption[]): RegionOption[] {
  return Array.from(new Map(options.map((option) => [option.code, option])).values());
}

/**
 * The backend's /regions/geometry endpoint (and /regions/islands/*, /regions/indonesia)
 * pass through whatever the upstream admin-boundary API returns unmodified (matches
 * the legacy Flask contract byte-for-byte) - in practice that is usually a
 * FeatureCollection with a single Feature, not a bare Geometry as this file previously
 * assumed. Wrapping a FeatureCollection directly as a Feature's `geometry` produces
 * invalid GeoJSON that Earth Engine rejects server-side ("Invalid GeoJSON geometry"),
 * which is why /analyze/carbon was returning 500 for region-picked AOIs. This
 * normalizer accepts Geometry | Feature | FeatureCollection and always returns a
 * single valid Feature<Polygon | MultiPolygon>.
 */
function toFeature(input: GeoJSON.GeoJSON): AoiFeature {
  const tt = useI18nStore.getState().t;
  const asGeometry = (geom: GeoJSON.Geometry | null | undefined): AoiGeometry => {
    if (!geom) throw new Error(tt("carbon.aoiRegion.err.emptyGeometry"));
    if (geom.type === "Polygon" || geom.type === "MultiPolygon") return geom;
    if (geom.type === "GeometryCollection") {
      const polys = geom.geometries.filter(
        (g): g is GeoJSON.Polygon | GeoJSON.MultiPolygon => g.type === "Polygon" || g.type === "MultiPolygon",
      );
      if (!polys.length) throw new Error(tt("carbon.aoiRegion.err.noPolygonInCollection"));
      return mergeToMultiPolygon(polys);
    }
    throw new Error(`${tt("carbon.aoiRegion.err.unsupportedGeometry")}: ${geom.type}`);
  };

  if (input.type === "FeatureCollection") {
    const geometries = input.features.map((f) => f.geometry).filter((g): g is GeoJSON.Geometry => !!g);
    if (!geometries.length) throw new Error(tt("carbon.aoiRegion.err.emptyFeatureCollection"));
    const geometry = geometries.length === 1 ? asGeometry(geometries[0]) : mergeToMultiPolygon(geometries.map(asGeometry));
    return { type: "Feature", geometry, properties: {} };
  }
  if (input.type === "Feature") {
    return { type: "Feature", geometry: asGeometry(input.geometry), properties: input.properties || {} };
  }
  return { type: "Feature", geometry: asGeometry(input as GeoJSON.Geometry), properties: {} };
}

/** Build a rectangular AOI Feature from a Nominatim bbox - the fallback used
 * when a search result has no real boundary polygon (e.g. a plain street
 * address, which Nominatim only ever returns as a point + a small bbox). */
function bboxToFeature(bbox: [number, number, number, number], name: string): AoiFeature {
  const [west, south, east, north] = bbox;
  return {
    type: "Feature",
    properties: { name },
    geometry: {
      type: "Polygon",
      coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
    },
  };
}

/** Flatten multiple Polygon/MultiPolygon geometries into one MultiPolygon. */
function mergeToMultiPolygon(geoms: (GeoJSON.Polygon | GeoJSON.MultiPolygon)[]): GeoJSON.MultiPolygon {
  const coordinates: GeoJSON.Position[][][] = [];
  for (const g of geoms) {
    if (g.type === "Polygon") coordinates.push(g.coordinates);
    else coordinates.push(...g.coordinates);
  }
  return { type: "MultiPolygon", coordinates };
}

/**
 * Indonesia admin region AOI tab: province -> city -> district -> village
 * drill-down, plus island and "seluruh Indonesia" sentinel scopes. Ported
 * from module-carbon.html's #aoiAdmin tab + main.js loadRegion()/
 * loadRegionGeometry(), using the pre-built analysisService region chain
 * (per task instructions) instead of re-implementing raw fetches.
 */
export default function AoiRegionTab({ onApply }: Props) {
  const t = useI18nStore((s) => s.t);
  const activeAoi = useAoiStore((s) => s.aoi);
  const [scope, setScope] = useState<Scope>("admin");

  const [islands, setIslands] = useState<RegionOption[]>([]);
  const [islandCode, setIslandCode] = useState("");

  const [provinces, setProvinces] = useState<RegionOption[]>([]);
  const [provinceCodes, setProvinceCodes] = useState<string[]>([]);
  const [cities, setCities] = useState<RegionOption[]>([]);
  const [cityCodes, setCityCodes] = useState<string[]>([]);
  const [districts, setDistricts] = useState<RegionOption[]>([]);
  const [districtCodes, setDistrictCodes] = useState<string[]>([]);
  const [villages, setVillages] = useState<RegionOption[]>([]);
  const [villageCodes, setVillageCodes] = useState<string[]>([]);
  const provincesRef = useRef(provinces);
  provincesRef.current = provinces;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSyncedHierarchy = useRef("");

  // Optional free-text search inside the "Seluruh Indonesia" scope - if left
  // empty, "Muat Wilayah" still loads the whole-Indonesia geometry unchanged.
  const [searchedLocation, setSearchedLocation] = useState<LocationSearchResult | null>(null);

  const [globalCountries, setGlobalCountries] = useState<GlobalBoundaryOption[]>([]);
  const [globalCountryCode, setGlobalCountryCode] = useState("");
  const [globalAdmin1, setGlobalAdmin1] = useState<GlobalBoundaryOption[]>([]);
  const [globalAdmin1Code, setGlobalAdmin1Code] = useState("");
  const [globalAdmin2, setGlobalAdmin2] = useState<GlobalBoundaryOption[]>([]);
  const [globalAdmin2Code, setGlobalAdmin2Code] = useState("");
  const [globalAdmin3, setGlobalAdmin3] = useState<GlobalBoundaryOption[]>([]);
  const [globalAdmin3Code, setGlobalAdmin3Code] = useState("");
  const [globalAdmin4, setGlobalAdmin4] = useState<GlobalBoundaryOption[]>([]);
  const [globalAdmin4Code, setGlobalAdmin4Code] = useState("");
  const [globalCountriesLoading, setGlobalCountriesLoading] = useState(false);
  const [globalAdmin1Loading, setGlobalAdmin1Loading] = useState(false);
  const [globalAdmin2Loading, setGlobalAdmin2Loading] = useState(false);
  const [globalAdmin3Loading, setGlobalAdmin3Loading] = useState(false);
  const [globalAdmin4Loading, setGlobalAdmin4Loading] = useState(false);

  useEffect(() => {
    fetchProvinces()
      .then((r) => setProvinces(r ?? []))
      .catch(() => setError(t("carbon.aoiRegion.err.provinces")));
    fetchIslands()
      .then((r) => setIslands(r ?? []))
      .catch(() => {
        /* island scope is optional, ignore */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scope !== "global" || globalCountries.length) return;
    let cancelled = false;
    setGlobalCountriesLoading(true);
    setError(null);
    fetchGlobalCountries()
      .then((items) => { if (!cancelled) setGlobalCountries(items); })
      .catch(() => { if (!cancelled) setError(t("carbon.aoiRegion.err.globalCountries")); })
      .finally(() => { if (!cancelled) setGlobalCountriesLoading(false); });
    return () => { cancelled = true; };
  }, [scope, globalCountries.length, t]);

  useEffect(() => {
    if (scope !== "global" || !globalCountryCode) return;
    let cancelled = false;
    setGlobalAdmin1Loading(true);
    setError(null);
    fetchGlobalBoundaries(globalCountryCode, "ADM1")
      .then((items) => { if (!cancelled) setGlobalAdmin1(items); })
      .catch(() => { if (!cancelled) setError(t("carbon.aoiRegion.err.globalLevel")); })
      .finally(() => { if (!cancelled) setGlobalAdmin1Loading(false); });
    return () => { cancelled = true; };
  }, [scope, globalCountryCode, t]);

  useEffect(() => {
    if (scope !== "global" || !globalCountryCode || !globalAdmin1Code) return;
    let cancelled = false;
    setGlobalAdmin2Loading(true);
    setError(null);
    fetchGlobalBoundaries(globalCountryCode, "ADM2", Number(globalAdmin1Code))
      .then((items) => { if (!cancelled) setGlobalAdmin2(items); })
      .catch(() => { if (!cancelled) setError(t("carbon.aoiRegion.err.globalLevel")); })
      .finally(() => { if (!cancelled) setGlobalAdmin2Loading(false); });
    return () => { cancelled = true; };
  }, [scope, globalCountryCode, globalAdmin1Code, t]);

  useEffect(() => {
    if (scope !== "global" || !globalCountryCode || !globalAdmin2Code) return;
    let cancelled = false;
    setGlobalAdmin3Loading(true);
    setError(null);
    fetchGlobalBoundaries(globalCountryCode, "ADM3", Number(globalAdmin2Code))
      .then((items) => { if (!cancelled) setGlobalAdmin3(items); })
      .catch((err) => {
        if (cancelled) return;
        setGlobalAdmin3([]);
        if (!(err instanceof ApiError && err.status === 404)) setError(t("carbon.aoiRegion.err.globalLevel"));
      })
      .finally(() => { if (!cancelled) setGlobalAdmin3Loading(false); });
    return () => { cancelled = true; };
  }, [scope, globalCountryCode, globalAdmin2Code, t]);

  useEffect(() => {
    if (scope !== "global" || !globalCountryCode || !globalAdmin3Code) return;
    let cancelled = false;
    setGlobalAdmin4Loading(true);
    setError(null);
    fetchGlobalBoundaries(globalCountryCode, "ADM4", Number(globalAdmin3Code))
      .then((items) => { if (!cancelled) setGlobalAdmin4(items); })
      .catch((err) => {
        if (cancelled) return;
        setGlobalAdmin4([]);
        if (!(err instanceof ApiError && err.status === 404)) setError(t("carbon.aoiRegion.err.globalLevel"));
      })
      .finally(() => { if (!cancelled) setGlobalAdmin4Loading(false); });
    return () => { cancelled = true; };
  }, [scope, globalCountryCode, globalAdmin3Code, t]);

  // The assistant resolves a real boundary and stores its administrative
  // hierarchy with the shared AOI. Reflect that selection in the same
  // province -> city -> district -> village controls used for manual AOIs.
  const assistantHierarchy = activeAoi?.feature.properties?.assistant_admin_hierarchy as
    | AdminHierarchy
    | undefined;
  const hasAssistantHierarchy = Boolean(
    assistantHierarchy && Object.values(assistantHierarchy).some((value) => typeof value === "string" && value.trim()),
  );
  const assistantHierarchyKey =
    hasAssistantHierarchy && assistantHierarchy
      ? `${activeAoi?.feature.properties?.area_id ?? activeAoi?.name}|${JSON.stringify(assistantHierarchy)}`
      : "";

  useEffect(() => {
    if (
      !hasAssistantHierarchy ||
      !assistantHierarchy ||
      !assistantHierarchyKey ||
      lastSyncedHierarchy.current === assistantHierarchyKey
    ) return;
    lastSyncedHierarchy.current = assistantHierarchyKey;
    let cancelled = false;

    async function syncAdministrativeSelection() {
      setScope("admin");
      setError(null);
      setProvinceCodes([]);
      setCityCodes([]);
      setDistrictCodes([]);
      setVillageCodes([]);
      setCities([]);
      setDistricts([]);
      setVillages([]);
      try {
        const nextProvinces = provincesRef.current.length ? provincesRef.current : await fetchProvinces();
        if (cancelled) return;
        setProvinces(nextProvinces);

        const province = matchRegionOption(nextProvinces, assistantHierarchy?.province);
        if (!province) {
          setProvinceCodes([]);
          setCityCodes([]);
          setDistrictCodes([]);
          setVillageCodes([]);
          setCities([]);
          setDistricts([]);
          setVillages([]);
          setError("AOI sudah dipilih, tetapi provinsinya tidak cocok dengan daftar wilayah administratif.");
          return;
        }

        setProvinceCodes([province.code]);
        const nextCities = uniqueOptions(await fetchCities(province.code));
        if (cancelled) return;
        setCities(nextCities);

        const city = matchRegionOption(
          nextCities,
          assistantHierarchy?.regency_or_city,
          activeAoi?.feature.properties?.level as string | undefined,
        );
        if (!city) {
          setCityCodes([]);
          setDistrictCodes([]);
          setVillageCodes([]);
          setDistricts([]);
          setVillages([]);
          if (assistantHierarchy?.regency_or_city) {
            setError("AOI sudah dipilih, tetapi kota/kabupatennya tidak cocok dengan daftar wilayah administratif.");
          }
          return;
        }

        setCityCodes([city.code]);
        const nextDistricts = uniqueOptions(await fetchDistricts(city.code));
        if (cancelled) return;
        setDistricts(nextDistricts);

        const district = matchRegionOption(nextDistricts, assistantHierarchy?.district);
        if (!district) {
          setDistrictCodes([]);
          setVillageCodes([]);
          setVillages([]);
          if (assistantHierarchy?.district) {
            setError("AOI sudah dipilih, tetapi kecamatannya tidak cocok dengan daftar wilayah administratif.");
          }
          return;
        }

        setDistrictCodes([district.code]);
        const nextVillages = uniqueOptions(await fetchVillages(district.code));
        if (cancelled) return;
        setVillages(nextVillages);

        const village = matchRegionOption(nextVillages, assistantHierarchy?.village);
        setVillageCodes(village ? [village.code] : []);
        if (assistantHierarchy?.village && !village) {
          setError("AOI sudah dipilih, tetapi desa/kelurahannya tidak cocok dengan daftar wilayah administratif.");
        }
      } catch {
        if (!cancelled) {
          setError("AOI sudah dipilih, tetapi daftar wilayah administratif gagal dimuat.");
        }
      }
    }

    void syncAdministrativeSelection();
    return () => {
      cancelled = true;
    };
  }, [activeAoi, assistantHierarchy, assistantHierarchyKey, hasAssistantHierarchy]);

  async function handleProvinceChange(codes: string[]) {
    setProvinceCodes(codes);
    setCityCodes([]);
    setDistrictCodes([]);
    setVillageCodes([]);
    setCities([]);
    setDistricts([]);
    setVillages([]);
    if (!codes.length) return;
    try {
      const results = await Promise.all(codes.map((code) => fetchCities(code)));
      setCities(uniqueOptions(results.flat()));
    } catch {
      setError(t("carbon.aoiRegion.err.cities"));
    }
  }

  async function handleCityChange(codes: string[]) {
    setCityCodes(codes);
    setDistrictCodes([]);
    setVillageCodes([]);
    setDistricts([]);
    setVillages([]);
    if (!codes.length) return;
    try {
      const results = await Promise.all(codes.map((code) => fetchDistricts(code)));
      setDistricts(uniqueOptions(results.flat()));
    } catch {
      setError(t("carbon.aoiRegion.err.districts"));
    }
  }

  async function handleDistrictChange(codes: string[]) {
    setDistrictCodes(codes);
    setVillageCodes([]);
    setVillages([]);
    if (!codes.length) return;
    try {
      const results = await Promise.all(codes.map((code) => fetchVillages(code)));
      setVillages(uniqueOptions(results.flat()));
    } catch {
      setError(t("carbon.aoiRegion.err.villages"));
    }
  }

  async function handleLoad() {
    setError(null);
    setLoading(true);
    try {
      if (scope === "global") {
        if (!globalCountryCode) {
          setError(t("carbon.aoiRegion.err.selectCountry"));
          return;
        }
        const selectedLevel = globalAdmin4Code ? "ADM4" : globalAdmin3Code ? "ADM3" : globalAdmin2Code ? "ADM2" : globalAdmin1Code ? "ADM1" : "ADM0";
        const selectedIndex = Number(globalAdmin4Code || globalAdmin3Code || globalAdmin2Code || globalAdmin1Code || 0);
        const geometry = await fetchGlobalBoundaryGeometry(globalCountryCode, selectedLevel, selectedIndex);
        const country = globalCountries.find((item) => item.code === globalCountryCode);
        const region = selectedLevel === "ADM4"
          ? globalAdmin4.find((item) => item.code === globalAdmin4Code)
          : selectedLevel === "ADM3"
            ? globalAdmin3.find((item) => item.code === globalAdmin3Code)
            : selectedLevel === "ADM2"
              ? globalAdmin2.find((item) => item.code === globalAdmin2Code)
              : selectedLevel === "ADM1"
                ? globalAdmin1.find((item) => item.code === globalAdmin1Code)
                : country;
        const name = [region?.name, selectedLevel !== "ADM0" ? country?.name : undefined].filter(Boolean).join(", ");
        onApply(
          withAoiRegionSelection(toFeature(geometry), {
            scope: "global",
            countryCode: globalCountryCode,
            level: selectedLevel,
            index: selectedIndex,
          }),
          name || country?.name || globalCountryCode,
        );
        return;
      }
      if (scope === "indonesia") {
        if (searchedLocation) {
          const feature = searchedLocation.geojson
            ? toFeature(searchedLocation.geojson)
            : searchedLocation.bbox
              ? bboxToFeature(searchedLocation.bbox, searchedLocation.display_name)
              : null;
          if (!feature) throw new Error(t("carbon.aoiRegion.err.noUsableArea"));
          onApply(feature, searchedLocation.display_name);
          return;
        }
        const geometry = await fetchIndonesiaGeometry();
        if (!geometry) throw new Error(t("carbon.aoiRegion.err.geometryNotFound"));
        onApply(
          withAoiRegionSelection(toFeature(geometry), { scope: "indonesia" }),
          t("carbon.aoiRegion.wholeIndonesia"),
        );
        return;
      }
      if (scope === "island") {
        if (!islandCode) {
          setError(t("carbon.aoiRegion.err.selectIsland"));
          return;
        }
        const label = islands.find((i) => i.code === islandCode)?.name || islandCode;
        const geometry = await fetchIslandGeometry(islandCode);
        if (!geometry) throw new Error(t("carbon.aoiRegion.err.geometryNotFound"));
        onApply(withAoiRegionSelection(toFeature(geometry), { scope: "island", code: islandCode }), label);
        return;
      }

      // admin drill-down: deepest selected level wins
      let endpoint: "province" | "city" | "district" | "village" = "province";
      let codes = provinceCodes;
      let selectedOptions = provinces;
      if (!provinceCodes.length) {
        setError(t("carbon.aoiRegion.err.selectProvince"));
        return;
      }
      if (cityCodes.length) {
        endpoint = "city";
        codes = cityCodes;
        selectedOptions = cities;
      }
      if (districtCodes.length) {
        endpoint = "district";
        codes = districtCodes;
        selectedOptions = districts;
      }
      if (villageCodes.length) {
        endpoint = "village";
        codes = villageCodes;
        selectedOptions = villages;
      }
      const geometries = await Promise.all(codes.map((code) => fetchRegionGeometry(endpoint, code)));
      const features = geometries.filter(Boolean).map(toFeature);
      if (!features.length) throw new Error(t("carbon.aoiRegion.err.geometryNotFound"));
      const feature: AoiFeature = features.length === 1
        ? features[0]
        : { type: "Feature", geometry: mergeToMultiPolygon(features.map((item) => item.geometry)), properties: {} };
      const name = codes
        .map((code) => selectedOptions.find((option) => option.code === code)?.name || code)
        .join(", ");
      onApply(
        withAoiRegionSelection(feature, {
          scope: "admin",
          level: endpoint,
          codes,
          provinceCodes,
          cityCodes,
          districtCodes,
          villageCodes,
        }),
        name,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("carbon.aoiRegion.err.loadRegionFailed"));
    } finally {
      setLoading(false);
    }
  }

  const SCOPES: { key: Scope; label: string }[] = [
    { key: "admin", label: t("carbon.aoiRegion.scope.admin") },
    { key: "island", label: t("carbon.aoiRegion.scope.island") },
    { key: "indonesia", label: t("carbon.aoiRegion.scope.indonesia") },
    { key: "global", label: t("carbon.aoiRegion.scope.global") },
  ];

  const selectedGlobalBoundary = globalAdmin4.find((item) => item.code === globalAdmin4Code)
    || globalAdmin3.find((item) => item.code === globalAdmin3Code)
    || globalAdmin2.find((item) => item.code === globalAdmin2Code)
    || globalAdmin1.find((item) => item.code === globalAdmin1Code)
    || globalCountries.find((item) => item.code === globalCountryCode);

  return (
    <div>
      <div className="segmented-control mb-3">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`segmented-option ${scope === s.key ? "active" : ""}`}
            onClick={() => setScope(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {scope === "admin" && (
        <div className="row">
          <div className="col-md-6 mb-3">
            <label className="form-label">{t("carbon.aoiRegion.province")}</label>
            <MultiSearchableSelect
              value={provinceCodes}
              onChange={handleProvinceChange}
              options={provinces.map((p) => ({ value: p.code, label: p.name }))}
              placeholder={t("carbon.aoiRegion.provincePlaceholder")}
              clearable
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">{t("carbon.aoiRegion.city")}</label>
            <MultiSearchableSelect
              value={cityCodes}
              onChange={handleCityChange}
              options={cities.map((c) => ({ value: c.code, label: c.name }))}
              placeholder={t("carbon.aoiRegion.cityPlaceholder")}
              disabled={!provinceCodes.length}
              clearable
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">{t("carbon.aoiRegion.district")}</label>
            <MultiSearchableSelect
              value={districtCodes}
              onChange={handleDistrictChange}
              options={districts.map((d) => ({ value: d.code, label: d.name }))}
              placeholder={t("carbon.aoiRegion.districtPlaceholder")}
              disabled={!cityCodes.length}
              clearable
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">{t("carbon.aoiRegion.village")}</label>
            <MultiSearchableSelect
              value={villageCodes}
              onChange={setVillageCodes}
              options={villages.map((v) => ({ value: v.code, label: v.name }))}
              placeholder={t("carbon.aoiRegion.villagePlaceholder")}
              disabled={!districtCodes.length}
              clearable
            />
          </div>
        </div>
      )}

      {scope === "island" && (
        <div className="mb-3">
          <label className="form-label">{t("carbon.aoiRegion.island")}</label>
          <SearchableSelect
            value={islandCode}
            onChange={setIslandCode}
            options={islands.map((i) => ({ value: i.code, label: i.name }))}
            placeholder={t("carbon.aoiRegion.islandPlaceholder")}
            clearable
          />
        </div>
      )}

      {scope === "indonesia" && (
        <div className="mb-3">
          <label className="form-label">{t("carbon.aoiRegion.searchLocation")}</label>
          <AsyncLocationSelect
            selectedLabel={searchedLocation?.display_name}
            onSelect={setSearchedLocation}
            onClear={() => setSearchedLocation(null)}
            placeholder={t("carbon.aoiRegion.searchPlaceholder")}
          />
          <small className="text-muted d-block mt-1">
            {searchedLocation
              ? searchedLocation.geojson
                ? t("carbon.aoiRegion.hasRealBoundary")
                : t("carbon.aoiRegion.bboxFallback")
              : t("carbon.aoiRegion.emptySearchHint")}
          </small>
        </div>
      )}

      {scope === "global" && (
        <div className="row">
          <div className="col-md-12 mb-3">
            <label className="form-label">{t("carbon.aoiRegion.country")}</label>
            <SearchableSelect
              value={globalCountryCode}
              onChange={(code) => {
                setGlobalCountryCode(code);
                setGlobalAdmin1Code("");
                setGlobalAdmin2Code("");
                setGlobalAdmin3Code("");
                setGlobalAdmin4Code("");
                setGlobalAdmin1([]);
                setGlobalAdmin2([]);
                setGlobalAdmin3([]);
                setGlobalAdmin4([]);
                setGlobalAdmin1Loading(false);
                setGlobalAdmin2Loading(false);
                setGlobalAdmin3Loading(false);
                setGlobalAdmin4Loading(false);
              }}
              options={globalCountries.map((country) => ({
                value: country.code,
                label: country.name,
                description: country.code,
              }))}
              placeholder={t("carbon.aoiRegion.countryPlaceholder")}
              loading={globalCountriesLoading}
              clearable
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">{t("carbon.aoiRegion.admin1")}</label>
            <SearchableSelect
              value={globalAdmin1Code}
              onChange={(code) => {
                setGlobalAdmin1Code(code);
                setGlobalAdmin2Code("");
                setGlobalAdmin3Code("");
                setGlobalAdmin4Code("");
                setGlobalAdmin2([]);
                setGlobalAdmin3([]);
                setGlobalAdmin4([]);
                setGlobalAdmin2Loading(false);
                setGlobalAdmin3Loading(false);
                setGlobalAdmin4Loading(false);
              }}
              options={globalAdmin1.map((region) => ({ value: region.code, label: region.name }))}
              placeholder={t("carbon.aoiRegion.admin1Placeholder")}
              disabled={!globalCountryCode}
              loading={globalAdmin1Loading}
              clearable
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">{t("carbon.aoiRegion.admin2")}</label>
            <SearchableSelect
              value={globalAdmin2Code}
              onChange={(code) => {
                setGlobalAdmin2Code(code);
                setGlobalAdmin3Code("");
                setGlobalAdmin4Code("");
                setGlobalAdmin3([]);
                setGlobalAdmin4([]);
                setGlobalAdmin3Loading(false);
                setGlobalAdmin4Loading(false);
              }}
              options={globalAdmin2.map((region) => ({ value: region.code, label: region.name }))}
              placeholder={t("carbon.aoiRegion.admin2Placeholder")}
              disabled={!globalAdmin1Code}
              loading={globalAdmin2Loading}
              clearable
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">{t("carbon.aoiRegion.admin3")}</label>
            <SearchableSelect
              value={globalAdmin3Code}
              onChange={(code) => {
                setGlobalAdmin3Code(code);
                setGlobalAdmin4Code("");
                setGlobalAdmin4([]);
                setGlobalAdmin4Loading(false);
              }}
              options={globalAdmin3.map((region) => ({ value: region.code, label: region.name }))}
              placeholder={t("carbon.aoiRegion.admin3Placeholder")}
              disabled={!globalAdmin2Code}
              loading={globalAdmin3Loading}
              clearable
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">{t("carbon.aoiRegion.admin4")}</label>
            <SearchableSelect
              value={globalAdmin4Code}
              onChange={setGlobalAdmin4Code}
              options={globalAdmin4.map((region) => ({ value: region.code, label: region.name }))}
              placeholder={t("carbon.aoiRegion.admin4Placeholder")}
              disabled={!globalAdmin3Code}
              loading={globalAdmin4Loading}
              clearable
            />
          </div>
          <div className="col-12 d-flex justify-content-end mb-2">
            <InfoTip
              label={t("carbon.aoiRegion.globalInfoLabel")}
              align="end"
              content={(
                <div className="small">
                  <p className="mb-1">
                    {t("carbon.aoiRegion.globalAttribution")} {" "}
                    <a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">
                      {t("carbon.aoiRegion.globalAttributionLink")}
                    </a>
                  </p>
                  {selectedGlobalBoundary && (
                    <p className="mb-0">
                      {t("carbon.aoiRegion.globalMetadataSource")} {selectedGlobalBoundary.source || "geoBoundaries"}
                      {selectedGlobalBoundary.year && <> | {t("carbon.aoiRegion.globalMetadataYear")} {selectedGlobalBoundary.year}</>}
                      {selectedGlobalBoundary.license && <> | {t("carbon.aoiRegion.globalMetadataLicense")} {selectedGlobalBoundary.license}</>}
                    </p>
                  )}
                </div>
              )}
            />
          </div>
        </div>
      )}

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <button className="btn btn-success" onClick={handleLoad} disabled={loading}>
        {loading ? (
          <>
            <span className="spinner-border spinner-border-sm me-1" /> {t("carbon.aoiRegion.loading")}
          </>
        ) : (
          <>
            <i className="bi bi-check-lg" /> {t("carbon.aoiRegion.loadRegion")}
          </>
        )}
      </button>
    </div>
  );
}
