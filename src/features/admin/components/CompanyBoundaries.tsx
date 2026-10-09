import { useRef, useState } from "react";
import { useServerTable } from "@/hooks/useServerTable";
import TablePagination from "@/components/ui/TablePagination";
import {
  deleteCompany,
  getCompanyImportJob,
  importCompaniesFromOSM,
  saveCompany,
  toggleCompanyActive,
} from "../api";
import { INDUSTRY_LABEL, INDUSTRY_OPTIONS, SOURCE_LABEL } from "../types";
import type { CompanyBoundaryFull } from "../types";
import { useAdmin } from "../AdminContext";
import BulkTableToolbar from "./BulkTableToolbar";

const GEOJSON_TYPES = new Set([
  "Feature",
  "FeatureCollection",
  "Polygon",
  "MultiPolygon",
  "GeometryCollection",
  "Point",
  "MultiPoint",
  "LineString",
  "MultiLineString",
]);

/** Validates that text is parseable JSON with a plausible GeoJSON `type`.
 * Only a structural sanity check — the backend still does the real parsing/
 * validation, this just stops obviously-wrong pastes/files client-side. */
function validateGeoJsonText(text: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return "Teks bukan JSON yang valid";
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "GeoJSON harus berupa objek";
  }
  const type = (parsed as { type?: unknown }).type;
  if (typeof type !== "string" || !GEOJSON_TYPES.has(type)) {
    return "Objek tidak memiliki field GeoJSON \"type\" yang valid";
  }
  if (type === "Feature" && !(parsed as { geometry?: unknown }).geometry) {
    return "GeoJSON Feature harus memiliki field \"geometry\"";
  }
  return null;
}

async function waitForCompanyImport(jobId: string, onProgress: (message: string) => void) {
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    const job = await getCompanyImportJob(jobId);
    if (job.status === "completed") {
      if (!job.result) throw new Error("Impor selesai tanpa ringkasan hasil.");
      return job.result;
    }
    if (job.status === "failed") {
      throw new Error(job.error || "Impor gagal. Coba lagi nanti.");
    }
    onProgress(job.message || "Impor sedang diproses...");
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
  }
  throw new Error(`Waktu tunggu status impor habis. ID job: ${jobId}`);
}

export default function CompanyBoundaries() {
  const { notify } = useAdmin();
  const [industryFilter, setIndustryFilter] = useState("");
  const {
    rows, loading, error, page, pageCount, pageSize,
    recordsTotal, recordsFiltered, search, setSearch,
    nextPage, prevPage, reload,
  } = useServerTable<CompanyBoundaryFull>("/admin/companies", {
    extraParams: industryFilter ? { industry_type: industryFilter } : {},
  });
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  // manual add form
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [industryType, setIndustryType] = useState("mining");
  const [subType, setSubType] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [description, setDescription] = useState("");
  const [geojsonFile, setGeojsonFile] = useState<File | null>(null);
  const [geojsonText, setGeojsonText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // import form
  const [importOpen, setImportOpen] = useState(false);
  const [osmTypes, setOsmTypes] = useState<Record<string, boolean>>({
    mining: true,
    forestry: false,
    plantation: false,
    energy: false,
  });
  const [importLog, setImportLog] = useState("");
  const [importing, setImporting] = useState(false);

  const pickFile = (f: File | null) => {
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".geojson") && !lower.endsWith(".json")) {
      setFormError("File harus berformat .geojson atau .json");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setFormError("Ukuran file terlalu besar (maks 20 MB)");
      return;
    }
    setFormError(null);
    setGeojsonFile(f);
    setGeojsonText("");
  };

  const resetForm = () => {
    setName("");
    setCompanyName("");
    setIndustryType("mining");
    setSubType("");
    setProvince("");
    setDistrict("");
    setDescription("");
    setGeojsonFile(null);
    setGeojsonText("");
    setFormError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSaveCompany = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Nama konsesi diperlukan");
      return;
    }
    const text = geojsonText.trim();
    if (!geojsonFile && !text) {
      setFormError("GeoJSON diperlukan (file atau teks)");
      return;
    }
    if (!geojsonFile && text) {
      const err = validateGeoJsonText(text);
      if (err) {
        setFormError(err);
        return;
      }
    }
    if (geojsonFile) {
      // Validate file content is parseable JSON before uploading.
      try {
        const raw = await geojsonFile.text();
        const err = validateGeoJsonText(raw);
        if (err) {
          setFormError(err);
          return;
        }
      } catch {
        setFormError("Gagal membaca file");
        return;
      }
    }
    setSaving(true);
    setFormError(null);
    try {
      const r = await saveCompany({
        name: trimmedName,
        company_name: companyName.trim(),
        industry_type: industryType,
        sub_type: subType.trim(),
        province: province.trim(),
        district: district.trim(),
        description: description.trim(),
        geojsonFile,
        geojsonText: text,
      });
      if ((r as { error?: string }).error) throw new Error((r as { error?: string }).error);
      notify("Batas perusahaan berhasil disimpan", "s");
      setFormOpen(false);
      resetForm();
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan";
      setFormError(msg);
      notify(msg, "e");
    } finally {
      setSaving(false);
    }
  };

  const doToggleActive = async (id: number, isActive: boolean) => {
    setBusyId(id);
    try {
      await toggleCompanyActive(id, isActive);
      await reload();
    } catch {
      notify("Gagal mengubah status", "e");
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async (id: number, name: string) => {
    if (!confirm(`Hapus "${name}"?`)) return;
    setBusyId(id);
    try {
      await deleteCompany(id);
      notify("Batas perusahaan berhasil dihapus", "s");
      await reload();
    } catch {
      notify("Gagal menghapus", "e");
    } finally {
      setBusyId(null);
    }
  };

  const allPageSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  const toggleSelected = (id: number) => setSelectedIds((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));
  const toggleAllPage = () => setSelectedIds((ids) => (allPageSelected ? ids.filter((id) => !rows.some((row) => row.id === id)) : Array.from(new Set([...ids, ...rows.map((row) => row.id)]))));
  const handleBulkDelete = async () => {
    if (!selectedIds.length || !confirm(`Hapus ${selectedIds.length} batas perusahaan terpilih?`)) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(selectedIds.map((id) => deleteCompany(id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    setSelectedIds([]);
    notify(failed ? `${results.length - failed} dihapus, ${failed} gagal` : `${results.length} batas perusahaan dihapus`, failed ? "e" : "s");
    await reload();
    setBulkBusy(false);
  };

  const doImportOSM = async () => {
    const types = Object.entries(osmTypes)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (!types.length) {
      notify("Pilih minimal satu tipe industri", "e");
      return;
    }
    setImporting(true);
    setImportLog("Mengantrekan impor OpenStreetMap...");
    try {
      const job = await importCompaniesFromOSM(types);
      const r = await waitForCompanyImport(job.job_id, setImportLog);
      const completion = r.failed_types?.length ? "Selesai sebagian" : "Selesai";
      const warning = r.warnings?.length ? ` Peringatan: ${r.warnings.join("; ")}` : "";
      setImportLog(`${completion}: ${r.imported} diimpor, ${r.skipped} dilewati.${warning}`);
      await reload();
    } catch (err) {
      setImportLog(`Kesalahan: ${err instanceof Error ? err.message : "Gagal mengimpor data OSM"}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div className="card-header-custom">
        <span>Batas Perusahaan</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="btn-sm primary" onClick={() => setFormOpen((o) => !o)}>
          <i className="bi bi-plus-lg" /> Tambah Manual
          </button>
          <button type="button" className="btn-sm" onClick={() => setImportOpen((o) => !o)}>
            <i className="bi bi-cloud-arrow-down" /> Impor Data Terbuka
          </button>
        </div>
      </div>
      <div className="card-body-custom">
        {/* Manual add form */}
        <div className={`collapse-form ${formOpen ? "open" : ""}`}>
          <div className="two-col" style={{ marginBottom: "0.75rem" }}>
            <div className="form-field">
              <label className="form-label">Nama Konsesi / IUP *</label>
              <input
                className="form-input"
                placeholder="Contoh: PT Tambang Jaya - IUP Batubara"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Nama Perusahaan</label>
              <input
                className="form-input"
                placeholder="Contoh: PT Tambang Jaya"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
          </div>
          <div className="two-col" style={{ marginBottom: "0.75rem" }}>
            <div className="form-field">
              <label className="form-label">Tipe Industri *</label>
              <select className="form-input" value={industryType} onChange={(e) => setIndustryType(e.target.value)}>
                {INDUSTRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Sub-tipe / Jenis Izin</label>
              <input
                className="form-input"
                placeholder="Contoh: IUP, HPH, HGU, PLTU ..."
                value={subType}
                onChange={(e) => setSubType(e.target.value)}
              />
            </div>
          </div>
          <div className="two-col" style={{ marginBottom: "0.75rem" }}>
            <div className="form-field">
              <label className="form-label">Provinsi</label>
              <input
                className="form-input"
                placeholder="Contoh: Kalimantan Timur"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Kabupaten/Kota</label>
              <input
                className="form-input"
                placeholder="Contoh: Kutai Kartanegara"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              />
            </div>
          </div>
          <div className="form-field" style={{ marginBottom: "0.75rem" }}>
            <label className="form-label">Deskripsi</label>
            <input
              className="form-input"
              placeholder="Keterangan tambahan (opsional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="form-field" style={{ marginBottom: "0.75rem" }}>
            <label className="form-label">GeoJSON Batas Wilayah *</label>
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
              <i className="bi bi-map" style={{ fontSize: 20, color: "#94a3b8", marginBottom: 6, display: "block" }} />
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Pilih atau seret dan letakkan file <strong>.geojson / .json</strong>
              </div>
              {geojsonFile && <div style={{ fontSize: 11, color: "#3b82f6", marginTop: 4 }}>{geojsonFile.name}</div>}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".geojson,.json"
              style={{ display: "none" }}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <div style={{ marginTop: 6 }}>
              <label className="form-label" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                atau tempel GeoJSON secara langsung:
              </label>
              <textarea
                className="form-input"
                rows={4}
                placeholder='{"type":"Feature","geometry":{...},"properties":{}}'
                style={{ fontFamily: "monospace", fontSize: 11, resize: "vertical" }}
                value={geojsonText}
                onChange={(e) => {
                  setGeojsonText(e.target.value);
                  setGeojsonFile(null);
                }}
              />
            </div>
          </div>
          {formError && <div className="alert alert-danger py-1 px-2 small">{formError}</div>}
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn-sm primary" disabled={saving} onClick={handleSaveCompany}>
              <i className="bi bi-save" /> {saving ? "Menyimpan..." : "Simpan"}
            </button>
            <button type="button" className="btn-sm" onClick={() => setFormOpen(false)}>
              Batal
            </button>
          </div>
        </div>

        {/* Import open data form */}
        <div className={`collapse-form ${importOpen ? "open" : ""}`}>
          <div style={{ marginBottom: "0.75rem", fontSize: 12, color: "var(--text-muted)" }}>
            OpenStreetMap diproses di latar belakang. Konsesi Indonesia dari GFW saat ini hanya tersedia untuk tampilan, bukan unduhan; unggah GeoJSON yang Anda miliki hak aksesnya melalui formulir batas perusahaan.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "0.75rem" }}>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>OpenStreetMap (Overpass API)</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {INDUSTRY_OPTIONS.map((o) => (
                <label key={o.value} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={osmTypes[o.value] ?? false}
                    onChange={(e) => setOsmTypes((s) => ({ ...s, [o.value]: e.target.checked }))}
                  />{" "}
                  {o.label.split(" (")[0]}
                </label>
              ))}
            </div>
            <button type="button" className="btn-sm primary" disabled={importing} onClick={doImportOSM}>
              <i className="bi bi-geo-alt" /> Impor dari OSM
            </button>
            <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>Global Forest Watch (GFW)</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Data konsesi Indonesia dari GFW dibatasi hanya untuk tampilan oleh WRI, jadi tidak dapat diimpor langsung.
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", minHeight: 20 }}>{importLog}</div>
          <div style={{ marginTop: 6 }}>
            <button type="button" className="btn-sm" onClick={() => setImportOpen(false)}>
              Tutup
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="form-input"
            placeholder="Cari nama..."
            style={{ maxWidth: 200 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-input"
            style={{ maxWidth: 160 }}
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
          >
            <option value="">Semua tipe</option>
            {INDUSTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label.split(" (")[0]}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{!loading && `${recordsFiltered} entri`}</span>
        </div>

        <BulkTableToolbar selectedCount={selectedIds.length} onClear={() => setSelectedIds([])}>
          <button type="button" className="btn-sm danger" disabled={bulkBusy} onClick={handleBulkDelete}>
            <i className="bi bi-trash" /> {bulkBusy ? "Menghapus..." : "Hapus terpilih"}
          </button>
        </BulkTableToolbar>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table className="tbl tbl-wide">
            <colgroup>
              <col style={{ width: "3.5rem" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead>
              <tr>
                <th><input className="admin-table-check" type="checkbox" aria-label="Pilih semua batas perusahaan di halaman" checked={allPageSelected} onChange={toggleAllPage} /></th>
                <th>Nama Konsesi</th>
                <th>Perusahaan</th>
                <th>Tipe</th>
                <th>Sub-tipe</th>
                <th>Provinsi</th>
                <th>Luas (ha)</th>
                <th>Sumber</th>
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
              {!loading && error && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "var(--danger-color, #e53935)", padding: "1.5rem" }}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    Belum ada data. Tambahkan secara manual atau impor dari sumber data terbuka.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                rows.map((c) => (
                  <tr key={c.id}>
                    <td><input className="admin-table-check" type="checkbox" aria-label={`Pilih ${c.name}`} checked={selectedIds.includes(c.id)} onChange={() => toggleSelected(c.id)} /></td>
                    <td title={c.name}>{c.name.length > 30 ? `${c.name.slice(0, 28)}…` : c.name}</td>
                    <td>{c.company_name || "—"}</td>
                    <td>
                      <span className="badge-label">{INDUSTRY_LABEL[c.industry_type] || c.industry_type}</span>
                    </td>
                    <td>{c.sub_type || "—"}</td>
                    <td>{c.province || "—"}</td>
                    <td>{c.area_ha ? c.area_ha.toLocaleString("id-ID", { maximumFractionDigits: 1 }) : "—"}</td>
                    <td style={{ fontSize: 10 }}>{SOURCE_LABEL[c.source] || c.source}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-sm"
                        style={{ padding: "2px 6px", fontSize: 10 }}
                        title={c.is_active ? "Nonaktifkan" : "Aktifkan"}
                        disabled={busyId === c.id || bulkBusy}
                        onClick={() => doToggleActive(c.id, c.is_active)}
                      >
                        <i className={`bi ${c.is_active ? "bi-eye" : "bi-eye-slash"}`} />
                      </button>
                      <button
                        type="button"
                        className="btn-sm danger"
                        style={{ padding: "2px 6px", fontSize: 10 }}
                        disabled={busyId === c.id || bulkBusy}
                        onClick={() => doDelete(c.id, c.name)}
                      >
                        <i className="bi bi-trash" />
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
          recordsTotal={recordsTotal}
          recordsFiltered={recordsFiltered}
          pageSize={pageSize}
          search={search}
          onSearchChange={setSearch}
          onPrev={prevPage}
          onNext={nextPage}
          searchPlaceholder="Cari nama, perusahaan..."
          showSearch={false}
        />
      </div>
    </div>
  );
}
