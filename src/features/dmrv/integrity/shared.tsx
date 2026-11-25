import RecordResults from "./RecordResults";
import { useCopy, errorMessage, pretty } from "./helpers";
import { cloneElement, isValidElement, useId, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { deploySamplingPlanPlots, downloadSamplingFieldTemplate, getHistory, getRecord, reviewRecord, saveRecord } from "./api";
import type { IntegrityRecord } from "./types";

export function Status({ status }: { status: string }) {
  const c = useCopy();
  const labels: Record<string, [string, string]> = {
    missing: ["Belum ada", "Missing"],
    draft: ["Draft", "Draft"],
    submitted: ["Menunggu review", "Awaiting review"],
    accepted: ["Diterima reviewer", "Accepted by reviewer"],
    rejected: ["Perlu perbaikan", "Changes required"],
    not_applicable: ["Dikecualikan reviewer", "Excluded by reviewer"],
    open: ["Terbuka", "Open"],
    acknowledged: ["Ditindaklanjuti", "Acknowledged"],
    resolved: ["Selesai", "Resolved"],
  };
  return (
    <span className={`integrity-status is-${status}`}>
      {labels[status] ? c(...labels[status]) : status}
    </span>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const fieldId = useId();
  const element = isValidElement(children) ? children as ReactElement<{ id?: string; "aria-describedby"?: string }> : null;
  const id = element?.props.id || fieldId;
  return (
    <div className="integrity-field">
      <label htmlFor={id}>{label}</label>
      {element ? cloneElement(element, { id, ...(hint ? { "aria-describedby": `${fieldId}-hint` } : {}) }) : children}
      {hint ? <small id={`${fieldId}-hint`}>{hint}</small> : null}
    </div>
  );
}
export function EvidenceField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const c = useCopy();
  return (
    <Field
      label={c("Rujukan bukti (satu per baris)", "Evidence references (one per line)")}
      hint={c(
        "Gunakan document:ID dari tab Dokumen atau tautan HTTPS.",
        "Use document:ID from Documents or an HTTPS link.",
      )}
    >
      <textarea
        rows={2}
        className="form-control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
export function RecordActions({
  projectId,
  record,
  canWrite,
  canReview,
  onChanged,
}: {
  projectId: string;
  record: IntegrityRecord;
  canWrite: boolean;
  canReview: boolean;
  onChanged: () => Promise<void>;
}) {
  const c = useCopy();
  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getHistory>> | null>(null);
  const [deployedPlotCount, setDeployedPlotCount] = useState<number | null>(null);
  async function act(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await reviewRecord(projectId, record, decision, reason);
      await onChanged();
      setDecision("");
      setReason("");
      setHistory(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const source =
        record.category === "validation" ? await getRecord(projectId, record.id) : record;
      await saveRecord(
        projectId,
        source.category,
        source.record_key,
        { title: source.title, payload: source.payload, status: "submitted" },
        source.revision,
      );
      await onChanged();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="integrity-record-actions">
      <div className="integrity-actions">
        {canWrite && ["draft", "rejected"].includes(record.status) ? (
          <button
            type="button"
            className="btn btn-outline-success btn-sm"
            disabled={busy}
            onClick={() => void submit()}
          >
            {c("Ajukan review", "Submit for review")}
          </button>
        ) : null}
        {canWrite && record.category === "sampling_plan" && record.status === "accepted" && !record.result.field_plot_deployment ? (
          <button type="button" className="btn btn-outline-primary btn-sm" disabled={busy} onClick={() => {
            setBusy(true); setError("");
            void deploySamplingPlanPlots(projectId, record.id)
              .then((result) => { setDeployedPlotCount(result.plot_count); return onChanged(); })
              .catch((cause: unknown) => setError(errorMessage(cause)))
              .finally(() => setBusy(false));
          }}>{c("Buat plot di register lapangan", "Create plots in field register")}</button>
        ) : null}
        {canWrite && record.category === "sampling_plan" && record.result.field_plot_deployment ? (
          <button type="button" className="btn btn-outline-success btn-sm" disabled={busy} onClick={() => {
            setBusy(true); setError("");
            void downloadSamplingFieldTemplate(projectId, record.id)
              .catch((cause: unknown) => setError(errorMessage(cause)))
              .finally(() => setBusy(false));
          }}>{c("Unduh template pengukuran CSV", "Download field measurement CSV template")}</button>
        ) : null}
        {canWrite && record.category === "sampling_plan" && record.result.field_plot_deployment ? <small className="text-muted">{c("Isi tanggal kunjungan dan satu baris untuk setiap pohon terukur; tambahkan tree_code unik serta DBH atau keliling. Plot yang sudah dibuat akan dikenali saat CSV diimpor dari tab data lapangan.", "Enter the visit date and one row per measured tree; add a unique tree_code and DBH or circumference. The imported CSV will match these deployed plots in the field-data tab.")}</small> : null}
        {canReview && record.status === "submitted" ? (
          <>
            <button
              type="button"
              className="btn btn-outline-success btn-sm"
              onClick={() => setDecision("accepted")}
            >
              {c("Terima", "Accept")}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setDecision("rejected")}
            >
              {c("Minta perbaikan", "Request changes")}
            </button>
            {record.category === "safeguard" && record.record_key === "cultural_sites" ? (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setDecision("not_applicable")}
              >
                {c("Tidak berlaku", "Not applicable")}
              </button>
            ) : null}
          </>
        ) : null}
        {canWrite &&
        ["risk", "grievance"].includes(record.category) &&
        ["open", "acknowledged"].includes(record.status) ? (
          <>
            {record.status === "open" ? (
              <button
                type="button"
                className="btn btn-outline-warning btn-sm"
                onClick={() => setDecision("acknowledged")}
              >
                {c("Tindak lanjuti", "Acknowledge")}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-outline-success btn-sm"
              onClick={() => setDecision("resolved")}
            >
              {c("Tutup risiko", "Resolve risk")}
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="btn btn-link btn-sm"
          disabled={busy}
          onClick={() => {
            if (history) {
              setHistory(null);
              return;
            }
            setBusy(true);
            setError("");
            void getHistory(projectId, record.id)
              .then(setHistory)
              .catch((cause: unknown) => setError(errorMessage(cause)))
              .finally(() => setBusy(false));
          }}
        >
          {c("Riwayat", "History")} · v{record.revision}
        </button>
      </div>
      {decision ? (
        <form onSubmit={(e) => void act(e)} className="integrity-review-form">
          <Field label={c("Alasan keputusan / tindak lanjut", "Decision / follow-up reason")}>
            <textarea
              required
              minLength={5}
              maxLength={4000}
              rows={2}
              className="form-control"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div className="integrity-actions">
            <button type="submit" className="btn btn-success btn-sm" disabled={busy}>
              {c("Simpan keputusan", "Save decision")}
            </button>
            <button type="button" className="btn btn-light btn-sm" onClick={() => setDecision("")}>
              {c("Batal", "Cancel")}
            </button>
          </div>
        </form>
      ) : null}
      {deployedPlotCount !== null ? <p className="small text-success">{c("Plot sampel terhubung ke register lapangan", "Sample plots connected to the field register")}: {deployedPlotCount}.</p> : null}
      {record.review_reason ? <p className="integrity-note">{record.review_reason}</p> : null}
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      {history ? (
        <div className="integrity-history">
          {history.map((h) => (
            <details key={h.revision}>
              <summary>
                v{h.revision} · {h.snapshot.status} · {h.snapshot.updated_at}
              </summary>
              <code>SHA-256 {h.sha256}</code>
              <pre>{pretty(h.snapshot)}</pre>
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export interface SectionProps {
  projectId: string;
  records: IntegrityRecord[];
  canWrite: boolean;
  canReview: boolean;
  onChanged: () => Promise<void>;
}
export function RecordList({
  projectId,
  records,
  canWrite,
  canReview,
  onChanged,
  onEdit,
}: SectionProps & { onEdit?: (record: IntegrityRecord) => void }) {
  const c = useCopy();
  return (
    <div className="integrity-record-list">
      {records.length ? (
        records.map((record) => (
          <article key={record.id} className="integrity-record">
            <div className="integrity-record-head">
              <h3>{record.title}</h3>
              <Status status={record.status} />
            </div>
            <RecordResults result={record.result} />
            {record.payload.summary ? <p>{String(record.payload.summary)}</p> : null}
            <details>
              <summary>{c("Lihat input dan hasil", "View inputs and results")}</summary>
              <pre>{pretty({ inputs: record.payload, results: record.result })}</pre>
            </details>
            {onEdit && canWrite ? (
              <button type="button" className="btn btn-link btn-sm" onClick={() => onEdit(record)}>
                {c("Ubah input", "Edit inputs")}
              </button>
            ) : null}
            <RecordActions
              projectId={projectId}
              record={record}
              canWrite={canWrite}
              canReview={canReview}
              onChanged={onChanged}
            />
          </article>
        ))
      ) : (
        <p className="integrity-empty">
          {c(
            "Belum ada catatan. Tambahkan data dan bukti untuk memulai.",
            "No records yet. Add data and evidence to get started.",
          )}
        </p>
      )}
    </div>
  );
}
