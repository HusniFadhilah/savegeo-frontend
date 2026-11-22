import { AdminTableNumberCell, AdminTableNumberHeader } from "@/features/admin/components/AdminTableNumber";
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
import { INDUSTRY_OPTIONS } from "../types";
import type { CompanyBoundaryFull } from "../types";
import { useAdmin } from "../AdminContext";
import BulkTableToolbar from "./BulkTableToolbar";
import { localeFor, useI18nStore } from "@/hooks/useI18nStore";

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
function validateGeoJsonText(text: string, t: (key: string) => string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return t("admin.company.invalidGeoJson");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return t("admin.company.geoJsonObject");
  }
  const type = (parsed as { type?: unknown }).type;
  if (typeof type !== "string" || !GEOJSON_TYPES.has(type)) {
    return t("admin.company.geoJsonType");
  }
  if (type === "Feature" && !(parsed as { geometry?: unknown }).geometry) {
    return t("admin.company.geoJsonGeometry");
  }
  return null;
}

async function waitForCompanyImport(jobId: string, onProgress: (message: string) => void, t: (key: string, params?: Record<string, string | number>) => string) {
  // The backend queries Overpass region by region and splits slow regions,
  // so a nationwide multi-industry import can take well over 15 minutes.
  const deadline = Date.now() + 60 * 60 * 1000;
  while (Date.now() < deadline) {
    const job = await getCompanyImportJob(jobId);
    if (job.status === "completed") {
      if (!job.result) throw new Error(t("admin.company.importNoSummary"));
      return job.result;
    }
    if (job.status === "failed") {
      throw new Error(job.error || t("admin.company.importFailed"));
    }
    onProgress(job.message || t("admin.company.importProcessing"));
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
  }
  throw new Error(t("admin.company.importTimeout", { jobId }));
}

export default function CompanyBoundaries() {
  const t = useI18nStore((state) => state.t);
  const language = useI18nStore((state) => state.language);
  const locale = localeFor(language);
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
  const industryLabel = (value: string) => t(`admin.company.industry.${value}`);
  const sourceLabel = (value: string) => t(`admin.company.source.${value}`);

  const pickFile = (f: File | null) => {
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".geojson") && !lower.endsWith(".json")) {
      setFormError(t("admin.company.fileFormat"));
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setFormError(t("admin.company.fileTooLarge"));
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
      setFormError(t("admin.company.nameRequiredError"));
      return;
    }
    const text = geojsonText.trim();
    if (!geojsonFile && !text) {
      setFormError(t("admin.company.geoJsonRequiredError"));
      return;
    }
    if (!geojsonFile && text) {
      const err = validateGeoJsonText(text, t);
      if (err) {
        setFormError(err);
        return;
      }
    }
    if (geojsonFile) {
      // Validate file content is parseable JSON before uploading.
      try {
        const raw = await geojsonFile.text();
        const err = validateGeoJsonText(raw, t);
        if (err) {
          setFormError(err);
          return;
        }
      } catch {
        setFormError(t("admin.company.fileReadFailed"));
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
      notify(t("admin.company.saved"), "s");
      setFormOpen(false);
      resetForm();
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("admin.company.saveFailed");
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
      notify(t("admin.company.statusFailed"), "e");
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async (id: number, name: string) => {
    if (!confirm(t("admin.company.deleteConfirm", { name }))) return;
    setBusyId(id);
    try {
      await deleteCompany(id);
      notify(t("admin.company.deleted"), "s");
      await reload();
    } catch {
      notify(t("admin.company.deleteFailed"), "e");
    } finally {
      setBusyId(null);
    }
  };

  const allPageSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  const toggleSelected = (id: number) => setSelectedIds((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));
  const toggleAllPage = () => setSelectedIds((ids) => (allPageSelected ? ids.filter((id) => !rows.some((row) => row.id === id)) : Array.from(new Set([...ids, ...rows.map((row) => row.id)]))));
  const handleBulkDelete = async () => {
    if (!selectedIds.length || !confirm(t("admin.company.bulkDeleteConfirm", { count: selectedIds.length }))) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(selectedIds.map((id) => deleteCompany(id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    setSelectedIds([]);
    notify(failed ? t("admin.company.bulkDeletedPartial", { success: results.length - failed, failed }) : t("admin.company.bulkDeleted", { count: results.length }), failed ? "e" : "s");
    await reload();
    setBulkBusy(false);
  };

  const doImportOSM = async () => {
    const types = Object.entries(osmTypes)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (!types.length) {
      notify(t("admin.company.chooseIndustry"), "e");
      return;
    }
    setImporting(true);
    setImportLog(t("admin.company.importQueue"));
    try {
      const job = await importCompaniesFromOSM(types);
      const r = await waitForCompanyImport(job.job_id, setImportLog, t);
      const completion = r.failed_types?.length ? t("admin.company.importPartial") : t("admin.company.importComplete");
      const warning = r.warnings?.length ? t("admin.company.importWarning", { warnings: r.warnings.join("; ") }) : "";
      setImportLog(`${t("admin.company.importSummary", { completion, imported: r.imported, skipped: r.skipped })}${warning}`);
      await reload();
    } catch (err) {
      setImportLog(t("admin.company.importError", { error: err instanceof Error ? err.message : t("admin.company.importFailed") }));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div className="card-header-custom">
        <span>{t("admin.company.title")}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="btn-sm primary" onClick={() => setFormOpen((o) => !o)}>
          <i className="bi bi-plus-lg" /> {t("admin.company.addManual")}
          </button>
          <button type="button" className="btn-sm" onClick={() => setImportOpen((o) => !o)}>
            <i className="bi bi-cloud-arrow-down" /> {t("admin.company.openData")}
          </button>
        </div>
      </div>
      <div className="card-body-custom">
        {/* Manual add form */}
        <div className={`collapse-form ${formOpen ? "open" : ""}`}>
          <div className="two-col" style={{ marginBottom: "0.75rem" }}>
            <div className="form-field">
              <label className="form-label">{t("admin.company.nameRequired")}</label>
              <input
                className="form-input"
                placeholder={t("admin.company.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">{t("admin.company.companyName")}</label>
              <input
                className="form-input"
                placeholder={t("admin.company.companyPlaceholder")}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
          </div>
          <div className="two-col" style={{ marginBottom: "0.75rem" }}>
            <div className="form-field">
              <label className="form-label">{t("admin.company.industry")}</label>
              <select className="form-input" value={industryType} onChange={(e) => setIndustryType(e.target.value)}>
                {INDUSTRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {industryLabel(o.value)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">{t("admin.company.subtype")}</label>
              <input
                className="form-input"
                placeholder={t("admin.company.subtypePlaceholder")}
                value={subType}
                onChange={(e) => setSubType(e.target.value)}
              />
            </div>
          </div>
          <div className="two-col" style={{ marginBottom: "0.75rem" }}>
            <div className="form-field">
              <label className="form-label">{t("admin.company.province")}</label>
              <input
                className="form-input"
                placeholder={t("admin.company.provincePlaceholder")}
                value={province}
                onChange={(e) => setProvince(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">{t("admin.company.district")}</label>
              <input
                className="form-input"
                placeholder={t("admin.company.districtPlaceholder")}
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              />
            </div>
          </div>
          <div className="form-field" style={{ marginBottom: "0.75rem" }}>
            <label className="form-label">{t("admin.company.description")}</label>
            <input
              className="form-input"
              placeholder={t("admin.company.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="form-field" style={{ marginBottom: "0.75rem" }}>
            <label className="form-label">{t("admin.company.geojsonRequired")}</label>
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
                {t("admin.company.dropFile")} <strong>.geojson / .json</strong>
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
                {t("admin.company.pasteGeojson")}
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
              <i className="bi bi-save" /> {saving ? t("admin.company.saving") : t("admin.company.save")}
            </button>
            <button type="button" className="btn-sm" onClick={() => setFormOpen(false)}>
              {t("admin.company.cancel")}
            </button>
          </div>
        </div>

        {/* Import open data form */}
        <div className={`collapse-form ${importOpen ? "open" : ""}`}>
          <div style={{ marginBottom: "0.75rem", fontSize: 12, color: "var(--text-muted)" }}>
            {t("admin.company.importOsmNotice")}
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
                  {industryLabel(o.value).split(" (")[0]}
                </label>
              ))}
            </div>
            <button type="button" className="btn-sm primary" disabled={importing} onClick={doImportOSM}>
              <i className="bi bi-geo-alt" /> {t("admin.company.importOsm")}
            </button>
            <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>Global Forest Watch (GFW)</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {t("admin.company.gfwNotice")}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", minHeight: 20 }}>{importLog}</div>
          <div style={{ marginTop: 6 }}>
            <button type="button" className="btn-sm" onClick={() => setImportOpen(false)}>
              {t("admin.company.close")}
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="form-input"
            placeholder={t("admin.company.searchPlaceholder")}
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
            <option value="">{t("admin.company.allIndustryTypes")}</option>
            {INDUSTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {industryLabel(o.value).split(" (")[0]}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{!loading && t("admin.company.recordCount", { count: recordsFiltered })}</span>
        </div>

        <BulkTableToolbar selectedCount={selectedIds.length} onClear={() => setSelectedIds([])}>
          <button type="button" className="btn-sm danger" disabled={bulkBusy} onClick={handleBulkDelete}>
            <i className="bi bi-trash" /> {bulkBusy ? t("admin.company.deleting") : t("admin.company.deleteSelected")}
          </button>
        </BulkTableToolbar>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table className="tbl tbl-wide">
            <colgroup>
              <col className="admin-table-selection-col" />
              <col className="admin-table-number-col" />
              <col style={{ width: "calc(22% - 1.43rem)" }} />
              <col style={{ width: "calc(18% - 1.17rem)" }} />
              <col style={{ width: "calc(11% - 0.715rem)" }} />
              <col style={{ width: "calc(10% - 0.65rem)" }} />
              <col style={{ width: "calc(13% - 0.845rem)" }} />
              <col style={{ width: "calc(10% - 0.65rem)" }} />
              <col style={{ width: "calc(8% - 0.52rem)" }} />
              <col style={{ width: "calc(8% - 0.52rem)" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="admin-table-selection"><input className="admin-table-check" type="checkbox" aria-label={t("admin.company.selectAll")} checked={allPageSelected} onChange={toggleAllPage} /></th>
                <AdminTableNumberHeader />
                <th>{t("admin.company.concessionName")}</th>
                <th>{t("admin.company.company")}</th>
                <th>{t("admin.company.type")}</th>
                <th>{t("admin.company.subtypeColumn")}</th>
                <th>{t("admin.company.province")}</th>
                <th>{t("admin.company.area")}</th>
                <th>{t("admin.company.source")}</th>
                <th>{t("admin.company.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    {t("admin.company.loading")}
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", color: "var(--danger-color, #e53935)", padding: "1.5rem" }}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    {t("admin.company.none")}
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                rows.map((c, index) => (
                  <tr key={c.id}>
                    <td className="admin-table-selection"><input className="admin-table-check" type="checkbox" aria-label={t("admin.company.selectRow", { name: c.name })} checked={selectedIds.includes(c.id)} onChange={() => toggleSelected(c.id)} /></td>
                    <AdminTableNumberCell index={index} page={page} pageSize={pageSize} />
                    <td title={c.name}>{c.name.length > 30 ? `${c.name.slice(0, 28)}…` : c.name}</td>
                    <td>{c.company_name || "—"}</td>
                    <td>
                      <span className="badge-label">{industryLabel(c.industry_type)}</span>
                    </td>
                    <td>{c.sub_type || "—"}</td>
                    <td>{c.province || "—"}</td>
                    <td>{c.area_ha ? c.area_ha.toLocaleString(locale, { maximumFractionDigits: 1 }) : "—"}</td>
                    <td style={{ fontSize: 10 }}>{sourceLabel(c.source)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-sm"
                        style={{ padding: "2px 6px", fontSize: 10 }}
                        title={c.is_active ? t("admin.disabled") : t("admin.enabled")}
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
          searchPlaceholder={t("admin.company.searchPlaceholder")}
          showSearch={false}
        />
      </div>
    </div>
  );
}
