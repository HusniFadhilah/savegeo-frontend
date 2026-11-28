import { useCallback, useEffect, useState, type FormEvent } from "react";
import { EvidenceField, Field, RecordList, type SectionProps } from "./shared";
import { appendCreditEvent, getCreditLedger, getMethodologyChecklist, saveRecord } from "./api";
import { errorMessage, references, useCopy } from "./helpers";
import type { CreditLedger, IntegrityRecord, MethodologyChecklist, MethodologyRuleItem } from "./types";

const today = () => new Date().toISOString().slice(0, 10);

function statusText(c: (id: string, en: string) => string, value: string) {
  const names: Record<string, [string, string]> = {
    not_assessed: ["Belum dinilai", "Not assessed"],
    complete: ["Lengkap", "Complete"],
    partial: ["Sebagian", "Partial"],
    not_applicable: ["Tidak berlaku", "Not applicable"],
  };
  const label = names[value] || [value, value];
  return c(label[0], label[1]);
}

function methodologyQualification(c: (id: string, en: string) => string, check: MethodologyChecklist) {
  if (check.qualification_id === "internal_review_aid") {
    return c(
      "Daftar periksa internal yang disusun dari sumber Verra yang ditautkan. Isinya tidak lengkap, tidak menggantikan teks metodologi terkendali atau review VVB untuk proyek ini, dan tidak menetapkan kelayakan maupun sertifikasi.",
      "Internal checklist based on the linked Verra sources. It is not exhaustive, does not replace the controlled methodology text or project-specific VVB review, and does not determine eligibility or certification.",
    );
  }
  if (check.qualification_id === "unsupported_version") {
    return c(
      "Belum ada daftar periksa untuk versi metodologi ini. Gunakan metodologi resmi proyek dan panduan reviewer; kriteria versi lain tidak diterapkan.",
      "No checklist is available for this methodology version. Use the project's official methodology and reviewer guidance; criteria from another version are not applied.",
    );
  }
  return check.qualification;
}

export function MethodologyPanel(props: SectionProps) {
  const c = useCopy();
  const [check, setCheck] = useState<MethodologyChecklist | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    setCheck(await getMethodologyChecklist(props.projectId));
  }, [props.projectId]);
  useEffect(() => { void refresh().catch((cause) => setError(errorMessage(cause))); }, [refresh]);

  function updateItem(key: string, update: Partial<MethodologyRuleItem>) {
    setCheck((old) => old ? {
      ...old,
      items: old.items.map((item) => item.key === key ? { ...item, ...update } : item),
    } : old);
  }

  function changeApproach(approach: "area_based" | "census_based") {
    setCheck((old) => old ? {
      ...old,
      approach,
      items: old.items.map((item) => item.approach
        ? { ...item, status: item.approach === approach ? (item.status === "not_applicable" ? "not_assessed" : item.status) : "not_applicable" }
        : item),
    } : old);
  }

  async function save(status: "draft" | "submitted") {
    if (!check || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await saveRecord(props.projectId, "methodology_check", "current", {
        title: `${check.methodology_id} v${check.methodology_version} evidence checklist`,
        status,
        payload: {
          approach: check.approach || "area_based",
          items: check.items.map((item) => ({
            key: item.key,
            status: item.status,
            notes: item.notes,
            evidence: references(item.evidence.join("\n")),
          })),
        },
      }, check.revision);
      await refresh();
      await props.onChanged();
      setNotice(status === "submitted" ? c("Checklist diajukan untuk review.", "Checklist submitted for review.") : c("Checklist tersimpan.", "Checklist saved."));
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  if (!check && !error) return <p role="status" className="integrity-empty">{c("Memuat pemeriksa metodologi…", "Loading methodology checker…")}</p>;
  if (error && !check) return <p role="alert" className="text-danger">{error}</p>;
  if (!check) return null;
  const canSubmitChecklist = check.items.every((item) => item.status !== "not_assessed")
    && check.items.some((item) => item.evidence.length > 0);

  return (
    <div>
      <p className="integrity-note">{methodologyQualification(c, check)}</p>
      {check.supported && <aside className="alert alert-info" aria-label={c("Metadata sumber metodologi", "Methodology source metadata")}>
        <strong>{c("Sumber resmi diperiksa", "Official sources checked")}: {check.source_checked_on || "—"}</strong>
        <ul className="mb-2 mt-2">
          {check.official_sources.map((source) => <li key={source.id}>
            <a href={source.url} target="_blank" rel="noreferrer">{c(source.title_id, source.title)} v{source.version}</a>
            <span> — {c("tanggal dokumen", "document date")}: {source.document_date}; {c("berlaku sejak", "effective since")}: {source.effective_date}</span>
          </li>)}
        </ul>
        <span>{c("Review ahli/VVB untuk paket daftar ini belum tercatat. Pemeriksaan sumber bukan persetujuan metodologi.", "No expert/VVB review of this checklist pack is recorded. This source check is not methodology approval.")}</span>
      </aside>}
      {!check.supported ? (
        <div className="alert alert-info">
          <strong>{c("Belum ada paket untuk versi ini", "No curated pack for this version")}</strong>
          <p className="mb-0">{c("Proyek tercatat dengan", "Project is set to")} {check.methodology_id || "—"} {check.methodology_version || ""}. {c("Sistem tidak menerapkan aturan versi lain secara otomatis.", "The system will not apply another version's rules automatically.")}</p>
        </div>
      ) : (
        props.canWrite ? <form className="integrity-editor" onSubmit={(event) => { event.preventDefault(); if (props.canWrite) void save("draft"); }}>
          <div className="d-flex flex-wrap justify-content-between gap-2 align-items-center">
            <h3 className="h6 mb-0">{check.methodology_id} v{check.methodology_version} · {c("paket ringkas untuk review", "review aid")}</h3>
          </div>
          <Field label={c("Pendekatan metodologi", "Methodology approach")}>
            <select className="form-select" value={check.approach || "area_based"} onChange={(event) => changeApproach(event.target.value as "area_based" | "census_based")}>
              <option value="area_based">{c("Berbasis area", "Area-based")}</option>
              <option value="census_based">{c("Berbasis sensus", "Census-based")}</option>
            </select>
          </Field>
          <div className="integrity-methodology-list">
            {check.items.map((item) => (
              <article className="integrity-methodology-item" key={item.key}>
                <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
                  <div>
                    <h4>{c(item.title_id || item.title, item.title)}</h4>
                    <p>{c(item.description_id || item.description, item.description)}</p>
                  </div>
                  <select aria-label={`${item.title} status`} className="form-select integrity-methodology-status" value={item.status} onChange={(event) => updateItem(item.key, { status: event.target.value as MethodologyRuleItem["status"] })}>
                    {(["not_assessed", "complete", "partial", ...(item.approach && item.approach !== check.approach ? ["not_applicable"] : [])] as const).map((status) => <option key={status} value={status}>{statusText(c, status)}</option>)}
                  </select>
                </div>
                <label className="form-label small" htmlFor={`method-notes-${item.key}`}>{c("Catatan penerapan", "Application notes")}</label>
                <textarea id={`method-notes-${item.key}`} rows={2} maxLength={4000} className="form-control mb-2" value={item.notes} onChange={(event) => updateItem(item.key, { notes: event.target.value })} />
                <EvidenceField value={item.evidence.join("\n")} onChange={(value) => updateItem(item.key, { evidence: references(value) })} />
                <a className="small" href={item.source} target="_blank" rel="noreferrer">{c("Buka sumber resmi", "Open official source")} ↗</a>
              </article>
            ))}
          </div>
          <div className="integrity-actions">
            <button type="submit" className="btn btn-outline-success" disabled={busy}>{c("Simpan draft", "Save draft")}</button>
            {props.canWrite && <button type="button" className="btn btn-success" disabled={busy || !canSubmitChecklist} onClick={() => void save("submitted")}>{c("Ajukan untuk review", "Submit for review")}</button>}
            {check.record_status && <span className="small text-muted">{c("Status catatan", "Record status")}: {check.record_status}</span>}
          </div>
        </form> : (
          <div className="integrity-methodology-list">
            {check.items.map((item) => <article className="integrity-methodology-item" key={item.key}>
              <div className="d-flex justify-content-between gap-2"><h4>{c(item.title_id || item.title, item.title)}</h4><span className="small">{statusText(c, item.status)}</span></div>
              <p>{c(item.description_id || item.description, item.description)}</p>
              {item.notes && <p>{item.notes}</p>}
              {item.evidence.length > 0 && <p>{c("Bukti", "Evidence")}: {item.evidence.join(", ")}</p>}
              <a className="small" href={item.source} target="_blank" rel="noreferrer">{c("Buka sumber resmi", "Open official source")} ↗</a>
            </article>)}
          </div>
        )
      )}
      {notice && <p role="status" className="text-success">{notice}</p>}
      {error && <p role="alert" className="text-danger">{error}</p>}
      {check.supported && <RecordList {...props} records={props.records.filter((record) => record.category === "methodology_check")} />}
    </div>
  );
}

export function SatelliteProvenancePanel(props: SectionProps) {
  const c = useCopy();
  const currentRecords = props.records.filter((record) => record.category === "satellite_provenance");
  const emptyForm = {
    snapshot_id: "", data_source: "", product_version: "", observation_start: "", observation_end: "",
    spatial_resolution_m: "", temporal_cadence: "", season_window: "", cloud_cover_pct: "",
    aerosol_status: "unknown", aerosol_method_or_qa: "", observation_count: "", data_gap_summary: "",
    processing_version: "", evidence: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [current, setCurrent] = useState<IntegrityRecord | null>(null);
  function selectRecord(record: IntegrityRecord) {
    setCurrent(record);
    const values = record.payload;
    setForm({
      snapshot_id: String(values.snapshot_id || ""), data_source: String(values.data_source || ""),
      product_version: String(values.product_version || ""), observation_start: String(values.observation_start || ""),
      observation_end: String(values.observation_end || ""), spatial_resolution_m: String(values.spatial_resolution_m ?? ""),
      temporal_cadence: String(values.temporal_cadence || ""), season_window: String(values.season_window || ""),
      cloud_cover_pct: String(values.cloud_cover_pct ?? ""), aerosol_status: String(values.aerosol_status || "unknown"),
      aerosol_method_or_qa: String(values.aerosol_method_or_qa || ""), observation_count: String(values.observation_count ?? ""),
      data_gap_summary: String(values.data_gap_summary || ""), processing_version: String(values.processing_version || ""),
      evidence: Array.isArray(values.evidence) ? values.evidence.join("\n") : "",
    });
  }
  const change = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await saveRecord(props.projectId, "satellite_provenance", form.snapshot_id, {
        title: `${form.data_source} · ${form.snapshot_id}`,
        status: "draft",
        payload: {
          snapshot_id: form.snapshot_id, data_source: form.data_source, product_version: form.product_version,
          observation_start: form.observation_start, observation_end: form.observation_end,
          spatial_resolution_m: form.spatial_resolution_m ? Number(form.spatial_resolution_m) : null,
          temporal_cadence: form.temporal_cadence, season_window: form.season_window,
          cloud_cover_pct: form.cloud_cover_pct ? Number(form.cloud_cover_pct) : null,
          aerosol_status: form.aerosol_status, aerosol_method_or_qa: form.aerosol_method_or_qa,
          observation_count: form.observation_count ? Number(form.observation_count) : null,
          data_gap_summary: form.data_gap_summary, processing_version: form.processing_version,
          evidence: references(form.evidence),
        },
      }, current?.revision || 0);
      await props.onChanged();
      setMessage(c("Provenance tersimpan dan ditautkan ke snapshot.", "Provenance saved and linked to the snapshot."));
      setCurrent(null);
      setForm({ ...emptyForm });
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return (
    <>
      <p className="integrity-note">{c("Isi metadata dari sumber atau produk yang benar-benar dipakai. Kolom kosong tetap kosong; SaveGeo tidak menebak tutupan awan, aerosol, musim, atau resolusi. Metadata ini merupakan deklarasi anggota proyek dan belum diverifikasi penyedia.", "Enter metadata from the source/product actually used. Unknown cloud, aerosol, season, or resolution values stay unknown; SaveGeo does not infer them. This is a project-member declaration, not provider-verified metadata.")}</p>
      {props.canWrite && <form className="integrity-editor" onSubmit={(event) => void submit(event)}>
        <h3>{c("Mutu dan provenance citra", "Image quality and provenance")}</h3>
        {currentRecords.length > 0 && <Field label={c("Muat catatan tersimpan untuk diedit", "Load a saved record to edit")}><select className="form-select" value={current?.id || ""} onChange={(event) => { const found = currentRecords.find((record) => record.id === event.target.value); if (found) selectRecord(found); else { setCurrent(null); setForm({ ...emptyForm }); } }}><option value="">{c("Catatan baru…", "New record…")}</option>{currentRecords.map((record) => <option key={record.id} value={record.id}>{record.title}</option>)}</select></Field>}
        <div className="integrity-form-grid">
          <Field label={c("ID snapshot analisis", "Analysis snapshot ID")}><input required maxLength={36} readOnly={Boolean(current)} className="form-control" value={form.snapshot_id} onChange={(e) => change("snapshot_id", e.target.value)} /></Field>
          <Field label={c("Sumber data / sensor", "Data source / sensor")}><input required maxLength={200} className="form-control" value={form.data_source} onChange={(e) => change("data_source", e.target.value)} /></Field>
          <Field label={c("Versi produk data", "Product version")}><input maxLength={100} className="form-control" value={form.product_version} onChange={(e) => change("product_version", e.target.value)} /></Field>
          <Field label={c("Mulai observasi", "Observation start")}><input required type="date" className="form-control" value={form.observation_start} onChange={(e) => change("observation_start", e.target.value)} /></Field>
          <Field label={c("Akhir observasi", "Observation end")}><input required type="date" className="form-control" value={form.observation_end} onChange={(e) => change("observation_end", e.target.value)} /></Field>
          <Field label={c("Resolusi spasial (m)", "Spatial resolution (m)")}><input type="number" min="0.01" step="any" className="form-control" value={form.spatial_resolution_m} onChange={(e) => change("spatial_resolution_m", e.target.value)} /></Field>
          <Field label={c("Cakupan awan (%)", "Cloud cover (%)")}><input type="number" min="0" max="100" step="any" className="form-control" value={form.cloud_cover_pct} onChange={(e) => change("cloud_cover_pct", e.target.value)} /></Field>
          <Field label={c("Jumlah observasi", "Observation count")}><input type="number" min="0" step="1" className="form-control" value={form.observation_count} onChange={(e) => change("observation_count", e.target.value)} /></Field>
          <Field label={c("Kecocokan musim / window", "Season match / window")}><input maxLength={200} className="form-control" value={form.season_window} onChange={(e) => change("season_window", e.target.value)} /></Field>
          <Field label={c("Frekuensi temporal", "Temporal cadence")}><input maxLength={100} className="form-control" value={form.temporal_cadence} onChange={(e) => change("temporal_cadence", e.target.value)} /></Field>
          <Field label={c("Status aerosol", "Aerosol status")}><select className="form-select" value={form.aerosol_status} onChange={(e) => change("aerosol_status", e.target.value)}><option value="unknown">{c("Tidak diketahui", "Unknown")}</option><option value="corrected">{c("Sudah dikoreksi", "Corrected")}</option><option value="not_corrected">{c("Belum dikoreksi", "Not corrected")}</option><option value="qa_reported">{c("Dilaporkan oleh QA", "QA reported")}</option><option value="not_applicable">{c("Tidak berlaku", "Not applicable")}</option></select></Field>
          <Field label={c("Versi pemrosesan", "Processing version")}><input required maxLength={100} className="form-control" value={form.processing_version} onChange={(e) => change("processing_version", e.target.value)} /></Field>
        </div>
        <Field label={c("Metode koreksi atau referensi QA aerosol", "Aerosol correction method or QA reference")}><textarea rows={2} maxLength={1000} className="form-control" value={form.aerosol_method_or_qa} onChange={(e) => change("aerosol_method_or_qa", e.target.value)} /></Field>
        <Field label={c("Celah observasi", "Observation gaps")}><textarea rows={2} maxLength={2000} className="form-control" value={form.data_gap_summary} onChange={(e) => change("data_gap_summary", e.target.value)} /></Field>
        <EvidenceField value={form.evidence} onChange={(value) => change("evidence", value)} />
        <button type="submit" className="btn btn-success" disabled={busy}>{busy ? c("Menyimpan…", "Saving…") : c("Simpan provenance", "Save provenance")}</button>
      </form>}
      {message && <p role="status" className="text-success">{message}</p>}
      {error && <p role="alert" className="text-danger">{error}</p>}
      <RecordList {...props} records={currentRecords} />
    </>
  );
}

export function CreditLedgerPanel({ projectId, canWrite }: Pick<SectionProps, "projectId" | "canWrite">) {
  const c = useCopy();
  const [ledger, setLedger] = useState<CreditLedger | null>(null);
  const [form, setForm] = useState({
    batch_reference: "", event_type: "issuance_reported", quantity: "", owner_from: "", owner_to: "",
    registry: "", external_transaction_id: "", effective_date: today(), evidence: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => setLedger(await getCreditLedger(projectId)), [projectId]);
  useEffect(() => { void refresh().catch((cause) => setError(errorMessage(cause))); }, [refresh]);
  const change = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const eventType = form.event_type as typeof form.event_type;
      const from = form.owner_from.trim() || null;
      const to = form.owner_to.trim() || null;
      await appendCreditEvent(projectId, {
        event_id: crypto.randomUUID(), batch_reference: form.batch_reference.trim(), event_type: eventType,
        quantity: Number(form.quantity), owner_from: from, owner_to: to, registry: form.registry.trim(),
        external_transaction_id: form.external_transaction_id.trim(), effective_date: form.effective_date,
        evidence: references(form.evidence),
      });
      await refresh();
      setForm((old) => ({ ...old, quantity: "", external_transaction_id: "", evidence: "" }));
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  const eventLabels: Record<string, [string, string]> = {
    issuance_reported: ["Penerbitan dilaporkan", "Reported issuance"],
    transfer_reported: ["Transfer dilaporkan", "Reported transfer"],
    use_reported: ["Penggunaan dilaporkan", "Reported use"],
    retirement_reported: ["Pensiun dilaporkan", "Reported retirement"],
    cancellation_reported: ["Pembatalan dilaporkan", "Reported cancellation"],
  };
  return (
    <div>
      <div className="alert alert-info">{ledger?.qualification || c("Memuat ledger…", "Loading ledger…")}</div>
      {ledger?.batches.map((batch) => <article className="integrity-record mb-3" key={batch.batch_reference}><strong>{batch.batch_reference}</strong><span className="small text-muted ms-2">{batch.registry}</span><ul className="mb-0 mt-2">{batch.reported_balances.length ? batch.reported_balances.map((balance) => <li key={balance.owner}>{balance.owner}: {balance.quantity.toLocaleString()}</li>) : <li>{c("Tidak ada saldo internal yang dilaporkan.", "No internally reported balance remains.")}</li>}</ul></article>)}
      {canWrite && <form className="integrity-editor" onSubmit={(event) => void submit(event)}>
        <h3>{c("Catat event siklus kredit", "Record a credit lifecycle event")}</h3>
        <div className="integrity-form-grid">
          <Field label={c("Batch / referensi serial", "Batch / serial reference")}><input required maxLength={120} className="form-control" value={form.batch_reference} onChange={(e) => change("batch_reference", e.target.value)} /></Field>
          <Field label={c("Jenis event", "Event type")}><select className="form-select" value={form.event_type} onChange={(e) => change("event_type", e.target.value)}>{Object.entries(eventLabels).map(([value, labels]) => <option key={value} value={value}>{c(labels[0], labels[1])}</option>)}</select></Field>
          <Field label={c("Jumlah unit (bilangan bulat)", "Quantity (whole units)")}><input required type="number" min="1" step="1" className="form-control" value={form.quantity} onChange={(e) => change("quantity", e.target.value)} /></Field>
          <Field label={c("Nama registry", "Registry name")}><input required maxLength={100} className="form-control" value={form.registry} onChange={(e) => change("registry", e.target.value)} /></Field>
          <Field label={c("ID transaksi eksternal", "External transaction ID")}><input required maxLength={160} className="form-control" value={form.external_transaction_id} onChange={(e) => change("external_transaction_id", e.target.value)} /></Field>
          <Field label={c("Tanggal efektif", "Effective date")}><input required type="date" className="form-control" value={form.effective_date} onChange={(e) => change("effective_date", e.target.value)} /></Field>
          {form.event_type !== "issuance_reported" && <Field label={c("Pemilik asal", "From owner")}><input required maxLength={200} className="form-control" value={form.owner_from} onChange={(e) => change("owner_from", e.target.value)} /></Field>}
          {!["use_reported", "retirement_reported", "cancellation_reported"].includes(form.event_type) && <Field label={c("Pemilik tujuan", "To owner")}><input required maxLength={200} className="form-control" value={form.owner_to} onChange={(e) => change("owner_to", e.target.value)} /></Field>}
        </div>
        <EvidenceField value={form.evidence} onChange={(value) => change("evidence", value)} />
        <button type="submit" className="btn btn-success" disabled={busy}>{busy ? c("Menyimpan…", "Saving…") : c("Catat event dilaporkan", "Record reported event")}</button>
        {error && <p role="alert" className="text-danger mt-2">{error}</p>}
      </form>}
      <h3 className="integrity-subheading">{c("Riwayat event", "Event history")}</h3>
      {ledger?.events.length ? <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>{c("Tanggal", "Date")}</th><th>{c("Event", "Event")}</th><th>{c("Batch", "Batch")}</th><th>{c("Jumlah", "Quantity")}</th><th>{c("Pihak", "Parties")}</th><th>{c("Registry", "Registry")}</th><th>{c("Status catatan", "Record status")}</th></tr></thead><tbody>{ledger.events.map((event) => <tr key={event.event_id}><td>{event.effective_date}</td><td>{c(eventLabels[event.event_type]?.[0] || event.event_type, eventLabels[event.event_type]?.[1] || event.event_type)}</td><td>{event.batch_reference}</td><td>{event.quantity.toLocaleString()}</td><td>{event.owner_from || "—"} → {event.owner_to || "—"}</td><td>{event.registry}</td><td>{c("Dilaporkan internal", "Reported internally")}</td></tr>)}</tbody></table></div> : <p className="integrity-empty">{c("Belum ada event yang dicatat.", "No events recorded yet.")}</p>}
    </div>
  );
}
