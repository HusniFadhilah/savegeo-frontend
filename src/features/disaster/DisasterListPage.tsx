import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useConfigStore } from "@/hooks/useConfigStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import { ApiError } from "@/services/apiClient";
import { fetchDisasterEvents } from "./api";
import {
  EVENT_DISASTER_TYPE_LABELS,
  EVENT_DISASTER_TYPE_OPTIONS,
  SEVERITY_LABELS,
  SEVERITY_OPTIONS,
  type DisasterEventListItem,
  type DisasterEventListParams,
} from "./types";

const EMPTY_FILTERS: DisasterEventListParams = {};

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

/**
 * Item D.11 of the redesign spec: published event cards + filter bar
 * (disaster_type/year/province/severity) + search. Calls GET /disasters
 * (published-only, per the contract doc - User routes never see
 * draft/unpublished events).
 */
export default function DisasterListPage() {
  const { user, logout } = useUserAuthStore();
  const { getInt } = useConfigStore();
  const yearMin = getInt("year.min", 2015);
  const yearMax = getInt("year.max", new Date().getFullYear());

  const [filters, setFilters] = useState<DisasterEventListParams>(EMPTY_FILTERS);
  const [pendingFilters, setPendingFilters] = useState<DisasterEventListParams>(EMPTY_FILTERS);
  const [events, setEvents] = useState<DisasterEventListItem[]>([]);
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
        setError(err instanceof ApiError ? err.message : "Terjadi kesalahan jaringan saat memuat daftar bencana.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const applyFilters = (e: FormEvent) => {
    e.preventDefault();
    setFilters(pendingFilters);
  };

  const resetFilters = () => {
    setPendingFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
  };

  const years = Array.from({ length: Math.max(0, yearMax - yearMin + 1) }, (_, i) => yearMax - i);

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <Link to="/">
          <img src="/logo.jpg" alt="SAVEGEO" height={40} className="rounded" />
        </Link>
        <h4 className="mb-0">Dashboard Intelijen Bencana</h4>
        <div className="ms-auto d-flex align-items-center gap-2">
          <span className="text-muted small">{user?.username}</span>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={logout}>
            <i className="bi bi-box-arrow-right" /> Logout
          </button>
        </div>
      </div>

      <form className="card mb-3" onSubmit={applyFilters}>
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label small fw-semibold mb-1">Jenis Bencana</label>
              <select
                className="form-select form-select-sm"
                value={pendingFilters.disaster_type ?? ""}
                onChange={(e) => setPendingFilters((f) => ({ ...f, disaster_type: e.target.value || undefined }))}
              >
                <option value="">Semua Jenis</option>
                {EVENT_DISASTER_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small fw-semibold mb-1">Tahun</label>
              <select
                className="form-select form-select-sm"
                value={pendingFilters.year ?? ""}
                onChange={(e) => setPendingFilters((f) => ({ ...f, year: e.target.value || undefined }))}
              >
                <option value="">Semua Tahun</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small fw-semibold mb-1">Provinsi</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="cth. Jawa Barat"
                value={pendingFilters.province ?? ""}
                onChange={(e) => setPendingFilters((f) => ({ ...f, province: e.target.value || undefined }))}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small fw-semibold mb-1">Tingkat Keparahan</label>
              <select
                className="form-select form-select-sm"
                value={pendingFilters.severity ?? ""}
                onChange={(e) => setPendingFilters((f) => ({ ...f, severity: e.target.value || undefined }))}
              >
                <option value="">Semua</option>
                {SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold mb-1">Cari</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Nama / lokasi kejadian"
                value={pendingFilters.search ?? ""}
                onChange={(e) => setPendingFilters((f) => ({ ...f, search: e.target.value || undefined }))}
              />
            </div>
          </div>
          <div className="mt-2 d-flex gap-2">
            <button type="submit" className="btn btn-sm btn-primary">
              <i className="bi bi-funnel-fill" /> Terapkan Filter
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetFilters}>
              Reset
            </button>
          </div>
        </div>
      </form>

      {loading && (
        <div className="alert alert-info py-2">
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
          Memuat daftar kejadian bencana...
        </div>
      )}
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {!loading && !error && !events.length && (
        <div className="alert alert-secondary py-2">Tidak ada kejadian bencana yang cocok dengan filter ini.</div>
      )}

      <div className="row g-3">
        {events.map((event) => (
          <div className="col-md-6 col-lg-4" key={event.id}>
            <div className="card h-100">
              {event.thumbnail && (
                <img src={event.thumbnail} className="card-img-top" alt={event.name} style={{ height: 160, objectFit: "cover" }} />
              )}
              <div className="card-body d-flex flex-column">
                <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                  <span className="badge bg-primary">
                    {EVENT_DISASTER_TYPE_LABELS[event.disaster_type as keyof typeof EVENT_DISASTER_TYPE_LABELS] ||
                      event.disaster_type}
                  </span>
                  {event.severity && (
                    <span className={`badge ${severityBadgeClass(event.severity)}`}>{SEVERITY_LABELS[event.severity]}</span>
                  )}
                </div>
                <h6 className="card-title">{event.name}</h6>
                <p className="card-text small text-muted mb-1">
                  {[event.location_name, event.province?.join(", ")].filter(Boolean).join(" - ") || "-"}
                </p>
                <p className="card-text small text-muted mb-2">{event.event_date || "-"}</p>
                {event.description && <p className="card-text small flex-grow-1">{event.description.slice(0, 140)}</p>}
                <div className="d-flex align-items-center justify-content-between mt-auto pt-2">
                  <span className="small text-muted">{event.available_analysis_count} analisis tersedia</span>
                  <Link to={`/pemetaan-bencana/${event.id}`} className="btn btn-sm btn-primary">
                    Lihat Detail
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
