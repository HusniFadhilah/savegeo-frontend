import { useEffect, useState } from "react";
import { useI18nStore } from "@/hooks/useI18nStore";
import {
  fetchProvinces,
  fetchCities,
  fetchDistricts,
  fetchVillages,
  fetchIslands,
  fetchIslandGeometry,
  fetchIndonesiaGeometry,
  fetchRegionGeometry,
  type LocationSearchResult,
} from "@/services/analysisService";
import { ApiError } from "@/services/apiClient";
import type { RegionOption } from "@/types/api";
import type { AoiFeature, AoiGeometry } from "@/types/map";
import SearchableSelect from "@/components/ui/SearchableSelect";
import MultiSearchableSelect from "@/components/ui/MultiSearchableSelect";
import AsyncLocationSelect from "@/components/ui/AsyncLocationSelect";

interface Props {
  onApply: (feature: AoiFeature, name: string) => void;
}

type Scope = "admin" | "island" | "indonesia";

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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optional free-text search inside the "Seluruh Indonesia" scope - if left
  // empty, "Muat Wilayah" still loads the whole-Indonesia geometry unchanged.
  const [searchedLocation, setSearchedLocation] = useState<LocationSearchResult | null>(null);

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
        onApply(toFeature(geometry), t("carbon.aoiRegion.wholeIndonesia"));
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
        onApply(toFeature(geometry), label);
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
      onApply(feature, name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("carbon.aoiRegion.err.loadRegionFailed"));
    } finally {
      setLoading(false);
    }
  }

  function uniqueOptions(options: RegionOption[]): RegionOption[] {
    return Array.from(new Map(options.map((option) => [option.code, option])).values());
  }

  const SCOPES: { key: Scope; label: string }[] = [
    { key: "admin", label: t("carbon.aoiRegion.scope.admin") },
    { key: "island", label: t("carbon.aoiRegion.scope.island") },
    { key: "indonesia", label: t("carbon.aoiRegion.scope.indonesia") },
  ];

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
