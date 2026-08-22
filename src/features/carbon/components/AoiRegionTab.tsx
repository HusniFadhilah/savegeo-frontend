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
  const [provinceCode, setProvinceCode] = useState("");
  const [cities, setCities] = useState<RegionOption[]>([]);
  const [cityCode, setCityCode] = useState("");
  const [districts, setDistricts] = useState<RegionOption[]>([]);
  const [districtCode, setDistrictCode] = useState("");
  const [villages, setVillages] = useState<RegionOption[]>([]);
  const [villageCode, setVillageCode] = useState("");

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

  async function handleProvinceChange(code: string) {
    setProvinceCode(code);
    setCityCode("");
    setDistrictCode("");
    setVillageCode("");
    setCities([]);
    setDistricts([]);
    setVillages([]);
    if (!code) return;
    try {
      const r = await fetchCities(code);
      setCities(r ?? []);
    } catch {
      setError(t("carbon.aoiRegion.err.cities"));
    }
  }

  async function handleCityChange(code: string) {
    setCityCode(code);
    setDistrictCode("");
    setVillageCode("");
    setDistricts([]);
    setVillages([]);
    if (!code) return;
    try {
      const r = await fetchDistricts(code);
      setDistricts(r ?? []);
    } catch {
      setError(t("carbon.aoiRegion.err.districts"));
    }
  }

  async function handleDistrictChange(code: string) {
    setDistrictCode(code);
    setVillageCode("");
    setVillages([]);
    if (!code) return;
    try {
      const r = await fetchVillages(code);
      setVillages(r ?? []);
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
      let code = provinceCode;
      let name = provinces.find((p) => p.code === provinceCode)?.name || "";
      if (!provinceCode) {
        setError(t("carbon.aoiRegion.err.selectProvince"));
        return;
      }
      if (cityCode) {
        endpoint = "city";
        code = cityCode;
        name = cities.find((c) => c.code === cityCode)?.name || name;
      }
      if (districtCode) {
        endpoint = "district";
        code = districtCode;
        name = districts.find((d) => d.code === districtCode)?.name || name;
      }
      if (villageCode) {
        endpoint = "village";
        code = villageCode;
        name = villages.find((v) => v.code === villageCode)?.name || name;
      }
      const geometry = await fetchRegionGeometry(endpoint, code);
      if (!geometry) throw new Error(t("carbon.aoiRegion.err.geometryNotFound"));
      onApply(toFeature(geometry), name);
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
            <SearchableSelect
              value={provinceCode}
              onChange={handleProvinceChange}
              options={provinces.map((p) => ({ value: p.code, label: p.name }))}
              placeholder={t("carbon.aoiRegion.provincePlaceholder")}
              clearable
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">{t("carbon.aoiRegion.city")}</label>
            <SearchableSelect
              value={cityCode}
              onChange={handleCityChange}
              options={cities.map((c) => ({ value: c.code, label: c.name }))}
              placeholder={t("carbon.aoiRegion.cityPlaceholder")}
              disabled={!provinceCode}
              clearable
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">{t("carbon.aoiRegion.district")}</label>
            <SearchableSelect
              value={districtCode}
              onChange={handleDistrictChange}
              options={districts.map((d) => ({ value: d.code, label: d.name }))}
              placeholder={t("carbon.aoiRegion.districtPlaceholder")}
              disabled={!cityCode}
              clearable
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">{t("carbon.aoiRegion.village")}</label>
            <SearchableSelect
              value={villageCode}
              onChange={setVillageCode}
              options={villages.map((v) => ({ value: v.code, label: v.name }))}
              placeholder={t("carbon.aoiRegion.villagePlaceholder")}
              disabled={!districtCode}
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
