import { useEffect, useState } from "react";
import { useI18nStore } from "@/hooks/useI18nStore";
import { listCompanies, listCompanyProvinces, getCompanyGeojson } from "@/features/carbon/api";
import type { CompanyBoundary } from "@/features/carbon/types";
import type { AoiFeature } from "@/types/map";
import { INDUSTRY_LABEL as TYPE_LABEL } from "@/types/api";
import { ApiError } from "@/services/apiClient";
import MultiSearchableSelect from "@/components/ui/MultiSearchableSelect";

interface Props {
  onApply: (feature: AoiFeature, name: string) => void;
}

/**
 * Ported from module-carbon.html's #aoiCompany tab + main.js
 * loadCompanyAOI/filterCompanyList/useCompanyAOI(): company boundary
 * picker with search + industry-type + province filters.
 */
export default function AoiCompanyTab({ onApply }: Props) {
  const t = useI18nStore((s) => s.t);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [companies, setCompanies] = useState<CompanyBoundary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [provinceFilter, setProvinceFilter] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let active = true;
    listCompanyProvinces().then(res => { if (active) setProvinces(res.provinces); })
      .catch(() => { if (active) setError(t("carbon.aoiCompany.err.loadFailed")); });
    return () => { active = false; };
  }, [t]);

  useEffect(() => { setOffset(0); setSelectedId(null); }, [search, typeFilter, provinceFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      listCompanies({ search, industryType: typeFilter, provinces: provinceFilter, offset })
        .then(res => {
          if (cancelled) return;
          setCompanies(res.companies);
          setHasMore(res.has_more);
        })
        .catch(err => {
          if (!cancelled) setError(err instanceof ApiError ? err.message : t("carbon.aoiCompany.err.loadFailed"));
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [search, typeFilter, provinceFilter, offset, t]);
  const filtered = companies;

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
      if (!geometry) throw new Error(t("carbon.aoiCompany.err.emptyGeojson"));
      const feature: AoiFeature = {
        type: "Feature",
        geometry: geometry as AoiFeature["geometry"],
        properties: {},
      };
      onApply(feature, selected.name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("carbon.aoiCompany.err.boundaryFailed"));
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
              placeholder={t("carbon.aoiCompany.searchPlaceholder")}
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
            <option value="">{t("carbon.aoiCompany.allIndustryTypes")}</option>
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <MultiSearchableSelect
            value={provinceFilter}
            onChange={setProvinceFilter}
            options={provinces.map((p) => ({ value: p, label: p }))}
            placeholder={t("carbon.aoiCompany.allProvinces")}
            clearable
            selectedSummary={t("carbon.aoiCompany.selectedProvinces", { count: provinceFilter.length })}
          />
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading ? (
        <div className="co-aoi-empty">
          <span className="spinner-border spinner-border-sm me-2" /> {t("carbon.aoiCompany.loading")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="co-aoi-empty">
          <i className="bi bi-building-slash" />
          <div>{t("carbon.aoiCompany.noData")}</div>
          <small className="text-muted">{t("carbon.aoiCompany.addViaAdmin")}</small>
        </div>
      ) : (
        <div className="co-aoi-list">
          {filtered.map((c) => {
            const areaStr = c.area_ha
              ? `${c.area_ha.toLocaleString("id-ID", { maximumFractionDigits: 0 })} ha`
              : "";
            const isSelected = selectedId === c.id;
            const locationDetails = [
              c.province && `${t("carbon.aoiCompany.provinceLabel")}: ${c.province}`,
              c.district && `${t("carbon.aoiCompany.districtLabel")}: ${c.district}`,
            ].filter(Boolean).join("\n");
            return (
              <div
                key={c.id}
                className={`co-aoi-item ${isSelected ? "selected" : ""}`}
                onClick={() => setSelectedId(c.id)}
                title={locationDetails || undefined}
                aria-label={locationDetails ? `${c.name}. ${locationDetails.replace("\n", ". ")}` : c.name}
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

      <div className="d-flex gap-2 mt-2">
        <button type="button" className="btn btn-sm btn-outline-secondary" aria-label={t("common.previous")} title={t("common.previous")} disabled={offset === 0 || loading} onClick={() => setOffset(n => Math.max(0, n - 100))}>
          <i className="bi bi-chevron-left" aria-hidden="true" />
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={!hasMore || loading} onClick={() => setOffset(n => n + 100)}>
          {t("common.loadMore")} <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
        </button>
      </div>
      {selected && (
        <button className="btn btn-success mt-3" onClick={handleUseAsAoi} disabled={applying}>
          {applying ? (
            <>
              <span className="spinner-border spinner-border-sm me-1" /> {t("carbon.aoiRegion.loading")}
            </>
          ) : (
            <>
              <i className="bi bi-check-lg" /> {t("carbon.aoiCompany.useAsAoi")}
            </>
          )}
        </button>
      )}
    </div>
  );
}
