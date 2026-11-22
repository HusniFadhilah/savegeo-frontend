import { AdminTableNumberCell, AdminTableNumberHeader } from "@/features/admin/components/AdminTableNumber";
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
import { useI18nStore } from "@/hooks/useI18nStore";

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

function statusLabel(status: string | undefined, t: (key: string) => string) {
  if (status === "connected") return t("admin.imageryProviders.connected");
  if (status === "blocked") return t("admin.imageryProviders.blocked");
  if (status === "incomplete_configuration") return t("admin.imageryProviders.incomplete");
  return t("admin.imageryProviders.unconfigured");
}

export default function ImageryProviders() {
  const t = useI18nStore((state) => state.t);
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
      .catch((err) => notify(err instanceof Error ? err.message : t("admin.imageryProviders.loadFailed"), "e"))
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
      notify(t("admin.imageryProviders.metadataSaved", { key }), "s");
      setEditingKey(null);
      setDraft(null);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("admin.imageryProviders.metadataSaveFailed"), "e");
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
      notify(t("admin.imageryProviders.connectionSaved", { name: row.name }), "s");
      setCredential("");
      setConnectionKey(null);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("admin.imageryProviders.connectionSaveFailed"), "e");
    } finally {
      setBusy(false);
    }
  };

  const clearCredential = async (row: ImageryProviderAdminRow) => {
    if (!confirm(t("admin.imageryProviders.clearCredentialConfirm", { name: row.name }))) return;
    setBusy(true);
    try {
      await saveImageryProviderConnection(row.key, { clear_credential: true });
      notify(t("admin.imageryProviders.credentialDeleted", { name: row.name }), "s");
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("admin.imageryProviders.credentialDeleteFailed"), "e");
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
      notify(err instanceof Error ? err.message : t("admin.imageryProviders.statusFailed"), "e");
    } finally {
      setBusy(false);
    }
  };

  const restoreDefaults = async (row: ImageryProviderAdminRow) => {
    if (!row.has_override || !confirm(t("admin.imageryProviders.restoreConfirm", { name: row.name }))) return;
    setBusy(true);
    try {
      await resetImageryProvider(row.key);
      notify(t("admin.imageryProviders.restored", { name: row.name }), "s");
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("admin.imageryProviders.restoreFailed"), "e");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header-custom d-flex align-items-center justify-content-between gap-2">
        <span>{t("admin.imageryProviders.title")}</span>
        <span className="badge bg-secondary">{t("admin.imageryProviders.count", { count: rows.length })}</span>
      </div>
      <div className="card-body-custom">
        <p className="text-muted mb-3" style={{ fontSize: ".85rem" }}>
          <i className="bi bi-info-circle me-1" />
          {t("admin.imageryProviders.description")}
        </p>

        <div style={{ overflowX: "auto" }}>
          <table className="tbl tbl-wide">
            <thead>
              <tr>
                <AdminTableNumberHeader /><th>{t("admin.imageryProviders.provider")}</th><th>{t("admin.imageryProviders.type")}</th><th>{t("admin.imageryProviders.catalogConnection")}</th><th>{t("admin.imageryProviders.active")}</th><th>{t("admin.imageryProviders.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="text-center p-4">{t("admin.imageryProviders.loading")}</td></tr>}
              {!loading && pageRows.length === 0 && <tr><td colSpan={6} className="text-center p-4">{t("admin.imageryProviders.notFound")}</td></tr>}
              {!loading && pageRows.map((row, index) => {
                const editing = editingKey === row.key;
                const editingConnection = connectionKey === row.key;
                const connection = row.connection;
                return (
                  <tr key={row.key}>
                    <AdminTableNumberCell index={index} page={page} pageSize={PAGE_SIZE} />
                    <td colSpan={5} style={{ padding: 0 }}>
                      <div className="d-grid" style={{ gridTemplateColumns: "minmax(180px, 1.3fr) minmax(110px, .7fr) minmax(180px, 1.2fr) 70px minmax(150px, .8fr)", alignItems: "center", gap: ".75rem", padding: ".75rem" }}>
                        <div>
                          <strong>{row.name}</strong><br /><code>{row.key}</code>
                          {!row.is_active && <span className="badge bg-secondary ms-2">{t("admin.imageryProviders.disabled")}</span>}
                        </div>
                        <div><span>{row.group}</span><br /><small className="text-muted">{row.source_kind}</small></div>
                        <div>
                          {connection.supported ? (
                            <><span className={`badge ${connection.status === "connected" ? "bg-success" : connection.status === "blocked" ? "bg-warning text-dark" : "bg-secondary"}`}>
                              {statusLabel(connection.status, t)}
                            </span>{connection.credential_configured && <small className="d-block text-muted mt-1">{t("admin.imageryProviders.credentialSaved")}</small>}</>
                          ) : <small className="text-muted">{t("admin.imageryProviders.builtin")}</small>}
                        </div>
                        <div className="form-check form-switch mb-0">
                          <input className="form-check-input" type="checkbox" checked={row.is_active} onChange={() => toggleActive(row)} aria-label={`${t("admin.imageryProviders.toggleActive")} ${row.name}`} disabled={busy} />
                        </div>
                        <div className="d-flex flex-wrap gap-1">
                          <button type="button" className="btn-sm" onClick={() => editing ? (setEditingKey(null), setDraft(null)) : startEdit(row)} disabled={busy}>
                            <i className={`bi ${editing ? "bi-x-lg" : "bi-pencil"}`} /> {editing ? t("admin.imageryProviders.cancel") : t("admin.imageryProviders.metadata")}
                          </button>
                          {connection.supported && <button type="button" className="btn-sm" onClick={() => editingConnection ? setConnectionKey(null) : startConnectionEdit(row)} disabled={busy}>
                            <i className={`bi ${editingConnection ? "bi-x-lg" : "bi-gear"}`} /> {t("admin.imageryProviders.connection")}
                          </button>}
                          {row.has_override && <button type="button" className="btn-sm danger" title={t("admin.imageryProviders.restoreTitle")} onClick={() => restoreDefaults(row)} disabled={busy}>
                            <i className="bi bi-arrow-counterclockwise" />
                          </button>}
                        </div>
                      </div>

                      {editing && draft && (
                        <div className="border-top p-3 bg-light">
                          <div className="row g-2">
                            <div className="col-md-4"><label className="form-label">{t("admin.imageryProviders.displayName")}</label><input className="form-control form-control-sm" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
                            <div className="col-md-4"><label className="form-label">{t("admin.imageryProviders.provider")}</label><input className="form-control form-control-sm" value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })} /></div>
                            <div className="col-md-4"><label className="form-label">{t("admin.imageryProviders.group")}</label><input className="form-control form-control-sm" value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value })} /></div>
                            <div className="col-md-4"><label className="form-label">{t("admin.imageryProviders.resolution")}</label><input type="number" min="0" step="any" className="form-control form-control-sm" value={draft.resolution_m ?? ""} onChange={(e) => setDraft({ ...draft, resolution_m: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                            <div className="col-md-3"><label className="form-label">{t("admin.imageryProviders.startYear")}</label><input type="number" min="0" className="form-control form-control-sm" value={draft.start_year ?? ""} onChange={(e) => setDraft({ ...draft, start_year: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                            <div className="col-md-3"><label className="form-label">{t("admin.imageryProviders.revisit")}</label><input type="number" min="0" step="any" className="form-control form-control-sm" value={draft.revisit_days ?? ""} onChange={(e) => setDraft({ ...draft, revisit_days: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                            <div className="col-md-3"><label className="form-label">{t("admin.imageryProviders.order")}</label><input type="number" min="0" className="form-control form-control-sm" value={draft.display_order} onChange={(e) => setDraft({ ...draft, display_order: Number(e.target.value) || 0 })} /></div>
                            <div className="col-12"><label className="form-label">{t("admin.imageryProviders.geeCollection")}</label><input className="form-control form-control-sm font-monospace" value={draft.gee_collection ?? ""} onChange={(e) => setDraft({ ...draft, gee_collection: e.target.value })} /></div>
                            <div className="col-md-6"><label className="form-label">{t("admin.imageryProviders.cloudProperty")}</label><input className="form-control form-control-sm font-monospace" value={draft.cloud_property ?? ""} onChange={(e) => setDraft({ ...draft, cloud_property: e.target.value })} placeholder="eo:cloud_cover" /></div>
                            <div className="col-12"><label className="form-label">{t("admin.imageryProviders.descriptionField")}</label><textarea rows={2} className="form-control form-control-sm" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
                          </div>
                          <div className="d-flex justify-content-end mt-3"><button type="button" className="btn-sm primary" onClick={() => saveMetadata(row.key)} disabled={busy}><i className="bi bi-check-lg" /> {t("admin.imageryProviders.saveMetadata")}</button></div>
                        </div>
                      )}

                      {editingConnection && connection.supported && (
                        <div className="border-top p-3 bg-light">
                          {connection.note && <div className="alert alert-warning py-2">{connection.note}</div>}
                          <div className="d-flex align-items-center gap-2 mb-3"><strong>{t("admin.imageryProviders.connectorStatus")}</strong><span className={`badge ${connection.status === "connected" ? "bg-success" : "bg-secondary"}`}>{statusLabel(connection.status, t)}</span><small className="text-muted">{t("admin.imageryProviders.connectionHint")}</small></div>
                          <div className="row g-2">
                            {"catalog_url" in connectionDraft && <div className="col-md-6"><label className="form-label">{t("admin.imageryProviders.catalogSearchUrl")}</label><input type="url" className="form-control form-control-sm" value={connectionDraft.catalog_url ?? ""} onChange={(e) => setConnectionDraft({ ...connectionDraft, catalog_url: e.target.value })} placeholder="https://..." /></div>}
                            {"collection" in connectionDraft && <div className="col-md-6"><label className="form-label">{t("admin.imageryProviders.collection")}</label><input className="form-control form-control-sm" value={connectionDraft.collection ?? ""} onChange={(e) => setConnectionDraft({ ...connectionDraft, collection: e.target.value })} /></div>}
                            {"auth_scheme" in connectionDraft && <div className="col-md-4"><label className="form-label">{t("admin.imageryProviders.authentication")}</label><select className="form-select form-select-sm" value={connectionDraft.auth_scheme ?? "bearer"} onChange={(e) => setConnectionDraft({ ...connectionDraft, auth_scheme: e.target.value })}><option value="bearer">Bearer</option><option value="basic">Basic</option><option value="none">{t("admin.imageryProviders.noAuthentication")}</option></select></div>}
                            {"workspace_id" in connectionDraft && <div className="col-md-6"><label className="form-label">{t("admin.imageryProviders.workspaceId")}</label><input className="form-control form-control-sm" value={connectionDraft.workspace_id ?? ""} onChange={(e) => setConnectionDraft({ ...connectionDraft, workspace_id: e.target.value })} /></div>}
                            {"api_contract_reference" in connectionDraft && <div className="col-md-6"><label className="form-label">{t("admin.imageryProviders.apiReference")}</label><input className="form-control form-control-sm" value={connectionDraft.api_contract_reference ?? ""} onChange={(e) => setConnectionDraft({ ...connectionDraft, api_contract_reference: e.target.value })} /></div>}
                            <div className="col-md-8">
                              <label className="form-label">{t("admin.imageryProviders.credential")} {connection.credential_configured && <small className="text-success">{t("admin.imageryProviders.alreadySaved")}</small>}</label>
                              <input type="password" autoComplete="new-password" className="form-control form-control-sm" value={credential} onChange={(e) => setCredential(e.target.value)} placeholder={connection.credential_configured ? t("admin.imageryProviders.keepCredential") : t("admin.imageryProviders.enterCredential")} disabled={!connection.can_write_credential} />
                              {!connection.can_write_credential && <small className="text-muted">{t("admin.imageryProviders.secretPermission")}</small>}
                            </div>
                          </div>
                          <div className="d-flex justify-content-end gap-2 mt-3">
                            {connection.credential_configured && connection.can_write_credential && <button type="button" className="btn-sm danger" onClick={() => clearCredential(row)} disabled={busy}><i className="bi bi-trash" /> {t("admin.imageryProviders.clearCredential")}</button>}
                            <button type="button" className="btn-sm primary" onClick={() => saveConnection(row)} disabled={busy}><i className="bi bi-shield-lock" /> {t("admin.imageryProviders.saveConnection")}</button>
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
          searchPlaceholder={t("admin.imageryProviders.search")}
        />
      </div>
    </div>
  );
}
