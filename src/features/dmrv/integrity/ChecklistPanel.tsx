import { useState, type FormEvent } from "react";
import { saveRecord } from "./api";
import { EvidenceField, Field, RecordActions, Status, type SectionProps } from "./shared";
import { errorMessage, references, useCopy } from "./helpers";
import type { Criterion, IntegrityRecord } from "./types";

export default function ChecklistPanel({
  catalog,
  ...props
}: SectionProps & { catalog: Criterion[] }) {
  const c = useCopy();
  const [selected, setSelected] = useState<Criterion | null>(null);
  const [current, setCurrent] = useState<IntegrityRecord | undefined>();
  const [summary, setSummary] = useState("");
  const [evidence, setEvidence] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function edit(criterion: Criterion, record?: IntegrityRecord) {
    setSelected(criterion);
    setCurrent(record);
    setSummary(String(record?.payload.summary || ""));
    setEvidence(Array.isArray(record?.payload.evidence) ? record.payload.evidence.join("\n") : "");
    setOwner(String(record?.payload.owner || ""));
    setDue(String(record?.payload.due_date || ""));
    setError("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    const action = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    setBusy(true);
    setError("");
    try {
      await saveRecord(
        props.projectId,
        selected.category,
        selected.key,
        {
          title: selected.title,
          status: action?.value === "submitted" ? "submitted" : "draft",
          payload: { summary, evidence: references(evidence), owner, due_date: due || null },
        },
        current?.revision || 0,
      );
      await props.onChanged();
      setSelected(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <p className="integrity-note">
        {c(
          "Skor dihitung dari bukti yang diterima reviewer independen. Dokumen yang baru diajukan tetap menunggu review.",
          "The score counts evidence accepted by an independent reviewer. Submitted documents remain pending review.",
        )}
      </p>
      <div className="integrity-checklist">
        {catalog.map((criterion) => {
          const record = props.records.find(
            (r) => r.category === criterion.category && r.record_key === criterion.key,
          );
          return (
            <article className="integrity-record" key={criterion.key}>
              <div className="integrity-record-head">
                <h3>{c(criterion.title, criterion.title_en)}</h3>
                <Status status={record?.status || "missing"} />
              </div>
              <p className="integrity-note">
                {criterion.required
                  ? c("Butir wajib", "Required criterion")
                  : c(
                      "Pengecualian memerlukan alasan reviewer",
                      "Exclusion requires reviewer justification",
                    )}
              </p>
              {record ? (
                <>
                  <p>{String(record.payload.summary || "")}</p>
                  <p className="integrity-note">
                    {String(record.payload.owner || "")} {String(record.payload.due_date || "")}
                  </p>
                </>
              ) : null}
              {props.canWrite ? (
                <button
                  className="btn btn-outline-success btn-sm"
                  type="button"
                  onClick={() => edit(criterion, record)}
                >
                  {record
                    ? c("Perbarui bukti", "Update evidence")
                    : c("Tambahkan bukti", "Add evidence")}
                </button>
              ) : null}
              {record ? <RecordActions {...props} record={record} /> : null}
            </article>
          );
        })}
      </div>
      {selected ? (
        <section className="integrity-editor" aria-label={c("Editor bukti", "Evidence editor")}>
          <h3>{c(selected.title, selected.title_en)}</h3>
          <form onSubmit={(e) => void submit(e)}>
            <Field label={c("Ringkasan bukti", "Evidence summary")}>
              <textarea
                required
                maxLength={8000}
                className="form-control"
                rows={4}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </Field>
            <EvidenceField value={evidence} onChange={setEvidence} />
            <div className="integrity-form-grid">
              <Field label={c("Penanggung jawab", "Responsible person / team")}>
                <input
                  className="form-control"
                  maxLength={100}
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                />
              </Field>
              <Field label={c("Target selesai", "Due date")}>
                <input
                  type="date"
                  className="form-control"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </Field>
            </div>
            <div className="integrity-actions">
              <button
                disabled={busy}
                className="btn btn-outline-success"
                type="submit"
                value="draft"
              >
                {c("Simpan draft", "Save draft")}
              </button>
              <button disabled={busy} className="btn btn-success" type="submit" value="submitted">
                {c("Ajukan review", "Submit for review")}
              </button>
              <button className="btn btn-light" type="button" onClick={() => setSelected(null)}>
                {c("Batal", "Cancel")}
              </button>
            </div>
          </form>
          {error ? (
            <p role="alert" className="text-danger">
              {error}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
