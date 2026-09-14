import { useI18nStore, formatNumber } from "@/hooks/useI18nStore";

interface Props {
  page: number; // 0-indexed
  pageCount: number;
  recordsTotal: number;
  recordsFiltered: number;
  pageSize: number;
  search: string;
  onSearchChange: (v: string) => void;
  onPrev: () => void;
  onNext: () => void;
  searchPlaceholder?: string;
  /** Set false when the parent already renders its own search input bound to
   * the same `search`/`onSearchChange` (e.g. inside a combined filter bar). */
  showSearch?: boolean;
}

/** Search box + prev/next pagination footer, styled to match the admin panel's
 * existing .tbl/.btn-sm conventions (no DataTables.net dependency - this is a
 * plain React table, server-side paginated via useServerTable). */
export default function TablePagination({
  page,
  pageCount,
  recordsTotal,
  recordsFiltered,
  pageSize,
  search,
  onSearchChange,
  onPrev,
  onNext,
  searchPlaceholder,
  showSearch = true,
}: Props) {
  const { language, t } = useI18nStore();
  const start = recordsFiltered === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(recordsFiltered, (page + 1) * pageSize);
  const filteredNote = recordsFiltered !== recordsTotal ? ` (${t("table.filteredFrom", { count: formatNumber(recordsTotal, language) })})` : "";

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {showSearch ? (
        <input
          className="form-input"
          style={{ maxWidth: 220, fontSize: 12 }}
          placeholder={searchPlaceholder || t("common.search")}
          aria-label={t("common.search")}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      ) : (
        <span />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-muted)" }}>
        <span>
          {recordsFiltered === 0 ? "0 entri" : `${start}–${end} dari ${recordsFiltered} entri${filteredNote}`}
        </span>
        <button type="button" className="btn-sm" disabled={page <= 0} onClick={onPrev}>
          ‹
        </button>
        <span>
          {page + 1} / {pageCount}
        </span>
        <button type="button" className="btn-sm" disabled={page >= pageCount - 1} onClick={onNext}>
          ›
        </button>
      </div>
    </div>
  );
}
