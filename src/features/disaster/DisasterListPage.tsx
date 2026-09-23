import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { env } from "@/config/env";
import { useConfigStore } from "@/hooks/useConfigStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import { ApiError } from "@/services/apiClient";
import SearchableSelect from "@/features/admin/components/SearchableSelect";
import { fetchDisasterEvents } from "./api";
import { KarhutlaOverviewCard, adaptLegacyEvent } from "@/features/karhutla/components";
import { FALLBACK_WILDFIRE_EVENTS } from "@/features/karhutla/data";
import { isKarhutlaDisasterType } from "./types";
import {
  EVENT_DISASTER_TYPE_LABELS,
  EVENT_DISASTER_TYPE_OPTIONS,
  SEVERITY_LABELS,
  SEVERITY_OPTIONS,
  type DisasterEventListItem,
  type DisasterEventListParams,
} from "./types";

const EMPTY_FILTERS: DisasterEventListParams = {};
const PAGE_SIZE_OPTIONS = [10, 15, 20, 30, 50];

function severityBadgeClass(severity: string | null): string {
  switch (severity) {
    case "critical":
      return "bg-danger";
    case "high":
      return "bg-warning text-dark";
    case "medium":
      return "bg-info text-dark";
    case "low":
      return "bg-secondary";
    default:
      return "bg-secondary";
  }
}

function typeIcon(type: string | undefined): string {
  switch (type) {
    case "flood":
      return "bi-water";
    case "earthquake":
      return "bi-activity";
    case "landslide":
      return "bi-triangle";
    case "wildfire":
      return "bi-fire";
    default:
      return "bi-exclamation-triangle";
  }
}

function activeFilterCount(filters: DisasterEventListParams): number {
  return Object.values(filters).filter((value) => value !== undefined && value !== "").length;
}

function resolveThumbnailUrl(thumbnail: string | null | undefined): string | null {
  if (!thumbnail) return null;
  if (/^https?:\/\//i.test(thumbnail) || thumbnail.startsWith("data:")) return thumbnail;
  const backendBaseUrl = env.apiBaseUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
  if (thumbnail.startsWith("/")) {
    const normalizedPath = `/${thumbnail.replace(/^\/+/, "")}`;
    return `${backendBaseUrl}${normalizedPath}` || normalizedPath;
  }
  return thumbnail.replace(/([^:]\/)\/{2,}/g, "$1");
}

/**
 * Item D.11 of the redesign spec: published event cards + filter bar
 * (disaster_type/year/province/severity) + search. Calls GET /disasters
 * (published-only, per the contract doc - User routes never see
 * draft/unpublished events).
 */
export default function DisasterListPage() {
  const { user, logout } = useUserAuthStore();
  const { t } = useI18nStore();
  const { getInt } = useConfigStore();
  const yearMin = getInt("year.min", 2015);
  const yearMax = getInt("year.max", new Date().getFullYear());

  const [filters, setFilters] = useState<DisasterEventListParams>(EMPTY_FILTERS);
  const [pendingFilters, setPendingFilters] = useState<DisasterEventListParams>(EMPTY_FILTERS);
  const [events, setEvents] = useState<DisasterEventListItem[]>([]);
  const [provinceSourceEvents, setProvinceSourceEvents] = useState<DisasterEventListItem[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchDisasterEvents(filters)
      .then((res) => {
        if (cancelled) return;
        setEvents(res.events ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : t("disaster.list.loadFailed"),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    fetchDisasterEvents()
      .then((res) => {
        if (!cancelled) setProvinceSourceEvents(res.events ?? []);
      })
      .catch(() => {
        if (!cancelled) setProvinceSourceEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(0);
  }, [filters, pageSize]);

  const applyFilters = (e: FormEvent) => {
    e.preventDefault();
    setFilters(pendingFilters);
  };

  const resetFilters = () => {
    setPendingFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
  };

  const years = Array.from({ length: Math.max(0, yearMax - yearMin + 1) }, (_, i) => yearMax - i);

  const provinceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    provinceSourceEvents.forEach((event) => {
      event.province?.forEach((province) => {
        const normalized = province.trim();
        if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      });
    });
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "id"))
      .map(([province, count]) => ({
        value: province,
        label: `${province} - ${count} event`,
      }));
  }, [provinceSourceEvents]);

  const filterCount = activeFilterCount(filters);
  const featuredWildfire = events.find((event) => isKarhutlaDisasterType(event.disaster_type));
  const pageCount = Math.max(1, Math.ceil(events.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageStart = events.length === 0 ? 0 : currentPage * pageSize + 1;
  const pageEnd = Math.min(events.length, (currentPage + 1) * pageSize);
  const visibleEvents = events.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  return (
    <div className="disaster-shell disaster-list-shell">
      <div className="disaster-topbar">
        <Link to="/carbon-estimation" className="disaster-brand">
          <img src="images/savegeo-logo.svg" alt="SAVEGEO" />
          <span>SAVEGEO</span>
        </Link>
        <div className="disaster-topbar-actions">
          <span>{user?.username}</span>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={logout}>
            <i className="bi bi-box-arrow-right" /> Logout
          </button>
        </div>
      </div>

      <section className="disaster-list-hero">
        <div>
          <span className="disaster-eyebrow">{t("disaster.list.eyebrow")}</span>
          <h1>{t("disaster.list.title")}</h1>
          <p>
            {t("disaster.list.description")}
          </p>
        </div>
        <div className="disaster-hero-metrics">
          <div>
            <i className="bi bi-broadcast-pin" />
            <span>{t("disaster.list.activeEvents")}</span>
            <strong>{events.length}</strong>
          </div>
          <div>
            <i className="bi bi-cpu" />
            <span>{t("disaster.list.analysis")}</span>
            <strong>
              {events.reduce((sum, event) => sum + (event.available_analysis_count ?? 0), 0)}
            </strong>
          </div>
          <div>
            <i className="bi bi-funnel" />
            <span>{t("disaster.list.filter")}</span>
            <strong>{filterCount}</strong>
          </div>
        </div>
      </section>

      <KarhutlaOverviewCard
        event={featuredWildfire ? adaptLegacyEvent(featuredWildfire) : FALLBACK_WILDFIRE_EVENTS[0]}
      />

      <form className="disaster-filter-panel" onSubmit={applyFilters}>
        <div className="disaster-filter-grid">
          <div>
            <label className="form-label small fw-semibold mb-1">{t("disaster.list.type")}</label>
            <select
              className="form-select form-select-sm"
              value={pendingFilters.disaster_type ?? ""}
              onChange={(e) =>
                setPendingFilters((f) => ({ ...f, disaster_type: e.target.value || undefined }))
              }
            >
              <option value="">{t("disaster.list.allTypes")}</option>
              {EVENT_DISASTER_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label small fw-semibold mb-1">{t("disaster.list.year")}</label>
            <select
              className="form-select form-select-sm"
              value={pendingFilters.year ?? ""}
              onChange={(e) =>
                setPendingFilters((f) => ({ ...f, year: e.target.value || undefined }))
              }
            >
              <option value="">{t("disaster.list.allYears")}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label small fw-semibold mb-1">{t("disaster.list.province")}</label>
            <SearchableSelect
              value={pendingFilters.province ?? ""}
              options={provinceOptions}
              placeholder={t("disaster.list.searchProvince")}
              emptyHint={t("disaster.list.noProvinceEvents")}
              allowCustomValue={false}
              variant="plain"
              className="disaster-province-select"
              onChange={(value) =>
                setPendingFilters((f) => ({ ...f, province: value || undefined }))
              }
            />
          </div>
          <div>
            <label className="form-label small fw-semibold mb-1">{t("disaster.list.severity")}</label>
            <select
              className="form-select form-select-sm"
              value={pendingFilters.severity ?? ""}
              onChange={(e) =>
                setPendingFilters((f) => ({ ...f, severity: e.target.value || undefined }))
              }
            >
              <option value="">{t("disaster.list.all")}</option>
              {SEVERITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="disaster-filter-search">
            <label className="form-label small fw-semibold mb-1">{t("disaster.list.search")}</label>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder={t("disaster.list.searchPlaceholder")}
              value={pendingFilters.search ?? ""}
              onChange={(e) =>
                setPendingFilters((f) => ({ ...f, search: e.target.value || undefined }))
              }
            />
          </div>
        </div>
        <div className="disaster-filter-actions">
          <button type="submit" className="btn btn-sm btn-primary">
            <i className="bi bi-funnel-fill" /> {t("disaster.list.apply")}
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetFilters}>
            {t("admin.reset")}
          </button>
        </div>
      </form>

      {loading && (
        <div className="alert alert-info py-2">
          <span
            className="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          />
          {t("disaster.list.loading")}
        </div>
      )}
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {!loading && !error && !events.length && (
        <div className="alert alert-secondary py-2">
          {t("disaster.list.empty")}
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="disaster-pagination-bar">
          <div className="disaster-pagination-size">
            <span>{t("disaster.list.show")}</span>
            <select
              className="form-select form-select-sm"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>{t("disaster.list.perPage")}</span>
          </div>
          <div className="disaster-pagination-info">
            <span>
              {pageStart}-{pageEnd} dari {events.length} event
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={currentPage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <i className="bi bi-chevron-left" />
            </button>
            <span>
              {currentPage + 1} / {pageCount}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              <i className="bi bi-chevron-right" />
            </button>
          </div>
        </div>
      )}

      <div className="disaster-event-grid">
        {visibleEvents.map((event) => {
          const thumbnailUrl = resolveThumbnailUrl(event.thumbnail);
          return (
            <article className="disaster-event-card" key={event.id}>
              <div className="disaster-event-media">
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt={event.name} />
                ) : (
                  <div className="disaster-event-placeholder">
                    <i className={`bi ${typeIcon(event.disaster_type)}`} />
                  </div>
                )}
                <span className="disaster-event-date">{event.event_date || "-"}</span>
              </div>
              <div className="disaster-event-body">
                <div className="disaster-card-badges">
                  <span className="badge text-bg-primary">
                    <i className={`bi ${typeIcon(event.disaster_type)}`} />{" "}
                    {EVENT_DISASTER_TYPE_LABELS[
                      event.disaster_type as keyof typeof EVENT_DISASTER_TYPE_LABELS
                    ] || event.disaster_type}
                  </span>
                  {event.severity && (
                    <span className={`badge ${severityBadgeClass(event.severity)}`}>
                      {SEVERITY_LABELS[event.severity]}
                    </span>
                  )}
                </div>
                <h2>{event.name}</h2>
                <p className="disaster-event-location">
                  <i className="bi bi-geo-alt" />{" "}
                  {[event.location_name, event.province?.join(", ")].filter(Boolean).join(" - ") ||
                    "-"}
                </p>
                {event.description && (
                  <p className="disaster-event-description">{event.description.slice(0, 170)}</p>
                )}
                <div className="disaster-card-footer">
                  <span>
                    <i className="bi bi-bar-chart" /> {event.available_analysis_count} analisis
                    tersedia
                  </span>
                  <Link to={`/pemetaan-bencana/${event.id}`} className="btn btn-sm btn-primary">
                    Detail <i className="bi bi-arrow-right" />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
