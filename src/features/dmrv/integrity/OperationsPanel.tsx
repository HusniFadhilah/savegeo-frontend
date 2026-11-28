import { useRef, useState, type FormEvent } from "react";
import { saveRecord } from "./api";
import { errorMessage, references, useCopy } from "./helpers";
import { EvidenceField, Field, RecordActions, Status } from "./shared";
import type { IntegrityDocument, IntegrityRecord, RecordSave } from "./types";

type RecordType = "case_study" | "prospective_partner" | "follow_up" | "implementation_roadmap";
type OperationalStatus = "planned" | "in_progress" | "blocked" | "completed" | "on_hold" | "closed";

interface OperationsPayload extends Record<string, unknown> {
  record_type: RecordType;
  summary: string;
  source: string;
  source_date: string;
  owner: string;
  record_status: OperationalStatus;
  target_date: string | null;
  evidence: string[];
}

interface Props {
  projectId: string;
  records: IntegrityRecord[];
  documents: IntegrityDocument[];
  canWrite: boolean;
  canReview: boolean;
  onChanged: () => Promise<void>;
}

const RECORD_TYPES: { value: RecordType; id: string; en: string }[] = [
  { value: "case_study", id: "Studi kasus", en: "Case study" },
  { value: "prospective_partner", id: "Calon mitra", en: "Prospective partner" },
  { value: "follow_up", id: "Tindak lanjut", en: "Follow-up" },
  { value: "implementation_roadmap", id: "Roadmap implementasi", en: "Implementation roadmap" },
];

const STATUS_OPTIONS: { value: OperationalStatus; id: string; en: string }[] = [
  { value: "planned", id: "Direncanakan", en: "Planned" },
  { value: "in_progress", id: "Berjalan", en: "In progress" },
  { value: "blocked", id: "Terhambat", en: "Blocked" },
  { value: "completed", id: "Selesai menurut catatan", en: "Completed as recorded" },
  { value: "on_hold", id: "Ditunda", en: "On hold" },
  { value: "closed", id: "Ditutup", en: "Closed" },
];

function textValue(record: IntegrityRecord, key: string): string {
  const value = record.payload[key];
  return typeof value === "string" ? value : "";
}

function recordTypeLabel(type: string, c: (id: string, en: string) => string): string {
  const option = RECORD_TYPES.find((item) => item.value === type);
  return option ? c(option.id, option.en) : type;
}

function operationalStatusLabel(status: string, c: (id: string, en: string) => string): string {
  const option = STATUS_OPTIONS.find((item) => item.value === status);
  return option ? c(option.id, option.en) : status;
}

export default function OperationsPanel({
  projectId,
  records,
  documents,
  canWrite,
  canReview,
  onChanged,
}: Props) {
  const c = useCopy();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [type, setType] = useState<RecordType>("case_study");
  const [key, setKey] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [source, setSource] = useState("");
  const [sourceDate, setSourceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [owner, setOwner] = useState("");
  const [recordStatus, setRecordStatus] = useState<OperationalStatus>("planned");
  const [targetDate, setTargetDate] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const currentRecord = records.find((record) => record.record_key === editingKey);
  const evidenceReferences = references(evidence);
  const evidenceSet = new Set(evidenceReferences);
  const formRef = useRef<HTMLFormElement>(null);

  function resetForm() {
    setEditingKey(null);
    setType("case_study");
    setKey("");
    setTitle("");
    setSummary("");
    setSource("");
    setSourceDate(new Date().toISOString().slice(0, 10));
    setOwner("");
    setRecordStatus("planned");
    setTargetDate("");
    setEvidence("");
    setError("");
    setNotice("");
  }

  function editRecord(record: IntegrityRecord) {
    setEditingKey(record.record_key);
    setType(textValue(record, "record_type") as RecordType);
    setKey(record.record_key);
    setTitle(record.title);
    setSummary(textValue(record, "summary"));
    setSource(textValue(record, "source"));
    setSourceDate(textValue(record, "source_date"));
    setOwner(textValue(record, "owner"));
    setRecordStatus(textValue(record, "record_status") as OperationalStatus);
    setTargetDate(textValue(record, "target_date"));
    const refs = record.payload.evidence;
    setEvidence(Array.isArray(refs) ? refs.filter((item): item is string => typeof item === "string").join("\n") : "");
    setError("");
    setNotice("");
  }

  async function persist(status: RecordSave["status"]) {
    if (!canWrite || busy) return;
    const recordKey = key.trim();
    if (!recordKey) return;
    const payload: OperationsPayload = {
      record_type: type,
      summary: summary.trim(),
      source: source.trim(),
      source_date: sourceDate,
      owner: owner.trim(),
      record_status: recordStatus,
      target_date: targetDate || null,
      evidence: references(evidence),
    };
    const data: RecordSave = { title: title.trim(), payload, status };
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await saveRecord(projectId, "operations", recordKey, data, currentRecord?.revision ?? 0);
      await onChanged();
      setEditingKey(recordKey);
      setNotice(status === "submitted"
        ? c("Catatan diajukan untuk review.", "Record submitted for review.")
        : c("Draft catatan tersimpan.", "Record draft saved."));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void persist("draft");
  }

  function attachDocument(documentId: string) {
    const next = `document:${documentId}`;
    if (!evidenceSet.has(next)) setEvidence([...evidenceReferences, next].join("\n"));
  }

  function submitForReview() {
    if (formRef.current?.reportValidity()) void persist("submitted");
  }

  return (
    <div>
      <p className="integrity-note" role="note">
        {c(
          "Catatan ini menyimpan informasi yang dilaporkan proyek beserta sumber dan riwayat review. Status selesai, hubungan mitra, atau hasil kegiatan tidak diverifikasi hanya karena tercatat atau diterima reviewer.",
          "These records store project-reported information, its source and review history. A completed status, partner relationship or activity outcome is not verified merely because it is recorded or accepted by a reviewer.",
        )}
      </p>

      {canWrite ? (
        <form ref={formRef} className="integrity-editor" onSubmit={submitDraft}>
          <div className="integrity-record-head">
            <h3>{editingKey ? c("Ubah catatan operasional", "Edit operations record") : c("Catatan operasional baru", "New operations record")}</h3>
            {editingKey ? (
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={resetForm}>
                {c("Catatan baru", "New record")}
              </button>
            ) : null}
          </div>
          <div className="integrity-form-grid">
            <Field label={c("Jenis catatan", "Record type")}>
              <select className="form-select" value={type} onChange={(event) => setType(event.target.value as RecordType)}>
                {RECORD_TYPES.map((option) => <option key={option.value} value={option.value}>{c(option.id, option.en)}</option>)}
              </select>
            </Field>
            <Field label={c("Kunci catatan", "Record key")} hint={c("Gunakan kunci unik untuk setiap catatan.", "Use a unique key for each record.")}>
              <input className="form-control" required maxLength={100} value={key} onChange={(event) => setKey(event.target.value)} disabled={Boolean(editingKey)} />
            </Field>
            <Field label={c("Judul", "Title")}>
              <input className="form-control" required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field label={c("Sumber", "Source")} hint={c("Nama atau tautan asal informasi.", "Name or link for where the information came from.")}>
              <input className="form-control" required maxLength={1000} value={source} onChange={(event) => setSource(event.target.value)} />
            </Field>
            <Field label={c("Tanggal sumber", "Source date")}>
              <input className="form-control" type="date" required value={sourceDate} onChange={(event) => setSourceDate(event.target.value)} />
            </Field>
            <Field label={c("Pemilik tindak lanjut", "Record owner")}>
              <input className="form-control" required maxLength={100} value={owner} onChange={(event) => setOwner(event.target.value)} />
            </Field>
            <Field label={c("Status yang dilaporkan", "Reported status")}>
              <select className="form-select" value={recordStatus} onChange={(event) => setRecordStatus(event.target.value as OperationalStatus)}>
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{c(option.id, option.en)}</option>)}
              </select>
            </Field>
            <Field label={c("Tanggal target (opsional)", "Target date (optional)")}>
              <input className="form-control" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
            </Field>
            <div className="integrity-form-wide">
              <Field label={c("Ringkasan", "Summary")}>
                <textarea className="form-control" rows={3} required maxLength={8000} value={summary} onChange={(event) => setSummary(event.target.value)} />
              </Field>
            </div>
            <div className="integrity-form-wide">
              <EvidenceField value={evidence} onChange={setEvidence} />
              {documents.length ? (
                <div className="integrity-operations-documents" aria-label={c("Dokumen proyek", "Project documents")}>
                  {documents.map((document) => {
                    const reference = `document:${document.id}`;
                    const attached = evidenceSet.has(reference);
                    return (
                      <button
                        key={document.id}
                        className="btn btn-sm btn-outline-secondary"
                        type="button"
                        disabled={attached}
                        onClick={() => attachDocument(document.id)}
                      >
                        {attached ? c("Terlampir · ", "Attached · ") : c("Lampirkan · ", "Attach · ")}{document.filename}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
          <div className="integrity-actions">
            <button type="submit" className="btn btn-outline-success" disabled={busy}>
              {busy ? c("Menyimpan…", "Saving…") : c("Simpan draft", "Save draft")}
            </button>
            <button type="button" className="btn btn-success" disabled={busy} onClick={submitForReview}>
              {c("Ajukan untuk review", "Submit for review")}
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p role="alert" className="alert alert-danger">{error}</p> : null}
      {notice ? <p role="status" className="alert alert-success">{notice}</p> : null}
      {records.length ? (
        <div className="integrity-record-list">
          {records.map((record) => (
            <article className="integrity-record" key={record.id}>
              <div className="integrity-record-head">
                <div>
                  <small>{recordTypeLabel(textValue(record, "record_type"), c)} · {record.record_key}</small>
                  <h3>{record.title}</h3>
                </div>
                <Status status={record.status} />
              </div>
              <p>{textValue(record, "summary")}</p>
              <dl className="integrity-auto-metadata">
                <div><dt>{c("Sumber", "Source")}</dt><dd>{textValue(record, "source")}</dd></div>
                <div><dt>{c("Tanggal sumber", "Source date")}</dt><dd>{textValue(record, "source_date") || "—"}</dd></div>
                <div><dt>{c("Pemilik", "Owner")}</dt><dd>{textValue(record, "owner")}</dd></div>
                <div><dt>{c("Status yang dilaporkan", "Reported status")}</dt><dd>{operationalStatusLabel(textValue(record, "record_status"), c)}</dd></div>
                <div><dt>{c("Tanggal target", "Target date")}</dt><dd>{textValue(record, "target_date") || "—"}</dd></div>
              </dl>
              {canWrite ? (
                <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => editRecord(record)}>
                  {c("Ubah catatan", "Edit record")}
                </button>
              ) : null}
              <RecordActions projectId={projectId} record={record} canWrite={canWrite} canReview={canReview} onChanged={onChanged} />
            </article>
          ))}
        </div>
      ) : (
        <p role="status" className="integrity-empty">{c("Belum ada catatan operasional.", "No operations records yet.")}</p>
      )}
    </div>
  );
}
