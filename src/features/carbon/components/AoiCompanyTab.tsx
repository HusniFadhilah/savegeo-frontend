import { useEffect, useMemo, useState } from "react";
import { listCompanies, getCompanyGeojson } from "@/features/carbon/api";
import type { CompanyBoundary } from "@/features/carbon/types";
import type { AoiFeature } from "@/types/map";
import { INDUSTRY_LABEL as TYPE_LABEL } from "@/types/api";
import { ApiError } from "@/services/apiClient";
import SearchableSelect from "@/components/ui/SearchableSelect";

interface Props {
  onApply: (feature: AoiFeature, name: string) => void;
}

/**
 * Ported from module-carbon.html's #aoiCompany tab + main.js
 * loadCompanyAOI/filterCompanyList/useCompanyAOI(): company boundary
 * picker with search + industry-type + province filters.
 */
export default function AoiCompanyTab({ onApply }: Props) {
  const [companies, setCompanies] = useState<CompanyBoundary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [provinceFilter, setProvinceFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listCompanies()
      .then((res) => {
        if (!cancelled) setCompanies(res.companies || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Gagal memuat data perusahaan");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const provinces = useMemo(
    () => [...new Set(companies.map((c) => c.province).filter((p): p is string => Boolean(p)))].sort(),
    [companies],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return companies.filter(
      (c) =>
        (!typeFilter || c.industry_type === typeFilter) &&
        (!provinceFilter || c.province === provinceFilter) &&
        (!q || c.name.toLowerCase().includes(q) || (c.company_name || "").toLowerCase().includes(q)),
    );
  }, [companies, search, typeFilter, provinceFilter]);

  const selected = companies.find((c) => c.id === selectedId) || null;

  async function handleUseAsAoi() {
    if (!selected) return;
    setApplying(true);
    setError(null);
    try {
      const res = await getCompanyGeojson(selected.id);
      const raw = res.geojson;
      const geometry =
        raw && (raw as GeoJSON.Feature).type === "Feature"
          ? (raw as GeoJSON.Feature).geometry
          : (raw as GeoJSON.Geometry);
      if (!geometry) throw new Error("GeoJSON kosong");
      const feature: AoiFeature = {
        type: "Feature",
        geometry: geometry as AoiFeature["geometry"],
        properties: {},
      };
      onApply(feature, selected.name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat batas perusahaan");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="co-aoi">
      <div className="row g-2 mb-3">
        <div className="col-md-5">
          <div className="co-aoi-search">
            <i className="bi bi-search" />
            <input
              type="text"
              className="form-control"
              placeholder="Cari nama perusahaan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="col-md-3">
          <select
            className="form-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Semua jenis industri</option>
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <SearchableSelect
            value={provinceFilter}
            onChange={setProvinceFilter}
            options={provinces.map((p) => ({ value: p, label: p }))}
            placeholder="Semua provinsi"
            clearable
          />
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading ? (
        <div className="co-aoi-empty">
          <span className="spinner-border spinner-border-sm me-2" /> Memuat data perusahaan...
        </div>
      ) : filtered.length === 0 ? (
        <div className="co-aoi-empty">
          <i className="bi bi-building-slash" />
          <div>Tidak ada data perusahaan.</div>
          <small className="text-muted">Tambahkan melalui Panel Admin.</small>
        </div>
      ) : (
        <div className="co-aoi-list">
          {filtered.map((c) => {
            const areaStr = c.area_ha
              ? `${c.area_ha.toLocaleString("id-ID", { maximumFractionDigits: 0 })} ha`
              : "";
            const isSelected = selectedId === c.id;
            return (
              <div
                key={c.id}
                className={`co-aoi-item ${isSelected ? "selected" : ""}`}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="co-aoi-item-check">
                  <i className={`bi ${isSelected ? "bi-check-circle-fill" : "bi-circle"}`} />
                </div>
                <div className="co-aoi-item-body">
                  <div className="co-aoi-item-name">{c.name}</div>
                  <div className="co-aoi-item-meta">
                    <span className="co-aoi-tag">{TYPE_LABEL[c.industry_type] || c.industry_type}</span>
                    {c.sub_type && <span>{c.sub_type}</span>}
                    {c.province && (
                      <span>
                        <i className="bi bi-geo-alt" /> {c.province}
                      </span>
                    )}
                    {areaStr && <span>{areaStr}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <button className="btn btn-success mt-3" onClick={handleUseAsAoi} disabled={applying}>
          {applying ? (
            <>
              <span className="spinner-border spinner-border-sm me-1" /> Memuat...
            </>
          ) : (
            <>
              <i className="bi bi-check-lg" /> Gunakan sebagai AOI
            </>
          )}
        </button>
      )}
    </div>
  );
}
