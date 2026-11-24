import { AdminTableNumberCell, AdminTableNumberHeader } from "@/features/admin/components/AdminTableNumber";
import { useCallback, useEffect, useState } from "react";
import TablePagination from "@/components/ui/TablePagination";
import { deleteDisasterEvent, listDisasterEvents, updateDisasterEvent } from "../../api";
import type { DisasterEvent } from "../../types";
import { useAdmin } from "../../AdminContext";
import BulkTableToolbar from "../BulkTableToolbar";
import { useI18nStore } from "@/hooks/useI18nStore";

const DISASTER_TYPE_KEYS: Record<string, string> = {
  flood: "admin.disaster.flood", landslide: "admin.disaster.landslide", forest_fire: "admin.disaster.forestFire",
  earthquake: "admin.disaster.earthquake", tsunami: "admin.disaster.tsunami", volcanic_eruption: "admin.disaster.volcanicEruption",
  storm: "admin.disaster.storm", drought: "admin.disaster.drought", other: "admin.disaster.other",
};

const STATUS_KEYS: Record<string, string> = {
  draft: "admin.disaster.draft", processing: "admin.disaster.processingStatus", ready_for_review: "admin.disaster.readyForReview",
  published: "admin.disaster.published", archived: "admin.disaster.archived",
};
const STATUS_VALUES = Object.keys(STATUS_KEYS);
const STATUS_BADGE: Record<string, string> = {
  draft: "badge-gray",
  processing: "badge-blue",
  ready_for_review: "badge-amber",
  published: "badge-green",
  archived: "badge-red",
};

const SEVERITY_KEYS: Record<string, string> = { low: "admin.disaster.low", medium: "admin.disaster.medium", high: "admin.disaster.high", critical: "admin.disaster.critical" };
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
 * All-status admin listing of disaster events. The API returns a bounded,
 * filtered page and a total count; row actions and filter controls stay here.
 */
export default function DisasterEventList({ onCreateNew, onEdit, onOpen, reloadKey }: Props) {
  const t = useI18nStore((state) => state.t);
  const disasterTypes = Object.entries(DISASTER_TYPE_KEYS).map(([value, key]) => ({ value, label: t(key) }));
  const statuses = STATUS_VALUES.map((value) => ({ value, label: t(STATUS_KEYS[value]) }));
  const severities = Object.entries(SEVERITY_KEYS).map(([value, key]) => ({ value, label: t(key) }));
  const { notify } = useAdmin();
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditStatus, setBulkEditStatus] = useState("");
  const [bulkEditType, setBulkEditType] = useState("");
  const [bulkEditSeverity, setBulkEditSeverity] = useState("");
  const [quickStatus, setQuickStatus] = useState("");

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
        page: page + 1,
        page_size: PAGE_SIZE,
      });
      setEvents(res.events);
      const nextTotal = typeof res.total === "number" ? res.total : res.events.length;
      setTotal(nextTotal);
      const nextPageCount = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));
      if (page >= nextPageCount) setPage(nextPageCount - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.disaster.loadingFailed"));
      setEvents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, severityFilter, yearFilter, search, page, t]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, reloadKey]);

  useEffect(() => {
    setPage(0);
    setSelectedIds([]);
  }, [statusFilter, typeFilter, severityFilter, yearFilter, search]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = events;
  const pageIds = pageRows.map((ev) => ev.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const toggleSelected = (id: number) => setSelectedIds((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));
  const toggleAllPage = () => setSelectedIds((ids) => (allPageSelected ? ids.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...ids, ...pageIds]))));

  const doBulkDelete = async () => {
    if (!selectedIds.length || !confirm(t("admin.disaster.deleteSelectedConfirm", { count: selectedIds.length }))) return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(selectedIds.map((id) => deleteDisasterEvent(id)));
      const failed = results.filter((result) => result.status === "rejected").length;
      setSelectedIds([]);
      notify(failed ? t("admin.disaster.deletedPartial", { success: results.length - failed, failed }) : t("admin.disaster.deletedCount", { count: results.length }), failed ? "e" : "s");
      await load();
    } finally {
      setBulkBusy(false);
    }
  };

  const doBulkUpdate = async (payload: Parameters<typeof updateDisasterEvent>[1], messageKey: "changed" | "updated") => {
    if (!selectedIds.length) return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(selectedIds.map((id) => updateDisasterEvent(id, payload)));
      const failed = results.filter((result) => result.status === "rejected").length;
      const failedIds = selectedIds.filter((_, index) => results[index]?.status === "rejected");
      const failureDetails = results.flatMap((result, index) => {
        if (result.status !== "rejected") return [];
        const event = events.find((item) => item.id === selectedIds[index]);
        const reason = result.reason instanceof Error ? result.reason.message : "Gagal memperbarui";
        return [`${event?.name || `ID ${selectedIds[index]}`}: ${reason}`];
      });
      setSelectedIds(failedIds);
      setBulkEditOpen(false);
      setQuickStatus("");
      setBulkEditStatus("");
      setBulkEditType("");
      setBulkEditSeverity("");
      const details = failureDetails.slice(0, 2).join(" | ");
      const suffix = failureDetails.length > 2 ? ` | ${t("admin.disaster.moreFailures", { count: failureDetails.length - 2 })}` : "";
      notify(
        failed
          ? t("admin.disaster.updatePartial", { success: results.length - failed, failed, details, suffix })
          : t("admin.disaster.updatedCount", { count: results.length, message: t(`admin.disaster.${messageKey}`) }),
        failed ? "e" : "s",
      );
      await load();
    } finally {
      setBulkBusy(false);
    }
  };

  const applyQuickStatus = async () => {
    if (!quickStatus) return;
    if (!confirm(t("admin.disaster.updateStatusConfirm", { count: selectedIds.length, status: t(STATUS_KEYS[quickStatus]) }))) return;
    await doBulkUpdate({ status: quickStatus }, "changed");
  };

  const applyBulkEdit = async () => {
    const payload: Parameters<typeof updateDisasterEvent>[1] = {};
    if (bulkEditStatus) payload.status = bulkEditStatus;
    if (bulkEditType) payload.disaster_type = bulkEditType;
    if (bulkEditSeverity) payload.severity = bulkEditSeverity;
    if (!Object.keys(payload).length) {
      notify(t("admin.disaster.chooseField"), "e");
      return;
    }
    if (!confirm(t("admin.disaster.applyBulkConfirm", { count: selectedIds.length }))) return;
    await doBulkUpdate(payload, "updated");
  };

  const doDelete = async (ev: DisasterEvent) => {
    if (!confirm(t("admin.disaster.deleteConfirm", { name: ev.name }))) return;
    setBusyId(ev.id);
    try {
      await deleteDisasterEvent(ev.id);
      notify(t("admin.disaster.deleted"), "s");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("admin.disaster.deleteFailed"), "e");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>{t("admin.disaster.listTitle")}</span>
        <button type="button" className="btn-sm primary" onClick={onCreateNew}>
          <i className="bi bi-plus-lg" /> {t("admin.disaster.addEvent")}
        </button>
      </div>
      <div className="card-body-custom">
        {/* Filter bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="form-input"
            placeholder={t("admin.disaster.search")}
            style={{ maxWidth: 200 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="form-input" style={{ maxWidth: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t("admin.disaster.allStatuses")}</option>
            {statuses.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select className="form-input" style={{ maxWidth: 180 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">{t("admin.disaster.allTypes")}</option>
            {disasterTypes.map((o) => (
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
            <option value="">{t("admin.disaster.allSeverities")}</option>
            {severities.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            className="form-input"
            placeholder={t("admin.disaster.year")}
            style={{ maxWidth: 90 }}
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{!loading && `${events.length} ${t("admin.disaster.entries")}`}</span>
        </div>

        <BulkTableToolbar selectedCount={selectedIds.length} onClear={() => setSelectedIds([])}>
          <button type="button" className="btn-sm" disabled={bulkBusy} onClick={() => setBulkEditOpen((open) => !open)}>
            <i className="bi bi-pencil-square" /> {bulkEditOpen ? t("admin.disaster.closeEdit") : t("admin.disaster.editSelected")}
          </button>
          <select
            className="form-input"
            style={{ width: 170, minHeight: 30, padding: "3px 8px", fontSize: 12 }}
            value={quickStatus}
            disabled={bulkBusy}
            onChange={(e) => setQuickStatus(e.target.value)}
            aria-label={t("admin.disaster.selectNewStatus")}
          >
            <option value="">{t("admin.disaster.chooseStatus")}</option>
            {statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button type="button" className="btn-sm primary" disabled={!quickStatus || bulkBusy} onClick={applyQuickStatus}>
            {t("admin.disaster.applyStatus")}
          </button>
          <button type="button" className="btn-sm danger" disabled={bulkBusy} onClick={doBulkDelete}>
            <i className="bi bi-trash" /> {bulkBusy ? t("admin.disaster.deleting") : t("admin.disaster.deleteSelected")}
          </button>
        </BulkTableToolbar>

        {selectedIds.length > 0 && bulkEditOpen && (
          <div className="admin-bulk-editor" role="region" aria-label={t("admin.disaster.bulkEdit")}>
            <div>
              <strong>{t("admin.disaster.bulkEdit")} ({selectedIds.length})</strong>
              <div className="admin-bulk-editor-hint">{t("admin.disaster.unchangedHint")}</div>
            </div>
            <select className="form-input" value={bulkEditStatus} onChange={(e) => setBulkEditStatus(e.target.value)} aria-label={t("admin.disaster.bulkStatus")}>
              <option value="">{t("admin.disaster.statusUnchanged")}</option>
              {statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className="form-input" value={bulkEditType} onChange={(e) => setBulkEditType(e.target.value)} aria-label={t("admin.disaster.bulkType")}>
              <option value="">{t("admin.disaster.typeUnchanged")}</option>
              {disasterTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className="form-input" value={bulkEditSeverity} onChange={(e) => setBulkEditSeverity(e.target.value)} aria-label={t("admin.disaster.bulkSeverity")}>
              <option value="">{t("admin.disaster.severityUnchanged")}</option>
              {severities.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button type="button" className="btn-sm primary" disabled={bulkBusy} onClick={applyBulkEdit}>
              <i className="bi bi-check2" /> {bulkBusy ? t("admin.disaster.saving") : t("admin.disaster.applyChanges")}
            </button>
          </div>
        )}

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table className="tbl tbl-wide">
            <colgroup>
              <col className="admin-table-selection-col" />
              <col className="admin-table-number-col" />
              <col style={{ width: "calc(24% - 1.56rem)" }} />
              <col style={{ width: "calc(14% - 0.91rem)" }} />
              <col style={{ width: "calc(11% - 0.715rem)" }} />
              <col style={{ width: "calc(17% - 1.105rem)" }} />
              <col style={{ width: "calc(10% - 0.65rem)" }} />
              <col style={{ width: "calc(13% - 0.845rem)" }} />
              <col style={{ width: "calc(11% - 0.715rem)" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="admin-table-selection"><input className="admin-table-check" type="checkbox" aria-label={t("admin.disaster.selectAllEvents")} checked={allPageSelected} onChange={toggleAllPage} /></th>
                <AdminTableNumberHeader />
                <th>{t("admin.disaster.name")}</th>
                <th>{t("admin.disaster.type")}</th>
                <th>{t("admin.disaster.date")}</th>
                <th>{t("admin.disaster.location")}</th>
                <th>{t("admin.disaster.severity")}</th>
                <th>{t("admin.disaster.status")}</th>
                <th>{t("admin.disaster.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    {t("admin.disaster.loadingShort")}
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "var(--danger-color, #e53935)", padding: "1.5rem" }}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && pageRows.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    {t("admin.disaster.emptyEvents")}
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                pageRows.map((ev, index) => (
                  <tr key={ev.id}>
                    <td className="admin-table-selection"><input className="admin-table-check" type="checkbox" aria-label={t("admin.disaster.selectEvent", { name: ev.name })} checked={selectedIds.includes(ev.id)} onChange={() => toggleSelected(ev.id)} /></td>
                    <AdminTableNumberCell index={index} page={page} pageSize={PAGE_SIZE} />
                    <td title={ev.name}>{ev.name}</td>
                    <td>
                      <span className="badge-label">{DISASTER_TYPE_KEYS[ev.disaster_type] ? t(DISASTER_TYPE_KEYS[ev.disaster_type]) : ev.disaster_type}</span>
                    </td>
                    <td>{ev.event_date || "—"}</td>
                    <td>{ev.location_name || (ev.province?.length ? ev.province.join(", ") : "—")}</td>
                    <td>
                      {ev.severity ? (
                        <span className={`stat-badge ${SEVERITY_BADGE[ev.severity] || "badge-gray"}`}>
                          {SEVERITY_KEYS[ev.severity] ? t(SEVERITY_KEYS[ev.severity]) : ev.severity}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className={`stat-badge ${STATUS_BADGE[ev.status] || "badge-gray"}`}>
                        {STATUS_KEYS[ev.status] ? t(STATUS_KEYS[ev.status]) : ev.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-sm"
                        style={{ padding: "2px 6px", fontSize: 10 }}
                        onClick={() => onEdit(ev)}
                      >
                        {t("admin.disaster.edit")}
                      </button>
                      <button
                        type="button"
                        className="btn-sm"
                        style={{ padding: "2px 6px", fontSize: 10, marginLeft: 3 }}
                        onClick={() => onOpen(ev)}
                      >
                        {t("admin.disaster.view")}
                      </button>
                      <button
                        type="button"
                        className="btn-sm danger"
                        style={{ padding: "2px 6px", fontSize: 10, marginLeft: 3 }}
                        disabled={busyId === ev.id || bulkBusy}
                        onClick={() => doDelete(ev)}
                      >
                        {t("admin.delete")}
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
          recordsTotal={total}
          recordsFiltered={total}
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
