import { useEffect, useMemo, useState } from "react";
import { listSatelliteProvidersAdmin, resetSatelliteProvider, saveSatelliteProvider } from "../api";
import type { SatelliteProviderRow } from "../types";
import { useAdmin } from "../AdminContext";
import TablePagination from "@/components/ui/TablePagination";
import BulkTableToolbar from "./BulkTableToolbar";
import ImageryProviders from "./ImageryProviders";

const PAGE_SIZE = 10;

type EditableFields = Pick<
  SatelliteProviderRow,
  "name" | "provider" | "resolution_label" | "description" | "gee_collection" | "is_active" | "display_order"
>;

function toEditable(row: SatelliteProviderRow): EditableFields {
  return {
    name: row.name,
    provider: row.provider,
    resolution_label: row.resolution_label,
    description: row.description,
    gee_collection: row.gee_collection,
    is_active: row.is_active,
    display_order: row.display_order,
  };
}

/**
 * Admin editor for the satellite_providers database overlay (app/db/models/
 * satellite_provider_entry.py) on top of app/registries/
 * satellite_provider_registry.py's static defaults - closes the last gap
 * from the request to store provider configuration in the database: until now this table
 * was only editable via direct SQL. `gee_collection` here is the same field
 * that actually drives which GEE ImageCollection gets queried (verified
 * live) - editing it changes real analysis behavior, not just display text.
 *
 * Uses the same .tbl/.card-header-custom/TablePagination shell as
 * ModelRegistry/AdminUsers/CompanyBoundaries. The list is the static
 * registry merged with a DB overlay (GET /admin/satellite-providers has no
 * draw/start/length support, unlike the other admin lists), so search +
 * paging happen client-side over the already-fetched rows rather than via
 * useServerTable.
 */
function VegetationProvidersTable() {
  const { notify } = useAdmin();
  const [rows, setRows] = useState<SatelliteProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditableFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = () => {
    setLoading(true);
    listSatelliteProvidersAdmin()
      .then((res) => setRows((res.satellites ?? []).sort((a, b) => a.display_order - b.display_order)))
      .catch(() => notify("Gagal memuat daftar penyedia satelit", "e"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(0);
  }, [search]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.key, r.name, r.provider, r.resolution_label, r.gee_collection].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selectableRows = pageRows.filter((row) => row.has_override);
  const allPageSelected = selectableRows.length > 0 && selectableRows.every((row) => selectedKeys.includes(row.key));
  const toggleSelected = (key: string) => setSelectedKeys((keys) => (keys.includes(key) ? keys.filter((value) => value !== key) : [...keys, key]));
  const toggleAllPage = () => setSelectedKeys((keys) => (allPageSelected ? keys.filter((key) => !selectableRows.some((row) => row.key === key)) : Array.from(new Set([...keys, ...selectableRows.map((row) => row.key)]))));
  const handleBulkReset = async () => {
    if (!selectedKeys.length || !confirm(`Hapus override pada ${selectedKeys.length} provider terpilih?`)) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(selectedKeys.map((key) => resetSatelliteProvider(key)));
    const failed = results.filter((r) => r.status === "rejected").length;
    setSelectedKeys([]);
    notify(failed ? `${results.length - failed} override direset, ${failed} gagal` : `${results.length} override direset`, failed ? "e" : "s");
    load();
    setBulkBusy(false);
  };

  const startEdit = (row: SatelliteProviderRow) => {
    setEditingKey(row.key);
    setDraft(toEditable(row));
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraft(null);
  };

  const save = async (key: string) => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveSatelliteProvider(key, draft);
      notify(`Konfigurasi penyedia "${key}" berhasil disimpan`, "s");
      cancelEdit();
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal menyimpan", "e");
    } finally {
      setSaving(false);
    }
  };

  const resetOverride = async (row: SatelliteProviderRow) => {
    if (!row.has_override) return;
    if (!confirm(`Hapus penimpaan konfigurasi "${row.key}" dan gunakan kembali katalog bawaan?`)) return;
    try {
      await resetSatelliteProvider(row.key);
      notify(`Penimpaan konfigurasi "${row.key}" berhasil dihapus`, "s");
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal memulihkan konfigurasi", "e");
    }
  };

  const toggleActive = async (row: SatelliteProviderRow) => {
    try {
      await saveSatelliteProvider(row.key, { is_active: !row.is_active });
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal mengubah status", "e");
    }
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>Penyedia Satelit</span>
      </div>
      <div className="card-body-custom">
        <p className="text-muted mb-3" style={{ fontSize: ".85rem" }}>
          <i className="bi bi-info-circle me-1" />
          Konfigurasi basis data menjadi lapisan pengaturan di atas katalog statis. Jika konfigurasi basis data tidak tersedia,
          sistem menggunakan nilai bawaan dari katalog tersebut. Perubahan pada <code>GEE Collection</code> akan mengubah sumber
          citra yang digunakan dalam analisis vegetasi. Pastikan nilai yang dimasukkan sudah benar.
        </p>

        {editingKey && (
          <div className="mb-3">
            <label className="form-label small text-muted">Deskripsi ({editingKey})</label>
            <textarea
              className="form-control form-control-sm"
              rows={2}
              value={draft?.description ?? ""}
              onChange={(e) => setDraft((d) => (d ? { ...d, description: e.target.value } : d))}
            />
          </div>
        )}

        <BulkTableToolbar selectedCount={selectedKeys.length} onClear={() => setSelectedKeys([])}>
          <button type="button" className="btn-sm danger" disabled={bulkBusy} onClick={handleBulkReset}>
            <i className="bi bi-arrow-counterclockwise" /> {bulkBusy ? "Memulihkan..." : "Pulihkan konfigurasi terpilih"}
          </button>
        </BulkTableToolbar>

        <div style={{ overflowX: "auto" }}>
          <table className="tbl tbl-wide">
            <colgroup>
              <col style={{ width: "3.5rem" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr>
                <th><input className="admin-table-check" type="checkbox" aria-label="Pilih semua provider dengan override di halaman" checked={allPageSelected} onChange={toggleAllPage} /></th>
                <th>Key</th>
                <th>Nama</th>
                <th>Provider</th>
                <th>Resolusi</th>
                <th>Koleksi GEE</th>
                <th>Aktif</th>
                <th>Penimpaan konfigurasi</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && pageRows.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    {search ? "Tidak ada provider yang cocok." : "Belum ada provider satelit."}
                  </td>
                </tr>
              )}
              {!loading &&
                pageRows.map((row) => {
                  const isEditing = editingKey === row.key;
                  return (
                    <tr key={row.key}>
                      <td><input className="admin-table-check" type="checkbox" aria-label={`Pilih provider ${row.key}`} checked={selectedKeys.includes(row.key)} disabled={!row.has_override} onChange={() => toggleSelected(row.key)} /></td>
                      <td>
                        <code>{row.key}</code>
                      </td>
                      <td style={{ minWidth: 160 }}>
                        {isEditing ? (
                          <input
                            className="form-control form-control-sm"
                            value={draft?.name ?? ""}
                            onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                          />
                        ) : (
                          row.name
                        )}
                      </td>
                      <td style={{ minWidth: 140 }}>
                        {isEditing ? (
                          <input
                            className="form-control form-control-sm"
                            value={draft?.provider ?? ""}
                            onChange={(e) => setDraft((d) => (d ? { ...d, provider: e.target.value } : d))}
                          />
                        ) : (
                          row.provider
                        )}
                      </td>
                      <td style={{ minWidth: 140 }}>
                        {isEditing ? (
                          <input
                            className="form-control form-control-sm"
                            value={draft?.resolution_label ?? ""}
                            onChange={(e) => setDraft((d) => (d ? { ...d, resolution_label: e.target.value } : d))}
                          />
                        ) : (
                          row.resolution_label
                        )}
                      </td>
                      <td style={{ minWidth: 220 }}>
                        {isEditing ? (
                          <input
                            className="form-control form-control-sm font-monospace"
                            value={draft?.gee_collection ?? ""}
                            onChange={(e) => setDraft((d) => (d ? { ...d, gee_collection: e.target.value } : d))}
                          />
                        ) : (
                          <code style={{ fontSize: ".75rem" }}>{row.gee_collection}</code>
                        )}
                      </td>
                      <td>
                        <div className="form-check form-switch mb-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={row.is_active}
                            onChange={() => toggleActive(row)}
                            disabled={isEditing}
                          />
                        </div>
                      </td>
                      <td>
                        {row.has_override ? (
                          <span className="badge bg-warning text-dark">Basis data</span>
                        ) : (
                          <span className="badge bg-secondary">Katalog bawaan</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {isEditing ? (
                          <>
                            <button className="btn-sm primary me-1" disabled={saving} onClick={() => save(row.key)}>
                              <i className="bi bi-check-lg" />
                            </button>
                            <button className="btn-sm" disabled={saving} onClick={cancelEdit}>
                              <i className="bi bi-x-lg" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="btn-sm me-1" onClick={() => startEdit(row)}>
                              <i className="bi bi-pencil" />
                            </button>
                            {row.has_override && (
                              <button
                                className="btn-sm danger"
                                title="Hapus penimpaan dan gunakan katalog bawaan"
                                onClick={() => resetOverride(row)}
                              >
                                <i className="bi bi-arrow-counterclockwise" />
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          pageCount={pageCount}
          recordsTotal={rows.length}
          recordsFiltered={filteredRows.length}
          pageSize={PAGE_SIZE}
          search={search}
          onSearchChange={setSearch}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          searchPlaceholder="Cari key, nama, provider..."
        />
      </div>
    </div>
  );
}

export default function SatelliteProviders() {
  const [catalog, setCatalog] = useState<"imagery" | "vegetation">("imagery");
  return (
    <div>
      <div className="d-flex flex-wrap gap-2 mb-3" role="tablist" aria-label="Katalog penyedia satelit">
        <button
          type="button"
          role="tab"
          aria-selected={catalog === "imagery"}
          className={`btn-sm ${catalog === "imagery" ? "primary" : ""}`}
          onClick={() => setCatalog("imagery")}
        >
          Katalog citra satelit
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={catalog === "vegetation"}
          className={`btn-sm ${catalog === "vegetation" ? "primary" : ""}`}
          onClick={() => setCatalog("vegetation")}
        >
          Analisis vegetasi
        </button>
      </div>
      {catalog === "imagery" ? <ImageryProviders /> : <VegetationProvidersTable />}
    </div>
  );
}
