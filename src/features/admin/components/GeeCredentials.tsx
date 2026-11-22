import {
  AdminTableNumberCell,
  AdminTableNumberHeader,
} from "@/features/admin/components/AdminTableNumber";
import { useRef, useState } from "react";
import {
  activateGeeCredential,
  deleteGeeCredential,
  uploadGeeCredential,
  probeGeeCredential,
} from "../api";
import type { GeeCredential } from "../types";
import { useAdmin } from "../AdminContext";
import { useServerTable } from "@/hooks/useServerTable";
import TablePagination from "@/components/ui/TablePagination";
import BulkTableToolbar from "./BulkTableToolbar";
import { localeFor, useI18nStore } from "@/hooks/useI18nStore";

const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1 MB — service-account JSON keys are tiny

export default function GeeCredentials() {
  const t = useI18nStore((state) => state.t);
  const language = useI18nStore((state) => state.language);
  const locale = localeFor(language);
  const { notify, refreshHealth } = useAdmin();
  const {
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
    nextPage,
    prevPage,
    reload,
  } = useServerTable<GeeCredential>("/admin/gee/credentials");

  const [formOpen, setFormOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [activateOnUpload, setActivateOnUpload] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const validateFile = (f: File): string | null => {
    if (!f.name.toLowerCase().endsWith(".json")) return t("admin.gee.fileJsonOnly");
    if (f.size > MAX_FILE_BYTES) return t("admin.gee.fileTooLarge");
    return null;
  };

  const pickFile = (f: File | null) => {
    if (!f) return;
    const err = validateFile(f);
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) {
      setFormError(t("admin.gee.chooseFileFirst"));
      return;
    }
    setUploading(true);
    setFormError(null);
    try {
      const result = await uploadGeeCredential(file, label, notes, activateOnUpload);
      notify(
        result.activation_error
          ? t("admin.gee.savedActivationFailed", { error: result.activation_error })
          : t("admin.gee.uploaded"),
        result.activation_error ? "e" : "s",
      );
      setFormOpen(false);
      setFile(null);
      setLabel("");
      setNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await reload();
      refreshHealth();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("admin.gee.uploadFailed");
      setFormError(msg);
      notify(msg, "e");
    } finally {
      setUploading(false);
    }
  };

  const handleActivate = async (id: number) => {
    setBusyId(id);
    try {
      await activateGeeCredential(id);
      notify(t("admin.gee.activated"), "s");
      await reload();
      refreshHealth();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("admin.gee.activateFailed"), "e");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("admin.gee.deleteConfirm"))) return;
    setBusyId(id);
    try {
      await deleteGeeCredential(id);
      notify(t("admin.gee.deleted"), "s");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("admin.gee.deleteFailed"), "e");
    } finally {
      setBusyId(null);
    }
  };

  const handleProbe = async (id: number) => {
    if (busyId !== null) return;
    setBusyId(id);
    try {
      const result = await probeGeeCredential(id);
      notify(
        result.ok
          ? t("admin.gee.connectionChecked")
          : t("admin.gee.connectionFailed", { code: result.code }),
        result.ok ? "s" : "e",
      );
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : t("admin.gee.probeFailedMessage"), "e");
    } finally {
      await reload();
      setBusyId(null);
    }
  };

  const selectableRows = rows.filter((row) => !row.is_active);
  const allPageSelected =
    selectableRows.length > 0 && selectableRows.every((row) => selectedIds.includes(row.id));
  const toggleSelected = (id: number) =>
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id],
    );
  const toggleAllPage = () =>
    setSelectedIds((ids) =>
      allPageSelected
        ? ids.filter((id) => !selectableRows.some((row) => row.id === id))
        : Array.from(new Set([...ids, ...selectableRows.map((row) => row.id)])),
    );
  const handleBulkDelete = async () => {
    if (
      !selectedIds.length ||
      !confirm(t("admin.gee.bulkDeleteConfirm", { count: selectedIds.length }))
    )
      return;
    setBulkBusy(true);
    const results = await Promise.allSettled(selectedIds.map((id) => deleteGeeCredential(id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    setSelectedIds([]);
    notify(
      failed
        ? t("admin.gee.bulkDeletedPartial", { success: results.length - failed, failed })
        : t("admin.gee.bulkDeleted", { count: results.length }),
      failed ? "e" : "s",
    );
    await reload();
    setBulkBusy(false);
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>{t("admin.gee.title")}</span>
        <button type="button" className="btn-sm primary" onClick={() => setFormOpen((o) => !o)}>
          <i className="bi bi-plus-lg" /> {t("admin.gee.uploadCredentials")}
        </button>
      </div>
      <div className="card-body-custom">
        <div className={`collapse-form ${formOpen ? "open" : ""}`}>
          <div className="two-col" style={{ marginBottom: "0.75rem" }}>
            <div className="form-field">
              <label className="form-label">{t("admin.gee.label")}</label>
              <input
                className="form-input"
                placeholder={t("admin.gee.labelPlaceholder")}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">{t("admin.gee.note")}</label>
              <input
                className="form-input"
                placeholder={t("admin.gee.notePlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">{t("admin.gee.jsonFile")}</label>
            <div
              className={`upload-zone ${dragOver ? "dragover" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files[0] ?? null);
              }}
            >
              <i
                className="bi bi-filetype-json"
                style={{ fontSize: 20, color: "#94a3b8", marginBottom: 6, display: "block" }}
              />
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {t("admin.gee.dropFile")} <strong>.json</strong> {t("admin.gee.serviceAccountHere")}
              </div>
              {file && (
                <div style={{ fontSize: 11, color: "#3b82f6", marginTop: 4 }}>✓ {file.name}</div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "0.75rem" }}>
            <input
              type="checkbox"
              id="gee-activate"
              checked={activateOnUpload}
              onChange={(e) => setActivateOnUpload(e.target.checked)}
            />
            <label htmlFor="gee-activate" style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {t("admin.gee.activateAfterUpload")}
            </label>
          </div>
          {formError && <div className="alert alert-danger py-1 px-2 small">{formError}</div>}
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="btn-sm primary"
              disabled={uploading}
              onClick={handleUpload}
            >
              <i className="bi bi-upload" /> {uploading ? t("admin.gee.uploading") : t("admin.gee.upload")}
            </button>
            <button type="button" className="btn-sm" onClick={() => setFormOpen(false)}>
              {t("admin.gee.cancel")}
            </button>
          </div>
        </div>

        <BulkTableToolbar selectedCount={selectedIds.length} onClear={() => setSelectedIds([])}>
          <button
            type="button"
            className="btn-sm danger"
            disabled={bulkBusy}
            onClick={handleBulkDelete}
          >
            <i className="bi bi-trash" /> {bulkBusy ? t("admin.gee.removing") : t("admin.gee.removeSelected")}
          </button>
        </BulkTableToolbar>

        <div style={{ overflowX: "auto" }}>
          <table className="tbl tbl-wide">
            <colgroup>
              <col className="admin-table-selection-col" />
              <col className="admin-table-number-col" />
              <col style={{ width: "calc(15% - 0.975rem)" }} />
              <col style={{ width: "calc(14% - 0.91rem)" }} />
              <col style={{ width: "calc(25% - 1.625rem)" }} />
              <col style={{ width: "calc(10% - 0.65rem)" }} />
              <col style={{ width: "calc(12% - 0.78rem)" }} />
              <col style={{ width: "calc(24% - 1.56rem)" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="admin-table-selection">
                  <input
                    className="admin-table-check"
                    type="checkbox"
                    aria-label={t("admin.gee.checkAllInactive")}
                    checked={allPageSelected}
                    onChange={toggleAllPage}
                  />
                </th>
                <AdminTableNumberHeader />
                <th>{t("admin.gee.labelColumn")}</th>
                <th>{t("admin.gee.projectId")}</th>
                <th>{t("admin.gee.email")}</th>
                <th>{t("admin.gee.status")}</th>
                <th>{t("admin.gee.uploadDate")}</th>
                <th>{t("admin.gee.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={8}
                    style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}
                  >
                    {t("admin.gee.loading")}
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      textAlign: "center",
                      color: "var(--danger-color, #e53935)",
                      padding: "1.5rem",
                    }}
                  >
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}
                  >
                    {t("admin.gee.noCredentials")}
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                rows.map((c, index) => (
                  <tr key={c.id}>
                    <td className="admin-table-selection">
                      <input
                        className="admin-table-check"
                        type="checkbox"
                        aria-label={`${t("admin.gee.selectCredential")} ${c.label}`}
                        checked={selectedIds.includes(c.id)}
                        disabled={c.is_active}
                        onChange={() => toggleSelected(c.id)}
                      />
                    </td>
                    <AdminTableNumberCell index={index} page={page} pageSize={pageSize} />
                    <td title={c.label}>{c.label}</td>
                    <td className="tbl-mono" title={c.project_id}>
                      {c.project_id}
                    </td>
                    <td style={{ fontSize: 10 }} title={c.client_email}>
                      {c.client_email?.slice(0, 26)}…
                    </td>
                    <td>
                      <span className={`stat-badge ${c.is_active ? "badge-green" : "badge-gray"}`}>
                        {c.is_active ? t("admin.enabled") : t("admin.gee.inactive")}
                      </span>
                      <div
                        className="small mt-1"
                        title={
                          c.last_checked_at
                            ? new Date(c.last_checked_at).toLocaleString(locale)
                            : undefined
                        }
                      >
                        {c.last_check_status === "ok" ? (
                          <span className="text-success">
                            <i className="bi bi-check-circle me-1" aria-hidden="true" />
                            {t("admin.gee.connected")}
                          </span>
                        ) : c.last_check_status === "failed" ? (
                          <span className="text-danger">
                            {c.last_check_code || t("admin.gee.probeFailed")}
                          </span>
                        ) : (
                          <span className="text-body-secondary">{t("admin.gee.notChecked")}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {c.uploaded_at ? new Date(c.uploaded_at).toLocaleDateString(locale) : "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-sm"
                        disabled={busyId !== null || bulkBusy || uploading}
                        onClick={() => void handleProbe(c.id)}
                        aria-label={`${t("admin.gee.checkConnection")} ${c.label}`}
                      >
                        <i className="bi bi-plug me-1" aria-hidden="true" />
                        {t("admin.gee.check")}
                      </button>
                      {!c.is_active ? (
                        <>
                          <button
                            type="button"
                            className="btn-sm success"
                            disabled={busyId === c.id || bulkBusy}
                            onClick={() => handleActivate(c.id)}
                          >
                            {t("admin.gee.activate")}
                          </button>
                          <button
                            type="button"
                            className="btn-sm danger"
                            style={{ marginLeft: 3 }}
                            disabled={busyId === c.id || bulkBusy}
                            onClick={() => handleDelete(c.id)}
                          >
                            {t("admin.delete")}
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{t("admin.enabled")}</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          pageCount={pageCount}
          recordsTotal={recordsTotal}
          recordsFiltered={recordsFiltered}
          pageSize={pageSize}
          search={search}
          onSearchChange={setSearch}
          onPrev={prevPage}
          onNext={nextPage}
          searchPlaceholder={t("admin.gee.search")}
        />
      </div>
    </div>
  );
}
