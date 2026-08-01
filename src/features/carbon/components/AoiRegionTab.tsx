import { useEffect, useState } from "react";
import {
  fetchProvinces,
  fetchCities,
  fetchDistricts,
  fetchVillages,
  fetchIslands,
  fetchIslandGeometry,
  fetchIndonesiaGeometry,
  fetchRegionGeometry,
} from "@/services/analysisService";
import { ApiError } from "@/services/apiClient";
import type { RegionOption } from "@/types/api";
import type { AoiFeature } from "@/types/map";
import SearchableSelect from "@/components/ui/SearchableSelect";

interface Props {
  onApply: (feature: AoiFeature, name: string) => void;
}

type Scope = "admin" | "island" | "indonesia";

function toFeature(geometry: GeoJSON.Geometry): AoiFeature {
  return { type: "Feature", geometry: geometry as AoiFeature["geometry"], properties: {} };
}

/**
 * Indonesia admin region AOI tab: province -> city -> district -> village
 * drill-down, plus island and "seluruh Indonesia" sentinel scopes. Ported
 * from module-carbon.html's #aoiAdmin tab + main.js loadRegion()/
 * loadRegionGeometry(), using the pre-built analysisService region chain
 * (per task instructions) instead of re-implementing raw fetches.
 */
export default function AoiRegionTab({ onApply }: Props) {
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

  useEffect(() => {
    fetchProvinces()
      .then((r) => setProvinces(r ?? []))
      .catch(() => setError("Gagal memuat daftar provinsi"));
    fetchIslands()
      .then((r) => setIslands(r ?? []))
      .catch(() => {
        /* island scope is optional, ignore */
      });
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
      setError("Gagal memuat daftar kota/kabupaten");
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
      setError("Gagal memuat daftar kecamatan");
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
      setError("Gagal memuat daftar desa/kelurahan");
    }
  }

  async function handleLoad() {
    setError(null);
    setLoading(true);
    try {
      if (scope === "indonesia") {
        const geometry = await fetchIndonesiaGeometry();
        if (!geometry) throw new Error("Geometri tidak ditemukan");
        onApply(toFeature(geometry as GeoJSON.Geometry), "Seluruh Indonesia");
        return;
      }
      if (scope === "island") {
        if (!islandCode) {
          setError("Pilih pulau terlebih dahulu");
          return;
        }
        const label = islands.find((i) => i.code === islandCode)?.name || islandCode;
        const geometry = await fetchIslandGeometry(islandCode);
        if (!geometry) throw new Error("Geometri tidak ditemukan");
        onApply(toFeature(geometry as GeoJSON.Geometry), label);
        return;
      }

      // admin drill-down: deepest selected level wins
      let endpoint: "province" | "city" | "district" | "village" = "province";
      let code = provinceCode;
      let name = provinces.find((p) => p.code === provinceCode)?.name || "";
      if (!provinceCode) {
        setError("Pilih provinsi terlebih dahulu");
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
      if (!geometry) throw new Error("Geometri tidak ditemukan");
      onApply(toFeature(geometry), name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat wilayah");
    } finally {
      setLoading(false);
    }
  }

  const SCOPES: { key: Scope; label: string }[] = [
    { key: "admin", label: "Provinsi / Kab-Kota / Kec / Desa" },
    { key: "island", label: "Pulau" },
    { key: "indonesia", label: "Seluruh Indonesia" },
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
            <label className="form-label">Provinsi</label>
            <SearchableSelect
              value={provinceCode}
              onChange={handleProvinceChange}
              options={provinces.map((p) => ({ value: p.code, label: p.name }))}
              placeholder="-- Pilih Provinsi --"
              clearable
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">Kota/Kabupaten</label>
            <SearchableSelect
              value={cityCode}
              onChange={handleCityChange}
              options={cities.map((c) => ({ value: c.code, label: c.name }))}
              placeholder="-- Semua (level provinsi) --"
              disabled={!provinceCode}
              clearable
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">Kecamatan</label>
            <SearchableSelect
              value={districtCode}
              onChange={handleDistrictChange}
              options={districts.map((d) => ({ value: d.code, label: d.name }))}
              placeholder="-- Semua (level kota) --"
              disabled={!cityCode}
              clearable
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">Desa/Kelurahan</label>
            <SearchableSelect
              value={villageCode}
              onChange={setVillageCode}
              options={villages.map((v) => ({ value: v.code, label: v.name }))}
              placeholder="-- Semua (level kecamatan) --"
              disabled={!districtCode}
              clearable
            />
          </div>
        </div>
      )}

      {scope === "island" && (
        <div className="mb-3">
          <label className="form-label">Pulau</label>
          <SearchableSelect
            value={islandCode}
            onChange={setIslandCode}
            options={islands.map((i) => ({ value: i.code, label: i.name }))}
            placeholder="-- Pilih Pulau --"
            clearable
          />
        </div>
      )}

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <button className="btn btn-success" onClick={handleLoad} disabled={loading}>
        {loading ? (
          <>
            <span className="spinner-border spinner-border-sm me-1" /> Memuat...
          </>
        ) : (
          <>
            <i className="bi bi-check-lg" /> Muat Wilayah
          </>
        )}
      </button>
    </div>
  );
}
