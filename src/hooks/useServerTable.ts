import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/services/apiClient";

export interface ServerTableResponse<T> {
  draw: number;
  recordsTotal: number;
  recordsFiltered: number;
  data: T[];
}

interface UseServerTableOptions {
  pageSize?: number;
  /** Bump this to force a reload without changing page/search (e.g. after a mutation). */
  reloadKey?: number | string;
  /** Extra static query params merged in on every request (e.g. `{industry_type: "mining"}`).
   * Changing this object triggers a reload, same as changing the search term. */
  extraParams?: Record<string, string>;
}

/**
 * Drives a table against savegeo/backend's DataTables-compatible server-side
 * endpoints (app/services/datatable_service.py): sends `draw`/`start`/`length`/
 * `search[value]` query params, expects back `{draw, recordsTotal,
 * recordsFiltered, data}`. Used for GEE credentials, ML models, admin users,
 * and company boundaries - anywhere the admin list can grow past a page or two.
 */
export function useServerTable<T>(path: string, options: UseServerTableOptions = {}) {
  const { pageSize = 10, reloadKey, extraParams } = options;
  const extraParamsKey = JSON.stringify(extraParams || {});

  const [page, setPage] = useState(0); // 0-indexed
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<T[]>([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsFiltered, setRecordsFiltered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const drawRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const draw = ++drawRef.current;
    try {
      const params = new URLSearchParams();
      params.set("draw", String(draw));
      params.set("start", String(page * pageSize));
      params.set("length", String(pageSize));
      if (search.trim()) params.set("search[value]", search.trim());
      if (extraParams) {
        for (const [k, v] of Object.entries(extraParams)) {
          if (v) params.set(k, v);
        }
      }

      const res = await apiClient.get<ServerTableResponse<T>>(`${path}?${params.toString()}`, { auth: true });
      // Ignore stale responses from a superseded request (e.g. fast search typing).
      if (res.draw !== drawRef.current) return;
      setRows(res.data);
      setRecordsTotal(res.recordsTotal);
      setRecordsFiltered(res.recordsFiltered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data");
      setRows([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, page, pageSize, search, extraParamsKey]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  // Reset to first page whenever the extra filter params change.
  useEffect(() => {
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraParamsKey]);

  // Reset to first page whenever the search term changes.
  useEffect(() => {
    setPage(0);
  }, [search]);

  const pageCount = Math.max(1, Math.ceil(recordsFiltered / pageSize));

  return {
    rows,
    loading,
    error,
    page,
    pageCount,
    pageSize,
    recordsTotal,
    recordsFiltered,
    search,
    setSearch,
    goToPage: (p: number) => setPage(Math.max(0, Math.min(pageCount - 1, p))),
    nextPage: () => setPage((p) => Math.min(pageCount - 1, p + 1)),
    prevPage: () => setPage((p) => Math.max(0, p - 1)),
    reload: load,
  };
}
