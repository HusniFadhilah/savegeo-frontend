import { useEffect, useMemo, useState } from "react";
import {
  listImageryProvidersAdmin,
  resetImageryProvider,
  saveImageryProvider,
  saveImageryProviderConnection,
} from "../api";
import type { ImageryProviderAdminRow } from "../types";
import { useAdmin } from "../AdminContext";
import TablePagination from "@/components/ui/TablePagination";

const PAGE_SIZE = 12;
type MetadataDraft = Pick<
  ImageryProviderAdminRow,
  "name" | "provider" | "group" | "description" | "gee_collection" | "cloud_property" | "resolution_m" | "revisit_days" | "start_year" | "display_order"
>;

function toDraft(row: ImageryProviderAdminRow): MetadataDraft {
  return {
    name: row.name,
    provider: row.provider,
    group: row.group,
    description: row.description,
    gee_collection: row.gee_collection ?? "",
    cloud_property: row.cloud_property ?? "",
    resolution_m: row.resolution_m,
    revisit_days: row.revisit_days,
    start_year: row.start_year,
    display_order: row.display_order,
  };
}

function statusLabel(status?: string) {
  if (status === "connected") return "Terhubung";
  if (status === "blocked") return "Konektor belum tersedia";
  if (status === "incomplete_configuration") return "Konfigurasi belum lengkap";
  return "Belum dikonfigurasi";
}

export default function ImageryProviders() {
  const { notify } = useAdmin();
  const [rows, setRows] = useState<ImageryProviderAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<MetadataDraft | null>(null);
  const [connectionKey, setConnectionKey] = useState<string | null>(null);
  const [connectionDraft, setConnectionDraft] = useState<Record<string, string>>({});
  const [credential, setCredential] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const load = () => {
    setLoading(true);
    listImageryProvidersAdmin()
      .then((res) => setRows(res.providers ?? []))
      .catch((err) => notify(err instanceof Error ? err.message : "Gagal memuat katalog citra satelit", "e"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setPage(0), [search]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = [...rows].sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
    if (!query) return sorted;
    return sorted.filter((row) =>
      [row.key, row.name, row.provider, row.group, row.source_kind].some((value) => (value ?? "").toLowerCase().includes(query)),
    );
  }, [rows, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const startEdit = (row: ImageryProviderAdminRow) => {
    setEditingKey(row.key);
    setDraft(toDraft(row));
    setConnectionKey(null);
  };

  const startConnectionEdit = (row: ImageryProviderAdminRow) => {
    setConnectionKey(row.key);
    setConnectionDraft({ ...(row.connection.fields ?? {}) });
    setCredential("");
    setEditingKey(null);
  };

  const saveMetadata = async (key: string) => {
    if (!draft) return;
    setBusy(true);
    try {
      await saveImageryProvider(key, draft);
      notify(`Metadata ${key} berhasil disimpan`, "s");
      setEditingKey(null);
      setDraft(null);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal menyimpan metadata provider", "e");
    } finally {
      setBusy(false);
    }
  };

  const saveConnection = async (row: ImageryProviderAdminRow) => {
    setBusy(true);
    try {
      await saveImageryProviderConnection(row.key, {
        fields: connectionDraft,
        ...(credential.trim() ? { credential: credential.trim() } : {}),
      });
      notify(`Koneksi ${row.name} berhasil disimpan`, "s");
      setCredential("");
      setConnectionKey(null);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal menyimpan koneksi provider", "e");
    } finally {
      setBusy(false);
    }
  };

  const clearCredential = async (row: ImageryProviderAdminRow) => {
    if (!confirm(`Hapus credential tersimpan untuk ${row.name}?`)) return;
    setBusy(true);
    try {
      await saveImageryProviderConnection(row.key, { clear_credential: true });
      notify(`Credential ${row.name} dihapus`, "s");
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal menghapus credential provider", "e");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row: ImageryProviderAdminRow) => {
    setBusy(true);
    try {
      await saveImageryProvider(row.key, { is_active: !row.is_active });
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal mengubah status provider", "e");
    } finally {
      setBusy(false);
    }
  };

  const restoreDefaults = async (row: ImageryProviderAdminRow) => {
    if (!row.has_override || !confirm(`Pulihkan metadata dan status katalog bawaan untuk ${row.name}?`)) return;
    setBusy(true);
    try {
      await resetImageryProvider(row.key);
      notify(`Pengaturan ${row.name} dipulihkan`, "s");
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal memulihkan pengaturan provider", "e");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header-custom d-flex align-items-center justify-content-between gap-2">
        <span>Katalog citra satelit</span>
        <span className="badge bg-secondary">{rows.length} provider</span>
      </div>
      <div className="card-body-custom">
        <p className="text-muted mb-3" style={{ fontSize: ".85rem" }}>
          <i className="bi bi-info-circle me-1" />
          Atur visibilitas, urutan, dan metadata provider yang tersedia pada penjelajah citra. Provider komersial dapat diberi URL katalog,
          koleksi, dan metode autentikasi di sini. Credential hanya dikirim saat disimpan dan tidak pernah dikembalikan oleh API.
        </p>

        <div style={{ overflowX: "auto" }}>
          <table className="tbl tbl-wide">
            <thead>
              <tr>
                <th>Provider</th><th>Jenis</th><th>Katalog / koneksi</th><th>Aktif</th><th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="text-center p-4">Memuat katalog...</td></tr>}
              {!loading && pageRows.length === 0 && <tr><td colSpan={5} className="text-center p-4">Provider tidak ditemukan.</td></tr>}
              {!loading && pageRows.map((row) => {
                const editing = editingKey === row.key;
                const editingConnection = connectionKey === row.key;
                const connection = row.connection;
                return (
                  <tr key={row.key}>
                    <td colSpan={5} style={{ padding: 0 }}>
                      <div className="d-grid" style={{ gridTemplateColumns: "minmax(180px, 1.3fr) minmax(110px, .7fr) minmax(180px, 1.2fr) 70px minmax(150px, .8fr)", alignItems: "center", gap: ".75rem", padding: ".75rem" }}>
                        <div>
                          <strong>{row.name}</strong><br /><code>{row.key}</code>
                          {!row.is_active && <span className="badge bg-secondary ms-2">Nonaktif</span>}
                        </div>
                        <div><span>{row.group}</span><br /><small className="text-muted">{row.source_kind}</small></div>
                        <div>
                          {connection.supported ? (
                            <><span className={`badge ${connection.status === "connected" ? "bg-success" : connection.status === "blocked" ? "bg-warning text-dark" : "bg-secondary"}`}>
                              {statusLabel(connection.status)}
                            </span>{connection.credential_configured && <small className="d-block text-muted mt-1">Credential tersimpan</small>}</>
                          ) : <small className="text-muted">Sumber bawaan / publik</small>}
                        </div>
                        <div className="form-check form-switch mb-0">
                          <input className="form-check-input" type="checkbox" checked={row.is_active} onChange={() => toggleActive(row)} aria-label={`Aktifkan ${row.name}`} disabled={busy} />
                        </div>
                        <div className="d-flex flex-wrap gap-1">
                          <button type="button" className="btn-sm" onClick={() => editing ? (setEditingKey(null), setDraft(null)) : startEdit(row)} disabled={busy}>
                            <i className={`bi ${editing ? "bi-x-lg" : "bi-pencil"}`} /> {editing ? "Batal" : "Metadata"}
                          </button>
                          {connection.supported && <button type="button" className="btn-sm" onClick={() => editingConnection ? setConnectionKey(null) : startConnectionEdit(row)} disabled={busy}>
                            <i className={`bi ${editingConnection ? "bi-x-lg" : "bi-gear"}`} /> Koneksi
                          </button>}
                          {row.has_override && <button type="button" className="btn-sm danger" title="Pulihkan metadata dan status bawaan" onClick={() => restoreDefaults(row)} disabled={busy}>
                            <i className="bi bi-arrow-counterclockwise" />
                          </button>}
                        </div>
                      </div>

                      {editing && draft && (
                        <div className="border-top p-3 bg-light">
                          <div className="row g-2">
                            <div className="col-md-4"><label className="form-label">Nama tampilan</label><input className="form-control form-control-sm" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
                            <div className="col-md-4"><label className="form-label">Penyedia</label><input className="form-control form-control-sm" value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })} /></div>
                            <div className="col-md-4"><label className="form-label">Grup</label><input className="form-control form-control-sm" value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value })} /></div>
                            <div className="col-md-4"><label className="form-label">Resolusi (m)</label><input type="number" min="0" step="any" className="form-control form-control-sm" value={draft.resolution_m ?? ""} onChange={(e) => setDraft({ ...draft, resolution_m: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                            <div className="col-md-3"><label className="form-label">Tahun awal</label><input type="number" min="0" className="form-control form-control-sm" value={draft.start_year ?? ""} onChange={(e) => setDraft({ ...draft, start_year: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                            <div className="col-md-3"><label className="form-label">Revisit (hari)</label><input type="number" min="0" step="any" className="form-control form-control-sm" value={draft.revisit_days ?? ""} onChange={(e) => setDraft({ ...draft, revisit_days: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                            <div className="col-md-3"><label className="form-label">Urutan</label><input type="number" min="0" className="form-control form-control-sm" value={draft.display_order} onChange={(e) => setDraft({ ...draft, display_order: Number(e.target.value) || 0 })} /></div>
                            <div className="col-12"><label className="form-label">GEE collection (jika digunakan)</label><input className="form-control form-control-sm font-monospace" value={draft.gee_collection ?? ""} onChange={(e) => setDraft({ ...draft, gee_collection: e.target.value })} /></div>
                            <div className="col-md-6"><label className="form-label">Properti tutupan awan</label><input className="form-control form-control-sm font-monospace" value={draft.cloud_property ?? ""} onChange={(e) => setDraft({ ...draft, cloud_property: e.target.value })} placeholder="eo:cloud_cover" /></div>
                            <div className="col-12"><label className="form-label">Deskripsi</label><textarea rows={2} className="form-control form-control-sm" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
                          </div>
                          <div className="d-flex justify-content-end mt-3"><button type="button" className="btn-sm primary" onClick={() => saveMetadata(row.key)} disabled={busy}><i className="bi bi-check-lg" /> Simpan metadata</button></div>
                        </div>
                      )}

                      {editingConnection && connection.supported && (
                        <div className="border-top p-3 bg-light">
                          {connection.note && <div className="alert alert-warning py-2">{connection.note}</div>}
                          <div className="d-flex align-items-center gap-2 mb-3"><strong>Status konektor</strong><span className={`badge ${connection.status === "connected" ? "bg-success" : "bg-secondary"}`}>{statusLabel(connection.status)}</span><small className="text-muted">Catalog URL dan koleksi yang diisi akan dipakai langsung saat mencari scene.</small></div>
                          <div className="row g-2">
                            {"catalog_url" in connectionDraft && <div className="col-md-6"><label className="form-label">URL STAC katalog / search</label><input type="url" className="form-control form-control-sm" value={connectionDraft.catalog_url ?? ""} onChange={(e) => setConnectionDraft({ ...connectionDraft, catalog_url: e.target.value })} placeholder="https://..." /></div>}
                            {"collection" in connectionDraft && <div className="col-md-6"><label className="form-label">Koleksi</label><input className="form-control form-control-sm" value={connectionDraft.collection ?? ""} onChange={(e) => setConnectionDraft({ ...connectionDraft, collection: e.target.value })} /></div>}
                            {"auth_scheme" in connectionDraft && <div className="col-md-4"><label className="form-label">Autentikasi</label><select className="form-select form-select-sm" value={connectionDraft.auth_scheme ?? "bearer"} onChange={(e) => setConnectionDraft({ ...connectionDraft, auth_scheme: e.target.value })}><option value="bearer">Bearer</option><option value="basic">Basic</option><option value="none">Tanpa autentikasi</option></select></div>}
                            {"workspace_id" in connectionDraft && <div className="col-md-6"><label className="form-label">Workspace ID</label><input className="form-control form-control-sm" value={connectionDraft.workspace_id ?? ""} onChange={(e) => setConnectionDraft({ ...connectionDraft, workspace_id: e.target.value })} /></div>}
                            {"api_contract_reference" in connectionDraft && <div className="col-md-6"><label className="form-label">Referensi kontrak API</label><input className="form-control form-control-sm" value={connectionDraft.api_contract_reference ?? ""} onChange={(e) => setConnectionDraft({ ...connectionDraft, api_contract_reference: e.target.value })} /></div>}
                            <div className="col-md-8">
                              <label className="form-label">Credential {connection.credential_configured && <small className="text-success">(sudah tersimpan)</small>}</label>
                              <input type="password" autoComplete="new-password" className="form-control form-control-sm" value={credential} onChange={(e) => setCredential(e.target.value)} placeholder={connection.credential_configured ? "Kosongkan untuk mempertahankan credential saat ini" : "Masukkan credential provider"} disabled={!connection.can_write_credential} />
                              {!connection.can_write_credential && <small className="text-muted">Hak secret.write diperlukan untuk mengubah credential.</small>}
                            </div>
                          </div>
                          <div className="d-flex justify-content-end gap-2 mt-3">
                            {connection.credential_configured && connection.can_write_credential && <button type="button" className="btn-sm danger" onClick={() => clearCredential(row)} disabled={busy}><i className="bi bi-trash" /> Hapus credential</button>}
                            <button type="button" className="btn-sm primary" onClick={() => saveConnection(row)} disabled={busy}><i className="bi bi-shield-lock" /> Simpan koneksi</button>
                          </div>
                        </div>
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
          recordsFiltered={filtered.length}
          pageSize={PAGE_SIZE}
          search={search}
          onSearchChange={setSearch}
          onPrev={() => setPage((value) => Math.max(0, value - 1))}
          onNext={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
          searchPlaceholder="Cari nama, key, provider, jenis..."
        />
      </div>
    </div>
  );
}
