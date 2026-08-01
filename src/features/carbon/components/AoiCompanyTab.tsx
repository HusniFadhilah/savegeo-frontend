import { useEffect, useMemo, useState } from "react";
import { listCompanies, getCompanyGeojson } from "@/features/carbon/api";
import type { CompanyBoundary } from "@/features/carbon/types";
import type { AoiFeature } from "@/types/map";
import { ApiError } from "@/services/apiClient";
import SearchableSelect from "@/components/ui/SearchableSelect";

interface Props {
  onApply: (feature: AoiFeature, name: string) => void;
}

const TYPE_LABEL: Record<string, string> = {
  mining: "Pertambangan",
  forestry: "Kehutanan",
  plantation: "Perkebunan",
  energy: "Energi",
};

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
    <div>
      <div className="d-flex gap-2 mb-2 flex-wrap align-items-center">
        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="Cari nama perusahaan..."
          style={{ maxWidth: 200 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-select form-select-sm"
          style={{ minWidth: 160 }}
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
        <div style={{ minWidth: 160 }}>
          <SearchableSelect
            value={provinceFilter}
            onChange={setProvinceFilter}
            options={provinces.map((p) => ({ value: p, label: p }))}
            placeholder="Semua provinsi"
            clearable
          />
        </div>
      </div>

      {loading && (
        <div className="text-muted small mb-2">
          <span className="spinner-border spinner-border-sm me-1" /> Memuat data...
        </div>
      )}
      {!loading && !filtered.length && (
        <div className="text-muted small mb-2">
          Tidak ada data perusahaan. Tambahkan melalui Panel Admin.
        </div>
      )}
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #dee2e6", borderRadius: 6 }}>
        {filtered.map((c) => {
          const areaStr = c.area_ha
            ? `${c.area_ha.toLocaleString("id-ID", { maximumFractionDigits: 0 })} ha`
            : "";
          return (
            <div
              key={c.id}
              className="p-2"
              style={{
                cursor: "pointer",
                borderBottom: "1px solid #dee2e6",
                fontSize: 13,
                background: selectedId === c.id ? "#e8f4fe" : undefined,
              }}
              onClick={() => setSelectedId(c.id)}
            >
              <div className="fw-semibold">{c.name}</div>
              <div className="text-muted small">
                {TYPE_LABEL[c.industry_type] || c.industry_type}
                {c.sub_type ? ` · ${c.sub_type}` : ""}
                {c.province ? ` · ${c.province}` : ""}
                {areaStr ? ` · ${areaStr}` : ""}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <button className="btn btn-success mt-2" onClick={handleUseAsAoi} disabled={applying}>
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
