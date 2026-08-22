import { useCallback, useEffect, useState } from "react";
import TablePagination from "@/components/ui/TablePagination";
import { deleteDisasterEvent, listDisasterEvents } from "../../api";
import type { DisasterEvent } from "../../types";
import { useAdmin } from "../../AdminContext";

const DISASTER_TYPE_LABEL: Record<string, string> = {
  flood: "Banjir",
  landslide: "Longsor",
  forest_fire: "Kebakaran Hutan",
  earthquake: "Gempa Bumi",
  tsunami: "Tsunami",
  volcanic_eruption: "Erupsi Gunung Api",
  storm: "Badai",
  drought: "Kekeringan",
  other: "Lainnya",
};
const DISASTER_TYPE_OPTIONS = Object.entries(DISASTER_TYPE_LABEL).map(([value, label]) => ({ value, label }));

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  processing: "Diproses",
  ready_for_review: "Siap Ditinjau",
  published: "Dipublikasikan",
  archived: "Diarsipkan",
};
const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));
const STATUS_BADGE: Record<string, string> = {
  draft: "badge-gray",
  processing: "badge-blue",
  ready_for_review: "badge-amber",
  published: "badge-green",
  archived: "badge-red",
};

const SEVERITY_LABEL: Record<string, string> = {
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
  critical: "Kritis",
};
const SEVERITY_OPTIONS = Object.entries(SEVERITY_LABEL).map(([value, label]) => ({ value, label }));
const SEVERITY_BADGE: Record<string, string> = {
  low: "badge-gray",
  medium: "badge-blue",
  high: "badge-amber",
  critical: "badge-red",
};

interface Props {
  onCreateNew: () => void;
  onEdit: (event: DisasterEvent) => void;
  onOpen: (event: DisasterEvent) => void;
  /** Bump to force a reload without changing filters (e.g. after returning from the detail workspace). */
  reloadKey?: number | string;
}

const PAGE_SIZE = 10;

/**
 * All-status admin listing of disaster events - `GET /admin/disasters`
 * doesn't speak the DataTables `{draw,recordsTotal,...}` protocol
 * `useServerTable` expects (it just returns `{events: [...]}` filtered by
 * query params), so pagination here is a plain client-side slice of the
 * already-filtered response. Filter bar / table / row-actions styling
 * mirrors CompanyBoundaries.tsx.
 */
export default function DisasterEventList({ onCreateNew, onEdit, onOpen, reloadKey }: Props) {
  const { notify } = useAdmin();
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listDisasterEvents({
        status: statusFilter || undefined,
        disaster_type: typeFilter || undefined,
        severity: severityFilter || undefined,
        year: yearFilter || undefined,
        search: search.trim() || undefined,
      });
      setEvents(res.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, severityFilter, yearFilter, search]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, reloadKey]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, typeFilter, severityFilter, yearFilter, search]);

  const pageCount = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const pageRows = events.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const doDelete = async (ev: DisasterEvent) => {
    if (!confirm(`Hapus kejadian bencana "${ev.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setBusyId(ev.id);
    try {
      await deleteDisasterEvent(ev.id);
      notify("Kejadian bencana dihapus", "s");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal menghapus", "e");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>Daftar Kejadian Bencana</span>
        <button type="button" className="btn-sm primary" onClick={onCreateNew}>
          <i className="bi bi-plus-lg" /> Kejadian Baru
        </button>
      </div>
      <div className="card-body-custom">
        {/* Filter bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="form-input"
            placeholder="Cari nama, lokasi..."
            style={{ maxWidth: 200 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="form-input" style={{ maxWidth: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Semua status</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select className="form-input" style={{ maxWidth: 180 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Semua jenis</option>
            {DISASTER_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className="form-input"
            style={{ maxWidth: 140 }}
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="">Semua tingkat</option>
            {SEVERITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            className="form-input"
            placeholder="Tahun"
            style={{ maxWidth: 90 }}
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{!loading && `${events.length} entri`}</span>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table className="tbl tbl-wide">
            <colgroup>
              <col style={{ width: "24%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "17%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "11%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Jenis</th>
                <th>Tanggal</th>
                <th>Lokasi</th>
                <th>Tingkat</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--danger-color, #e53935)", padding: "1.5rem" }}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && pageRows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    Belum ada kejadian bencana. Buat kejadian baru untuk memulai.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                pageRows.map((ev) => (
                  <tr key={ev.id}>
                    <td title={ev.name}>{ev.name}</td>
                    <td>
                      <span className="badge-label">{DISASTER_TYPE_LABEL[ev.disaster_type] || ev.disaster_type}</span>
                    </td>
                    <td>{ev.event_date || "—"}</td>
                    <td>{ev.location_name || (ev.province?.length ? ev.province.join(", ") : "—")}</td>
                    <td>
                      {ev.severity ? (
                        <span className={`stat-badge ${SEVERITY_BADGE[ev.severity] || "badge-gray"}`}>
                          {SEVERITY_LABEL[ev.severity] || ev.severity}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className={`stat-badge ${STATUS_BADGE[ev.status] || "badge-gray"}`}>
                        {STATUS_LABEL[ev.status] || ev.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-sm"
                        style={{ padding: "2px 6px", fontSize: 10 }}
                        onClick={() => onEdit(ev)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-sm"
                        style={{ padding: "2px 6px", fontSize: 10, marginLeft: 3 }}
                        onClick={() => onOpen(ev)}
                      >
                        Buka
                      </button>
                      <button
                        type="button"
                        className="btn-sm danger"
                        style={{ padding: "2px 6px", fontSize: 10, marginLeft: 3 }}
                        disabled={busyId === ev.id}
                        onClick={() => doDelete(ev)}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          pageCount={pageCount}
          recordsTotal={events.length}
          recordsFiltered={events.length}
          pageSize={PAGE_SIZE}
          search={search}
          onSearchChange={setSearch}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          showSearch={false}
        />
      </div>
    </div>
  );
}
