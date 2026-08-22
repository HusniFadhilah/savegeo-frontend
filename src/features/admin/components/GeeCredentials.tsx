import { useRef, useState } from "react";
import { activateGeeCredential, deleteGeeCredential, uploadGeeCredential } from "../api";
import type { GeeCredential } from "../types";
import { useAdmin } from "../AdminContext";
import { useServerTable } from "@/hooks/useServerTable";
import TablePagination from "@/components/ui/TablePagination";

const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1 MB — service-account JSON keys are tiny

export default function GeeCredentials() {
  const { notify, refreshHealth } = useAdmin();
  const {
    rows, loading, error, page, pageCount, pageSize,
    recordsTotal, recordsFiltered, search, setSearch,
    nextPage, prevPage, reload,
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

  const validateFile = (f: File): string | null => {
    if (!f.name.toLowerCase().endsWith(".json")) return "File harus berformat .json";
    if (f.size > MAX_FILE_BYTES) return "Ukuran file terlalu besar (maks 1 MB)";
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
      setFormError("Pilih file JSON terlebih dahulu");
      return;
    }
    setUploading(true);
    setFormError(null);
    try {
      await uploadGeeCredential(file, label, notes, activateOnUpload);
      notify("Credential berhasil diupload", "s");
      setFormOpen(false);
      setFile(null);
      setLabel("");
      setNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await reload();
      refreshHealth();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal upload";
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
      notify("Credential diaktifkan, EE diinisialisasi ulang", "s");
      await reload();
      refreshHealth();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal aktivasi", "e");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus credential ini?")) return;
    setBusyId(id);
    try {
      await deleteGeeCredential(id);
      notify("Credential dihapus", "s");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal hapus", "e");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>Service account credentials</span>
        <button type="button" className="btn-sm primary" onClick={() => setFormOpen((o) => !o)}>
          <i className="bi bi-plus-lg" /> Upload credential
        </button>
      </div>
      <div className="card-body-custom">
        <div className={`collapse-form ${formOpen ? "open" : ""}`}>
          <div className="two-col" style={{ marginBottom: "0.75rem" }}>
            <div className="form-field">
              <label className="form-label">Label / nama deskriptif</label>
              <input
                className="form-input"
                placeholder="cth: Production SA 2025"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Catatan (opsional)</label>
              <input
                className="form-input"
                placeholder="Digunakan untuk produksi"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">File JSON service account</label>
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
              <i className="bi bi-filetype-json" style={{ fontSize: 20, color: "#94a3b8", marginBottom: 6, display: "block" }} />
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Klik atau drag &amp; drop file <strong>.json</strong> service account di sini
              </div>
              {file && <div style={{ fontSize: 11, color: "#3b82f6", marginTop: 4 }}>✓ {file.name}</div>}
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
              Langsung aktifkan setelah upload
            </label>
          </div>
          {formError && <div className="alert alert-danger py-1 px-2 small">{formError}</div>}
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn-sm primary" disabled={uploading} onClick={handleUpload}>
              <i className="bi bi-upload" /> {uploading ? "Mengupload..." : "Upload"}
            </button>
            <button type="button" className="btn-sm" onClick={() => setFormOpen(false)}>
              Batal
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="tbl tbl-wide">
            <colgroup>
              <col style={{ width: "15%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "25%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "24%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Label</th>
                <th>Project ID</th>
                <th>Email</th>
                <th>Status</th>
                <th>Diupload</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--danger-color, #e53935)", padding: "1.5rem" }}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    Belum ada credential. Upload service account JSON.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                rows.map((c) => (
                  <tr key={c.id}>
                    <td title={c.label}>{c.label}</td>
                    <td className="tbl-mono" title={c.project_id}>
                      {c.project_id}
                    </td>
                    <td style={{ fontSize: 10 }} title={c.client_email}>
                      {c.client_email?.slice(0, 26)}…
                    </td>
                    <td>
                      <span className={`stat-badge ${c.is_active ? "badge-green" : "badge-gray"}`}>
                        {c.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {c.uploaded_at ? new Date(c.uploaded_at).toLocaleDateString("id-ID") : "—"}
                    </td>
                    <td>
                      {!c.is_active ? (
                        <>
                          <button
                            type="button"
                            className="btn-sm success"
                            disabled={busyId === c.id}
                            onClick={() => handleActivate(c.id)}
                          >
                            Aktifkan
                          </button>
                          <button
                            type="button"
                            className="btn-sm danger"
                            style={{ marginLeft: 3 }}
                            disabled={busyId === c.id}
                            onClick={() => handleDelete(c.id)}
                          >
                            Hapus
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>aktif</span>
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
          searchPlaceholder="Cari label, project ID, email..."
        />
      </div>
    </div>
  );
}
