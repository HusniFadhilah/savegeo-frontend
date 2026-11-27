import { useState, type FormEvent } from "react";
import { newIdempotencyKey } from "../api";
import { getRecord, importValidation, saveBlob, saveRecord } from "./api";
import { EvidenceField, Field, RecordList, type SectionProps } from "./shared";
import { errorMessage, number, references, useCopy } from "./helpers";
import type { IntegrityRecord, RegistryCheck } from "./types";

export function ValidationPanel(props: SectionProps) {
  const c = useCopy();
  const [form, setForm] = useState({
    title: "",
    pool: "AGB",
    product: "",
    reference_year: "",
    predictor_year: "",
    label_source: "field_measurements",
    unit: "Mg_C_ha",
    provenance: "",
    block_degrees: "0.1",
    buffer_km: "10",
    evidence: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [current, setCurrent] = useState<IntegrityRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = (key: keyof typeof form, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    if ((!file && !current) || busy) return;
    setBusy(true);
    setError("");
    try {
      const metadata = {
        ...form,
        reference_year: Number(form.reference_year),
        predictor_year: Number(form.predictor_year),
        block_degrees: Number(form.block_degrees),
        buffer_km: Number(form.buffer_km),
        evidence: references(form.evidence),
      };
      if (file)
        await importValidation(
          props.projectId,
          file,
          metadata,
          current?.record_key || newIdempotencyKey(),
          current?.revision || 0,
        );
      else if (current) {
        const { title, ...payload } = metadata;
        await saveRecord(
          props.projectId,
          "validation",
          current.record_key,
          { title, status: "draft", payload: { ...payload, pairs: current.payload.pairs } },
          current.revision,
        );
      }
      await props.onChanged();
      setCurrent(null);
      setFile(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function edit(record: IntegrityRecord) {
    setBusy(true);
    setError("");
    try {
      const full = await getRecord(props.projectId, record.id);
      setCurrent(full);
      setFile(null);
      const payload = full.payload;
      setForm(
        (old) =>
          Object.fromEntries(
            Object.keys(old).map((key) => [
              key,
              key === "title"
                ? full.title
                : key === "evidence" && Array.isArray(payload.evidence)
                  ? payload.evidence.join("\n")
                  : String(payload[key] ?? ""),
            ]),
          ) as typeof old,
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  function template() {
    saveBlob(
      new Blob(
        [
          "point_id,lon,lat,observed,predicted\nplot_001,110.10,-7.10,42.0,38.0\nplot_002,110.30,-7.30,56.0,61.0\nplot_003,110.50,-7.50,28.0,31.0\n",
        ],
        { type: "text/csv" },
      ),
      "validation-template-ILLUSTRATIVE.csv",
    );
  }
  return (
    <>
      <p className="integrity-note">
        {c(
          "Unggah pasangan observasi dan prediksi dengan satuan yang sama. Kalibrasi linear menggunakan 3 fold blok spasial dan buffer jarak. Holdout ini menguji kalibrasi; independensi pelatihan model peta tetap harus dibuktikan lewat provenance.",
          "Upload observations and predictions in matching units. Linear calibration uses 3 spatial folds and a distance buffer. This holdout tests calibration; independence of upstream map training still needs provenance evidence.",
        )}
      </p>
      {props.canWrite ? (
        <form className="integrity-editor" onSubmit={(e) => void submit(e)}>
          <h3>
            {current
              ? c("Ubah validasi", "Edit validation")
              : c("Dataset validasi baru", "New validation dataset")}
          </h3>
          <div className="integrity-form-grid">
            <Field label={c("Nama validasi", "Validation name")}>
              <input
                required
                className="form-control"
                maxLength={200}
                value={form.title}
                onChange={(e) => change("title", e.target.value)}
              />
            </Field>
            <Field label={c("Produk / model yang diuji", "Product / model being evaluated")}>
              <input
                required
                className="form-control"
                maxLength={200}
                value={form.product}
                onChange={(e) => change("product", e.target.value)}
              />
            </Field>
            <Field label="Pool">
              <select
                className="form-select"
                value={form.pool}
                onChange={(e) => change("pool", e.target.value)}
              >
                {["AGB", "BGB", "SOC", "litter", "deadwood"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label={c("Satuan kedua kolom", "Unit of both columns")}>
              <select
                className="form-select"
                value={form.unit}
                onChange={(e) => change("unit", e.target.value)}
              >
                <option value="Mg_C_ha">Mg C/ha</option>
                <option value="Mg_dry_matter_ha">Mg dry matter/ha</option>
              </select>
            </Field>
            <Field label={c("Tahun referensi", "Reference year")}>
              <input
                required
                type="number"
                min={1900}
                max={2100}
                className="form-control"
                value={form.reference_year}
                onChange={(e) => change("reference_year", e.target.value)}
              />
            </Field>
            <Field label={c("Tahun prediktor", "Predictor year")}>
              <input
                required
                type="number"
                min={1900}
                max={2100}
                className="form-control"
                value={form.predictor_year}
                onChange={(e) => change("predictor_year", e.target.value)}
              />
            </Field>
            <Field label={c("Sumber observasi", "Observation source")}>
              <select
                className="form-select"
                value={form.label_source}
                onChange={(e) => change("label_source", e.target.value)}
              >
                <option value="field_measurements">
                  {c("Pengukuran lapangan", "Field measurements")}
                </option>
                <option value="reference_map">{c("Peta referensi", "Reference map")}</option>
              </select>
            </Field>
            <Field label={c("Lebar blok (derajat)", "Block width (degrees)")}>
              <input
                type="number"
                min={0.01}
                max={5}
                step={0.01}
                required
                className="form-control"
                value={form.block_degrees}
                onChange={(e) => change("block_degrees", e.target.value)}
              />
            </Field>
            <Field label={c("Buffer latih–uji (km)", "Train–test buffer (km)")}>
              <input
                type="number"
                min={0}
                max={100}
                step="any"
                required
                className="form-control"
                value={form.buffer_km}
                onChange={(e) => change("buffer_km", e.target.value)}
              />
            </Field>
            <Field
              label="CSV"
              hint={
                current
                  ? c(
                      "Kosongkan untuk mempertahankan pasangan data tersimpan.",
                      "Leave empty to retain saved data pairs.",
                    )
                  : "point_id,lon,lat,observed,predicted · ≤ 2 MB · 2,000 rows"
              }
            >
              <input
                key={current?.id || "new"}
                required={!current}
                type="file"
                accept=".csv,text/csv"
                className="form-control"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Field>
          </div>
          <Field
            label={c(
              "Asal data, pengukuran, dan pemisahan data latih",
              "Data origin, measurements and training separation",
            )}
          >
            <textarea
              required
              minLength={10}
              maxLength={8000}
              className="form-control"
              rows={3}
              value={form.provenance}
              onChange={(e) => change("provenance", e.target.value)}
            />
          </Field>
          <EvidenceField value={form.evidence} onChange={(s) => change("evidence", s)} />
          <div className="integrity-actions">
            <button type="submit" className="btn btn-success" disabled={busy}>
              {busy ? c("Menguji…", "Evaluating…") : c("Jalankan validasi", "Run validation")}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={template}>
              {c("Unduh contoh CSV ilustratif", "Download illustrative CSV template")}
            </button>
          </div>
          {error ? (
            <p role="alert" className="text-danger">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
      <RecordList {...props} onEdit={(record) => void edit(record)} />
    </>
  );
}

export function RegistryPanel({ check, ...props }: SectionProps & { check: RegistryCheck }) {
  const c = useCopy();
  const [form, setForm] = useState({
    title: "",
    registry: "",
    external_project_id: "",
    registry_url: "",
    vintage_start: "",
    vintage_end: "",
    serial_prefix: "",
    serial_start: "",
    serial_end: "",
    unit_status: "reported_issued",
    checked_on: "",
    evidence: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<IntegrityRecord | null>(null);
  function edit(record: IntegrityRecord) {
    setCurrent(record);
    setForm(
      (old) =>
        Object.fromEntries(
          Object.keys(old).map((key) => [
            key,
            key === "title"
              ? record.title
              : key === "evidence" && Array.isArray(record.payload.evidence)
                ? record.payload.evidence.join("\n")
                : String(record.payload[key] ?? ""),
          ]),
        ) as typeof old,
    );
  }
  const change = (key: keyof typeof form, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { title, ...payload } = form;
      await saveRecord(
        props.projectId,
        "registry",
        current?.record_key || newIdempotencyKey(),
        {
          title,
          status: "draft",
          payload: {
            ...payload,
            serial_start: Number(form.serial_start),
            serial_end: Number(form.serial_end),
            evidence: references(form.evidence),
          },
        },
        current?.revision || 0,
      );
      await props.onChanged();
      setCurrent(null);
      setForm((old) => ({ ...old, title: "" }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="integrity-summary-grid">
        <div className="integrity-stat">
          <span>{c("Proyek bertumpang tindih", "Overlapping projects")}</span>
          <strong>{check.overlapping_projects}</strong>
          <small>
            {number(check.unique_overlap_ha)} ha · v{check.boundary_version || "—"}
          </small>
        </div>
        <div className="integrity-stat">
          <span>{c("Catatan dengan konflik nomor seri", "Records with serial conflicts")}</span>
          <strong>{check.serial_conflicts.length}</strong>
          <small>
            {c("Identitas proyek lain dilindungi", "Other project identities are protected")}
          </small>
        </div>
      </div>
      <p className="integrity-note">
        {c(
          "Pemeriksaan mencakup geometri dan catatan yang dimasukkan ke SaveGeo. Koneksi registry eksternal belum tersedia. Tumpang tindih perlu ditelaah bersama periode klaim; temuan ini belum menetapkan adanya klaim ganda.",
          "Screening covers geometry and records entered into SaveGeo. External registry connection is not available. Overlap needs review alongside claim periods; it does not establish double counting.",
        )}
      </p>
      {props.canWrite ? (
        <form className="integrity-editor" onSubmit={(e) => void submit(e)}>
          <h3>{c("Rekonsiliasi catatan registry", "Registry record reconciliation")}</h3>
          <div className="integrity-form-grid">
            {(
              [
                ["title", c("Nama catatan", "Record name"), "text"],
                ["registry", c("Registry", "Registry"), "text"],
                ["external_project_id", c("ID proyek di registry", "External project ID"), "text"],
                ["registry_url", c("Tautan catatan registry", "Registry record URL"), "url"],
                ["vintage_start", "Vintage start", "date"],
                ["vintage_end", "Vintage end", "date"],
                ["serial_prefix", c("Awalan nomor seri", "Serial prefix"), "text"],
                ["serial_start", c("Nomor urut awal", "Sequence start"), "number"],
                ["serial_end", c("Nomor urut akhir", "Sequence end"), "number"],
                ["checked_on", c("Tanggal pemeriksaan", "Date checked"), "date"],
              ] as const
            ).map(([key, label, type]) => (
              <Field key={key} label={label}>
                <input
                  required
                  type={type}
                  className="form-control"
                  maxLength={key === "registry_url" ? 2000 : 200}
                  min={type === "number" ? 0 : undefined}
                  max={type === "number" ? Number.MAX_SAFE_INTEGER : undefined}
                  step={type === "number" ? 1 : undefined}
                  value={form[key]}
                  onChange={(e) => change(key, e.target.value)}
                />
              </Field>
            ))}
            <Field label={c("Status menurut sumber", "Status reported by source")}>
              <select
                className="form-select"
                value={form.unit_status}
                onChange={(e) => change("unit_status", e.target.value)}
              >
                <option value="reported_issued">{c("Diterbitkan", "Issued")}</option>
                <option value="reported_retired">{c("Dipensiunkan", "Retired")}</option>
                <option value="reported_cancelled">{c("Dibatalkan", "Cancelled")}</option>
              </select>
            </Field>
          </div>
          <EvidenceField value={form.evidence} onChange={(s) => change("evidence", s)} />
          <button type="submit" className="btn btn-success" disabled={busy}>
            {c("Simpan catatan", "Save record")}
          </button>
          {error ? (
            <p role="alert" className="text-danger">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
      <RecordList {...props} onEdit={edit} />
    </>
  );
}
